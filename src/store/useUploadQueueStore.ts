// src/store/useUploadQueueStore.ts
import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType, FileSystemSessionType } from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { apiClient } from '../lib/apiClient';
import { storage } from '../lib/storage';
import { sliceFiles } from '../components/record/slice';
import { useTodayStore } from './useTodayStore';
import { useAchievementStore } from './useAchievementStore';
import { createNotificationDeepLink, getNotificationText } from '../lib/notification-texts';
import { addDiagnosticBreadcrumb, reportHttpFailure } from '../lib/diagnostics';

const getLocalNotificationText = (
  key: 'uploadPausedNetwork' | 'uploadPausedServer',
) => getNotificationText(storage.getString('myturn_lang'), key, {}, 'tr');

export interface ChunkProgress {
  partNumber: number;
  tempPath: string;
  presignedUrl: string;
  byteSize: number;
  bytesSent: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  etag?: string;
}

export interface UploadTask {
  id: string;
  assignmentId: string;
  groupId: string;
  uploadId: string;
  key: string;
  clipId?: string;
  responseId?: string;
  filePath: string;
  sourceFiles?: string[];
  previewPath?: string;
  totalSize: number;
  mediaType: 'photo' | 'snippet' | 'vlog';
  caption?: string;
  location?: string;
  metadata?: string;
  status: 'idle' | 'slicing' | 'uploading' | 'processing' | 'completed' | 'failed' | 'paused';
  chunks: ChunkProgress[];
}

interface UploadQueueState {
  tasks: Record<string, UploadTask>;
  activeTaskId: string | null;
  isBannerTucked: boolean;
  bannerRevealRequest: number;

  // Actions
  startUpload: (
    taskId: string,
    assignmentId: string,
    groupId: string,
    filePaths: string[],
    mediaType: 'photo' | 'snippet' | 'vlog',
    caption?: string,
    location?: string,
    thumbnailPath?: string,
    metadata?: string,
  ) => Promise<void>;
  updateChunkProgress: (taskId: string, partNumber: number, bytesSent: number) => void;
  reconcileActiveUploadsOnStart: () => Promise<void>;
  checkProcessingTask: (taskId: string) => Promise<void>;
  trackResponseProcessing: (responseId: string, clipId: string, assignmentId: string, groupId: string, filePath: string) => void;
  retryFailedTask: (taskId: string) => Promise<void>;
  pauseUpload: (taskId: string) => void;
  clearTask: (taskId: string) => Promise<void>;
  setBannerTucked: (tucked: boolean) => void;
  requestBannerReveal: () => void;
}

const STORAGE_KEY = "myturn_upload_queue";

const loadQueueFromDisk = (): Record<string, UploadTask> => {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, UploadTask>;
    return Object.fromEntries(
      Object.entries(parsed).map(([storedId, task]) => {
        const taskId = task.id || storedId;
        return [taskId, {
          ...task,
          id: taskId,
          // Queue entries created before task IDs were introduced used the
          // assignment ID as their key, so this is a safe one-time migration.
          assignmentId: task.assignmentId || taskId,
          sourceFiles: task.sourceFiles?.length ? task.sourceFiles : task.filePath ? [task.filePath] : [],
        }];
      }),
    );
  } catch {
    return {};
  }
};

// Helper to persist queue structure inside MMKV
const saveQueueToDisk = (tasks: Record<string, UploadTask>) => {
  storage.set(STORAGE_KEY, JSON.stringify(tasks));
};

// In-Memory map to track active native background UploadTask instances for cancellation
const activeNativeTasks = new Map<string, Record<number, FileSystem.UploadTask>>();

// In-Memory set to isolate user-initiated pauses from real network failure dropouts
const intentionallyCancelled = new Map<string, Set<number>>();

// In-Memory mutex lock registry to completely block duplicate parallel finalization calls
const activeFinalizations = new Set<string>();
const activeUploadRunners = new Set<string>();
const uploadsBeingCleared = new Set<string>();

// Native upload progress callbacks can fire dozens of times per second for
// every part. Coalesce all tasks into one store update so several concurrent
// uploads cannot monopolize the JS thread (and make the rest of the app appear
// frozen). Progress is intentionally not persisted: completed-part state is
// persisted below and the server reconciler is authoritative after a restart.
const PROGRESS_FLUSH_INTERVAL_MS = 250;
const MAX_PARALLEL_CHUNKS_PER_TASK = 2;
const pendingProgressUpdates = new Map<string, Map<number, number>>();
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;

const discardPendingProgress = (taskId: string) => {
  pendingProgressUpdates.delete(taskId);
};

const scheduleProgressFlush = () => {
  if (progressFlushTimer) return;

  progressFlushTimer = setTimeout(() => {
    progressFlushTimer = null;
    const updates = new Map(pendingProgressUpdates);
    pendingProgressUpdates.clear();
    if (!updates.size) return;

    useUploadQueueStore.setState((state) => {
      let nextTasks = state.tasks;
      let changed = false;

      updates.forEach((partUpdates, taskId) => {
        const task = nextTasks[taskId];
        if (!task || task.status !== 'uploading') return;

        let taskChanged = false;
        const chunks = task.chunks.map((chunk) => {
          const bytesSent = partUpdates.get(chunk.partNumber);
          if (bytesSent === undefined || chunk.status !== 'uploading') return chunk;

          const boundedBytes = Math.min(bytesSent, chunk.byteSize);
          if (boundedBytes <= chunk.bytesSent) return chunk;
          taskChanged = true;
          return { ...chunk, bytesSent: boundedBytes };
        });

        if (!taskChanged) return;
        if (!changed) nextTasks = { ...nextTasks };
        nextTasks[taskId] = { ...task, chunks };
        changed = true;
      });

      return changed ? { tasks: nextTasks } : {};
    });
  }, PROGRESS_FLUSH_INTERVAL_MS);
};

export const useUploadQueueStore = create<UploadQueueState>((set, get) => ({
  tasks: (() => {
    const tasks = loadQueueFromDisk();
    saveQueueToDisk(tasks);
    return tasks;
  })(),
  activeTaskId: null,
  isBannerTucked: false,
  bannerRevealRequest: 0,

  setBannerTucked: (isBannerTucked) => set({ isBannerTucked }),
  requestBannerReveal: () => set((state) => ({ bannerRevealRequest: state.bannerRevealRequest + 1 })),

  trackResponseProcessing: (responseId, clipId, assignmentId, groupId, filePath) => {
    const taskId = `response-${responseId}`;
    const task: UploadTask = {
      id: taskId,
      assignmentId,
      groupId,
      uploadId: '',
      key: '',
      clipId,
      responseId,
      filePath,
      sourceFiles: [filePath],
      totalSize: 1,
      mediaType: 'snippet',
      status: 'processing',
      chunks: [{
        partNumber: 1,
        tempPath: filePath,
        presignedUrl: '',
        byteSize: 1,
        bytesSent: 1,
        status: 'completed',
      }],
    };
    set((state) => {
      const nextTasks = { ...state.tasks, [taskId]: task };
      saveQueueToDisk(nextTasks);
      return { tasks: nextTasks, activeTaskId: taskId };
    });
  },

  pauseUpload: (taskId) => {
    const task = get().tasks[taskId];
    if (!task || task.status !== 'uploading') return;

    discardPendingProgress(taskId);
    console.log(`[QueueStore] Pausing upload task: ${taskId}. Canceling active native segments.`);

    // 1. Mark chunk indexes as intentionally cancelled before terminating them
    const partTasksMap = activeNativeTasks.get(taskId);
    if (partTasksMap) {
      const cancelledParts = intentionallyCancelled.get(taskId) || new Set<number>();
      Object.keys(partTasksMap).forEach(partNum => {
        cancelledParts.add(parseInt(partNum, 10));
      });
      intentionallyCancelled.set(taskId, cancelledParts);

      // 2. Cancel in-flight native network requests to instantly halt cell data usage
      Object.values(partTasksMap).forEach(uploadTask => {
        try {
          uploadTask.cancelAsync().catch(() => {});
        } catch (e) {
          console.warn("[Pause Task Error]:", e);
        }
      });
      activeNativeTasks.delete(taskId);
    }

    set(state => {
      const nextTasks: Record<string, UploadTask> = {
        ...state.tasks,
        [taskId]: {
          ...task,
          status: 'paused' as const,
          chunks: task.chunks.map(c => c.status === 'uploading' ? { ...c, status: 'pending' as const, bytesSent: 0 } : c)
        }
      };
      saveQueueToDisk(nextTasks);
      return { tasks: nextTasks };
    });
  },

  clearTask: async (taskId) => {
    // Evict cancellation tracking references
    intentionallyCancelled.delete(taskId);
    discardPendingProgress(taskId);
    uploadsBeingCleared.add(taskId);

    // Cancel active native network tasks
    const tasksMap = activeNativeTasks.get(taskId);
    if (tasksMap) {
      const cancellations = Object.values(tasksMap).map(uploadTask => {
        try {
          return uploadTask.cancelAsync();
        } catch (e) {
          console.warn("[Cancel Native Task Error]:", e);
          return Promise.resolve();
        }
      });
      activeNativeTasks.delete(taskId);
      await Promise.allSettled(cancellations);
    }

    const task = get().tasks[taskId];
    if (!task) {
      uploadsBeingCleared.delete(taskId);
      return;
    }

    console.log(`[QueueStore] Initiating complete cancellation sequence for upload task: ${taskId}`);

    // Remove compile lock if present
    if (task.uploadId) {
      activeFinalizations.delete(task.uploadId);
    }

    // Dismiss active notifications from the status tray
    Notifications.dismissNotificationAsync('vlog_upload_progress').catch(() => {});

    // Delete the temporary sliced chunk cache folder
    const chunkDir = `${FileSystem.cacheDirectory}uploads/${taskId}/`;
    await FileSystem.deleteAsync(chunkDir, { idempotent: true }).catch(() => {});

    // Delete every original segment after its logical upload has been resolved.
    const sourceFiles = task.sourceFiles?.length ? task.sourceFiles : task.filePath ? [task.filePath] : [];
    await Promise.all(sourceFiles.map((sourcePath) =>
      FileSystem.deleteAsync(sourcePath, { idempotent: true }).catch((err) => {
        console.warn(`[QueueStore] Failed to purge recording source at ${sourcePath}:`, err);
      }),
    ));
    if (task.previewPath) {
      await FileSystem.deleteAsync(task.previewPath, { idempotent: true }).catch(() => {});
    }

    // Remove local state before the optional network cleanup. Logout must not
    // expose the previous user's queue even when the device is offline.
    set(state => {
      const nextTasks = { ...state.tasks };
      delete nextTasks[taskId];
      saveQueueToDisk(nextTasks);
      return {
        tasks: nextTasks,
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
      };
    });
    uploadsBeingCleared.delete(taskId);

    // Request server-side S3 abort compilation cleanup to free R2 storage
    if (task.uploadId && task.key && task.status !== 'processing' && task.status !== 'completed') {
      try {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          apiClient.request<any>('vlog/upload', [{
            action: 'abort',
            uploadId: task.uploadId,
            key: task.key
          }]),
          new Promise<{ success: false; error: string }>((resolve) => {
            timeoutId = setTimeout(
              () => resolve({ success: false, error: 'Abort request timed out.' }),
              5000,
            );
          }),
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        if (!result.success) {
          console.warn("[QueueStore] S3 Server abort compilation request failed:", result.error);
        }
      } catch (err) {
        console.warn("[QueueStore] S3 Server abort compilation request failed:", err);
      }
    }

  },

  updateChunkProgress: (taskId, partNumber, bytesSent) => {
    const task = get().tasks[taskId];
    const chunk = task?.chunks.find((candidate) => candidate.partNumber === partNumber);
    if (!task || task.status !== 'uploading' || !chunk || chunk.status !== 'uploading') return;

    const taskUpdates = pendingProgressUpdates.get(taskId) || new Map<number, number>();
    taskUpdates.set(partNumber, Math.max(taskUpdates.get(partNumber) || 0, bytesSent));
    pendingProgressUpdates.set(taskId, taskUpdates);
    scheduleProgressFlush();
  },

  startUpload: async (taskId, assignmentId, groupId, filePaths, mediaType, caption, location, thumbnailPath, metadata) => {
    if (!filePaths.length) throw new Error("Source file does not exist.");
    const fileInfos = await Promise.all(filePaths.map((filePath) => FileSystem.getInfoAsync(filePath)));
    if (fileInfos.some((info) => !info.exists || typeof info.size !== 'number' || info.size <= 0)) {
      throw new Error("Source file does not exist.");
    }

    const totalSize = fileInfos.reduce((sum, info) => sum + (info.exists ? info.size : 0), 0);
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    const previewDir = `${FileSystem.cacheDirectory}upload_previews/`;
    const previewPath = `${previewDir}${taskId}.jpg`;
    if (thumbnailPath) {
      await FileSystem.makeDirectoryAsync(previewDir, { intermediates: true }).catch(() => {});
      await FileSystem.copyAsync({ from: thumbnailPath, to: previewPath }).catch((error) => {
        console.warn('[QueueStore] Could not persist upload preview:', error);
      });
    }

    const initialTask: UploadTask = {
      id: taskId,
      assignmentId,
      groupId,
      uploadId: '',
      key: '',
      filePath: filePaths[0],
      sourceFiles: filePaths,
      previewPath: thumbnailPath ? previewPath : undefined,
      totalSize,
      mediaType,
      caption,
      location,
      metadata,
      status: 'slicing' as const,
      chunks: []
    };

    set(state => {
      const nextTasks: Record<string, UploadTask> = { ...state.tasks, [taskId]: initialTask };
      saveQueueToDisk(nextTasks);
      return { tasks: nextTasks, activeTaskId: taskId };
    });

    try {
      const slices = await sliceFiles(filePaths, taskId);

      const initRes = (await apiClient.request<any>('vlog/upload', [{
        action: 'initiate',
        groupId,
        assignmentId,
        mediaType,
        caption,
        location,
        metadata,
        totalChunks,
        totalBytes: totalSize
      }])) as any;

      if (!initRes.success || !initRes.uploadId || !initRes.key) {
        throw new Error(initRes.error || "Could not negotiate upload session.");
      }

      const chunksMapped: ChunkProgress[] = slices.map(s => ({
        partNumber: s.partNumber,
        tempPath: s.tempPath,
        presignedUrl: initRes.presignedUrls[s.partNumber - 1],
        byteSize: s.byteSize,
        bytesSent: 0,
        status: 'pending' as const
      }));

      set(state => {
        const nextTasks: Record<string, UploadTask> = {
          ...state.tasks,
          [taskId]: {
            ...initialTask,
            uploadId: initRes.uploadId,
            key: initRes.key,
            status: 'uploading' as const,
            chunks: chunksMapped
          }
        };
        saveQueueToDisk(nextTasks);
        return { tasks: nextTasks };
      });

      get().retryFailedTask(taskId);

    } catch (err: any) {
      console.error("[startUpload] Error initiating upload:", err);
      set(state => {
        const nextTasks: Record<string, UploadTask> = {
          ...state.tasks,
          [taskId]: { ...initialTask, status: 'failed' as const }
        };
        saveQueueToDisk(nextTasks);
        return {
          tasks: nextTasks,
          activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        };
      });
      throw err;
    }
  },

  retryFailedTask: async (taskId) => {
    const task = get().tasks[taskId];
    if (!task) return;

    if (!task.uploadId || !task.chunks.length) {
      if (task.uploadId) {
        await apiClient.request<any>('vlog/upload', [{
          action: 'abort',
          uploadId: task.uploadId,
          key: task.key,
        }]).catch(() => ({ success: false }));
      }
      const sourceFiles = task.sourceFiles?.length ? task.sourceFiles : task.filePath ? [task.filePath] : [];
      await get().startUpload(
        task.id,
        task.assignmentId,
        task.groupId,
        sourceFiles,
        task.mediaType,
        task.caption,
        task.location,
        task.previewPath,
        task.metadata,
      );
      return;
    }

    // Reconciliation, foregrounding, and the retry button may all request a
    // resume at nearly the same time. Keep one runner per logical upload so
    // those calls cannot create duplicate native tasks for queued parts.
    if (activeUploadRunners.has(taskId)) return;
    activeUploadRunners.add(taskId);

    try {
      set(state => {
        const nextTasks: Record<string, UploadTask> = {
          ...state.tasks,
          [taskId]: { ...task, status: 'uploading' as const }
        };
        saveQueueToDisk(nextTasks);
        return { tasks: nextTasks, activeTaskId: taskId };
      });

      const processChunk = async (chunk: ChunkProgress) => {
        set(state => {
          const t = state.tasks[taskId];
          if (!t) return {};
          const updatedChunks = t.chunks.map(c =>
            c.partNumber === chunk.partNumber ? { ...c, status: 'uploading' as const } : c
          );
          return { tasks: { ...state.tasks, [taskId]: { ...t, chunks: updatedChunks } } };
        });

        try {
          const uploadTask = FileSystem.createUploadTask(
            chunk.presignedUrl,
            chunk.tempPath,
            {
              headers: { 'Content-Type': 'application/octet-stream' },
              httpMethod: 'PUT',
              uploadType: FileSystemUploadType.BINARY_CONTENT,
              sessionType: FileSystemSessionType.BACKGROUND
            },
            (data) => {
              get().updateChunkProgress(taskId, chunk.partNumber, data.totalBytesSent);
            }
          );

          let currentMap = activeNativeTasks.get(taskId) || {};
          currentMap[chunk.partNumber] = uploadTask;
          activeNativeTasks.set(taskId, currentMap);

          const result = await uploadTask.uploadAsync();

          // Check if this chunk's upload cycle was paused by the user
          const wasCancelled = intentionallyCancelled.get(taskId)?.has(chunk.partNumber);
          if (wasCancelled) {
            intentionallyCancelled.get(taskId)?.delete(chunk.partNumber);

            set(state => {
              const t = state.tasks[taskId];
              if (!t) return {};
              const updatedChunks = t.chunks.map(c =>
                c.partNumber === chunk.partNumber ? { ...c, status: 'pending' as const, bytesSent: 0 } : c
              );
              const nextTasks: Record<string, UploadTask> = { ...state.tasks, [taskId]: { ...t, chunks: updatedChunks } };
              saveQueueToDisk(nextTasks);
              return { tasks: nextTasks };
            });
            return;
          }

          const isSuccess = result && result.status >= 200 && result.status < 300;

          if (isSuccess) {
            addDiagnosticBreadcrumb({
              category: 'upload',
              name: 'multipart_chunk_upload',
              outcome: 'success',
              status: result.status,
              context: { partNumber: chunk.partNumber, mediaType: task.mediaType },
            });
            const etag = result.headers['etag'] || result.headers['ETag'] || 'verified';

            const activeMap = activeNativeTasks.get(taskId);
            if (activeMap) {
              delete activeMap[chunk.partNumber];
              if (Object.keys(activeMap).length === 0) activeNativeTasks.delete(taskId);
              else activeNativeTasks.set(taskId, activeMap);
            }

            set(state => {
              const t = state.tasks[taskId];
              if (!t) return {};
              const updatedChunks = t.chunks.map(c =>
                c.partNumber === chunk.partNumber ? { ...c, status: 'completed' as const, etag, bytesSent: c.byteSize } : c
              );
              const nextTasks: Record<string, UploadTask> = { ...state.tasks, [taskId]: { ...t, chunks: updatedChunks } };
              saveQueueToDisk(nextTasks);
              return { tasks: nextTasks };
            });

            await FileSystem.deleteAsync(chunk.tempPath).catch(() => {});

            const currentTask = get().tasks[taskId];
            const allDone = currentTask.chunks.every(c => c.status === 'completed');

            if (allDone) {
              if (activeFinalizations.has(currentTask.uploadId)) {
                console.log(`[QueueStore] uploadId ${currentTask.uploadId} compilation is already in progress. Dropping redundant thread.`);
                return;
              }
              activeFinalizations.add(currentTask.uploadId);

              await finalizeUpload(currentTask);
            }
          } else {
            reportHttpFailure({
              route: 'storage/multipart-chunk',
              method: 'PUT',
              status: result?.status ?? 0,
              code: 'UPLOAD_PART_FAILED',
              errorType: 'UploadPartHttpError',
              context: { partNumber: chunk.partNumber, mediaType: task.mediaType },
            });
            throw new Error(`Upload returned non-OK status: ${result?.status}`);
          }
        } catch (err) {
          const activeMap = activeNativeTasks.get(taskId);
          if (activeMap) {
            delete activeMap[chunk.partNumber];
            if (Object.keys(activeMap).length === 0) activeNativeTasks.delete(taskId);
            else activeNativeTasks.set(taskId, activeMap);
          }

          const wasCancelled = intentionallyCancelled.get(taskId)?.has(chunk.partNumber);
          if (wasCancelled) {
            intentionallyCancelled.get(taskId)?.delete(chunk.partNumber);

            set(state => {
              const t = state.tasks[taskId];
              if (!t) return {};
              const updatedChunks = t.chunks.map(c =>
                c.partNumber === chunk.partNumber ? { ...c, status: 'pending' as const, bytesSent: 0 } : c
              );
              const nextTasks: Record<string, UploadTask> = { ...state.tasks, [taskId]: { ...t, chunks: updatedChunks } };
              saveQueueToDisk(nextTasks);
              return { tasks: nextTasks };
            });
            return;
          }

          console.error(`[Upload part ${chunk.partNumber} failed]:`, err);
          if (!(err instanceof Error && err.message.startsWith('Upload returned non-OK status:'))) {
            reportHttpFailure({
              route: 'storage/multipart-chunk',
              method: 'PUT',
              status: 0,
              code: 'UPLOAD_PART_FAILED',
              errorType: err instanceof Error ? err.name : 'UploadPartError',
              errorMessage: err instanceof Error ? err.message : String(err),
              context: { partNumber: chunk.partNumber, mediaType: task.mediaType },
            });
          }

          // Schedule persistent failure alert
          const notification = getLocalNotificationText('uploadPausedNetwork');
          Notifications.scheduleNotificationAsync({
            identifier: 'vlog_upload_progress',
            content: {
              ...notification,
              data: {
                url: createNotificationDeepLink({
                  screen: 'record',
                  groupId: get().tasks[taskId]?.groupId,
                  focus: 'upload',
                  itemId: taskId,
                }),
              },
            },
            trigger: null,
          }).catch(() => {});

          set(state => {
            const t = state.tasks[taskId];
            if (!t) return {};
            const updatedChunks = t.chunks.map(c =>
              c.partNumber === chunk.partNumber ? { ...c, status: 'failed' as const, bytesSent: 0 } : c
            );
            const nextTasks: Record<string, UploadTask> = { ...state.tasks, [taskId]: { ...t, chunks: updatedChunks } };
            saveQueueToDisk(nextTasks);
            return { tasks: nextTasks };
          });
        }
      };

      const activeParts = activeNativeTasks.get(taskId) || {};
      const pendingChunks = task.chunks.filter(
        (chunk) => chunk.status !== 'completed' && !activeParts[chunk.partNumber],
      );
      let nextChunkIndex = 0;
      const processNextChunk = async (): Promise<void> => {
        if (uploadsBeingCleared.has(taskId) || get().tasks[taskId]?.status !== 'uploading') return;
        const chunk = pendingChunks[nextChunkIndex++];
        if (!chunk) return;
        await processChunk(chunk);
        await processNextChunk();
      };
      await Promise.all(
        Array.from(
          { length: Math.min(MAX_PARALLEL_CHUNKS_PER_TASK, pendingChunks.length) },
          () => processNextChunk(),
        ),
      );
    } finally {
      activeUploadRunners.delete(taskId);
    }
  },

  reconcileActiveUploadsOnStart: async () => {
    const tasks = { ...get().tasks };
    const taskIds = Object.keys(tasks);

    for (const taskId of taskIds) {
      const task = tasks[taskId];
      if (task.status === 'completed') {
        await get().clearTask(taskId);
        continue;
      }
      if (task.status === 'processing') {
        await get().checkProcessingTask(taskId);
        continue;
      }
      if (task.status === 'slicing' || !task.uploadId || !task.chunks.length) {
        try {
          await get().retryFailedTask(taskId);
        } catch (error) {
          console.warn(`[Reconciler] Failed to rebuild upload task ${taskId}:`, error);
        }
        continue;
      }
      if (task.status !== 'uploading' && task.status !== 'failed' && task.status !== 'paused') continue;

      try {
        const res = (await apiClient.request<any>('vlog/upload', [{
          action: 'status',
          uploadId: task.uploadId,
          key: task.key
        }])) as any;

        if (res.success && Array.isArray(res.parts)) {
          const remotePartNumbers = new Set(res.parts.map((p: any) => p.partNumber));
          const updatedChunks = task.chunks.map(chunk => {
            const hasUploaded = remotePartNumbers.has(chunk.partNumber);
            if (hasUploaded) {
              const remotePart = res.parts.find((p: any) => p.partNumber === chunk.partNumber);
              return {
                ...chunk,
                status: 'completed' as const,
                etag: remotePart.etag,
                bytesSent: chunk.byteSize
              };
            }
            return chunk;
          });

          tasks[taskId] = { ...task, chunks: updatedChunks };
          saveQueueToDisk(tasks);
          set({ tasks });

          if (task.status !== 'paused') {
            get().retryFailedTask(taskId);
          }
        }
      } catch (err) {
        console.warn(`[Reconciler] Failed to sync remote status for task ${taskId}:`, err);
      }
    }
  },

  checkProcessingTask: async (taskId) => {
    const task = get().tasks[taskId];
    if (!task || task.status !== 'processing') return;

    try {
      if (task.responseId) {
        const response = (await apiClient.request<any>('vlog/upload', [{
          action: 'response-status',
          responseId: task.responseId,
        }])) as any;
        const status = response?.response?.transcodeStatus;
        if (status === 'COMPLETED') {
          useUploadQueueStore.setState((state) => {
            const current = state.tasks[taskId];
            if (!current) return {};
            const nextTasks = { ...state.tasks, [taskId]: { ...current, status: 'completed' as const } };
            saveQueueToDisk(nextTasks);
            return { tasks: nextTasks };
          });
          await useTodayStore.getState().fetchTodayVlogs(task.groupId);
          setTimeout(() => useUploadQueueStore.getState().clearTask(taskId), 5000);
        } else if (status === 'FAILED_PERMANENTLY') {
          useUploadQueueStore.setState((state) => {
            const current = state.tasks[taskId];
            if (!current) return {};
            const nextTasks = { ...state.tasks, [taskId]: { ...current, status: 'failed' as const } };
            saveQueueToDisk(nextTasks);
            return { tasks: nextTasks };
          });
        }
        return;
      }

      if (!task.clipId) return;
      const response = (await apiClient.request<any>('vlog/upload', [{
        action: 'clip-status',
        clipId: task.clipId,
      }])) as any;
      const status = response?.clip?.transcodeStatus;
      if (status === 'COMPLETED') {
        useUploadQueueStore.setState((state) => {
          const current = state.tasks[taskId];
          if (!current) return {};
          const nextTasks = { ...state.tasks, [taskId]: { ...current, status: 'completed' as const } };
          saveQueueToDisk(nextTasks);
          return { tasks: nextTasks };
        });
        useTodayStore.getState().fetchTodayVlogs(task.groupId);

        setTimeout(() => {
          useUploadQueueStore.getState().clearTask(taskId);
        }, 5000);
      } else if (status === 'FAILED' || status === 'FAILED_PERMANENTLY') {
        useUploadQueueStore.setState((state) => {
          const current = state.tasks[taskId];
          if (!current) return {};
          const nextTasks = { ...state.tasks, [taskId]: { ...current, status: 'failed' as const } };
          saveQueueToDisk(nextTasks);
          return { tasks: nextTasks };
        });
      }
    } catch (error) {
      console.warn(`[QueueStore] Processing status check failed for ${taskId}:`, error);
    }
  }
}));

async function finalizeUpload(task: UploadTask) {
  try {
    const response = (await apiClient.request<any>('vlog/upload', [{
      action: 'complete',
      uploadId: task.uploadId,
      key: task.key
    }])) as any;

    if (response.success) {
      console.log(`[QueueStore] Complete Upload succeeded for task: ${task.id}`);

      const processingRequired = ['QUEUED', 'PROCESSING'].includes(response.transcodeStatus);
      if (!processingRequired) {
        useTodayStore.getState().fetchTodayVlogs(task.groupId);
      }

      const conclude = response.conclude;
      if (conclude && conclude.success) {
        const achievementStore = useAchievementStore.getState();
        if (conclude.newlyUnlocked?.length) {
          conclude.newlyUnlocked.forEach((id: string) => achievementStore.enqueue({ type: 'achievement', id }));
        }
        if (conclude.individualTierUp) {
          achievementStore.enqueue({ type: 'levelUp', config: { type: 'individual', from: conclude.individualTierUp.from, to: conclude.individualTierUp.to } });
        }
      }

      useUploadQueueStore.setState(state => {
        const t = state.tasks[task.id];
        if (!t) return {};
        const nextTasks = {
          ...state.tasks,
          [task.id]: {
            ...t,
            clipId: response.clip?.id,
            status: processingRequired ? 'processing' as const : 'completed' as const,
          }
        };
        saveQueueToDisk(nextTasks);
        return { tasks: nextTasks };
      });

      const chunkDir = `${FileSystem.cacheDirectory}uploads/${task.id}/`;
      await FileSystem.deleteAsync(chunkDir, { idempotent: true }).catch(() => {});

      const sourceFiles = task.sourceFiles?.length ? task.sourceFiles : task.filePath ? [task.filePath] : [];
      await Promise.all(sourceFiles.map((sourcePath) =>
        FileSystem.deleteAsync(sourcePath, { idempotent: true }).catch(() => {}),
      ));

      activeFinalizations.delete(task.uploadId);

      if (!processingRequired) {
        setTimeout(() => useUploadQueueStore.getState().clearTask(task.id), 3500);
      }

    } else {
      throw new Error(response.error || "Failed to finalize compilation with the server.");
    }
  } catch (err: any) {
    console.error("[QueueStore] Critical upload finalization error:", err);

    activeFinalizations.delete(task.uploadId);

    // Fire failure alert to device status tray
    const notification = getLocalNotificationText('uploadPausedServer');
    Notifications.scheduleNotificationAsync({
      identifier: 'vlog_upload_progress',
      content: {
        ...notification,
        data: {
          url: createNotificationDeepLink({
            screen: 'record',
            groupId: task.groupId,
            focus: 'upload',
            itemId: task.id,
          }),
        },
      },
      trigger: null,
    }).catch(() => {});

    useUploadQueueStore.setState(state => {
      const nextTasks: Record<string, UploadTask> = {
        ...state.tasks,
        [task.id]: { ...task, status: 'failed' as const }
      };
      saveQueueToDisk(nextTasks);
      return {
        tasks: nextTasks,
        activeTaskId: state.activeTaskId === task.id ? null : state.activeTaskId,
      };
    });
  }
}
