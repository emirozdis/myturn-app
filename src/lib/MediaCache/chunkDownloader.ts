import * as FileSystem from 'expo-file-system/legacy';
import { cacheStore } from './cacheStore';

const debugMediaCache = (...args: unknown[]) => console.log('[DEBUG][MediaCache]', ...args);

export const CACHE_BASE_DIR = `${FileSystem.cacheDirectory}media_cache/`;
export const CHUNKS_DIR = `${CACHE_BASE_DIR}chunks/`;
export const PLAYLISTS_DIR = `${CACHE_BASE_DIR}playlists/`;

interface DownloadTask {
  clipId: string;
  chunkKey: string;
  absoluteUrl: string;
  resLevel: number;
}

const downloadQueue: DownloadTask[] = [];
const activeKeys = new Set<string>();
let activeDownloads = 0;
const MAX_CONCURRENT_DOWNLOADS = 3;

async function ensureDirectories() {
  await FileSystem.makeDirectoryAsync(CHUNKS_DIR, { intermediates: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(PLAYLISTS_DIR, { intermediates: true }).catch(() => {});
}

export function enqueueChunkDownload(task: DownloadTask) {
  // Prevent duplicate queuing of the exact same chunk
  const duplicate = activeKeys.has(task.chunkKey) || downloadQueue.some(t => t.chunkKey === task.chunkKey && t.resLevel === task.resLevel);
  if (duplicate) {
    debugMediaCache('[chunkDownloader] duplicate-queue-skip', { clipId: task.clipId, chunkKey: task.chunkKey, resLevel: task.resLevel, queueDepth: downloadQueue.length });
    return;
  }
  downloadQueue.push(task);
  debugMediaCache('[chunkDownloader] enqueue', { clipId: task.clipId, chunkKey: task.chunkKey, resLevel: task.resLevel, queueDepth: downloadQueue.length, activeDownloads });
  processQueue();
}

export function clearPendingDownloads() {
  downloadQueue.splice(0, downloadQueue.length);
  debugMediaCache('[chunkDownloader] clear-pending-queue', { queueDepth: downloadQueue.length, activeDownloads });
}

async function processQueue() {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS || downloadQueue.length === 0) {
    debugMediaCache('[chunkDownloader] queue-wait', { activeDownloads, queueDepth: downloadQueue.length, maxConcurrent: MAX_CONCURRENT_DOWNLOADS });
    return;
  }

  const task = downloadQueue.shift();
  if (!task) return;

  activeDownloads++;
  activeKeys.add(task.chunkKey);
  debugMediaCache('[chunkDownloader] download-start', {
    clipId: task.clipId,
    chunkKey: task.chunkKey,
    resLevel: task.resLevel,
    activeDownloads,
    queueDepth: downloadQueue.length,
  });

  try {
    await ensureDirectories();

    const tempFile = `${CHUNKS_DIR}temp_${Math.random().toString(36).substring(7)}.ts`;
    const finalFile = `${CHUNKS_DIR}${task.chunkKey}_res${task.resLevel}.ts`;

    // Download to temp file
    const downloadRes = await FileSystem.downloadAsync(task.absoluteUrl, tempFile);
    if (downloadRes.status !== 200) {
      debugMediaCache('[chunkDownloader] download-http-failed', { clipId: task.clipId, chunkKey: task.chunkKey, resLevel: task.resLevel, status: downloadRes.status, tempFile });
      throw new Error(`Failed to download chunk, HTTP ${downloadRes.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(tempFile);
    if (!fileInfo.exists || !('size' in fileInfo)) {
      debugMediaCache('[chunkDownloader] download-file-missing', { clipId: task.clipId, chunkKey: task.chunkKey, resLevel: task.resLevel, tempFile });
      throw new Error('Downloaded chunk file missing or size unresolved.');
    }

    // Rule 3: Higher Quality Replacement (Delete old lower quality cache)
    const existingCache = cacheStore.getChunk(task.chunkKey);
    if (existingCache) {
      debugMediaCache('[chunkDownloader] replacing-existing-cache', { clipId: task.clipId, chunkKey: task.chunkKey, existingPath: existingCache.localPath, newPath: finalFile });
      await FileSystem.deleteAsync(existingCache.localPath, { idempotent: true }).catch(() => {});
    }

    // Move to final destination
    await FileSystem.moveAsync({ from: tempFile, to: finalFile });

    // Register into cache store
    cacheStore.addChunk({
      chunkKey: task.chunkKey,
      localPath: finalFile,
      resLevel: task.resLevel,
      byteSize: fileInfo.size as number,
      downloadedAt: Date.now(),
      lastAccessed: Date.now(),
    });

    debugMediaCache('[chunkDownloader] download-success', { clipId: task.clipId, chunkKey: task.chunkKey, resLevel: task.resLevel, bytes: fileInfo.size, finalFile, queueDepth: downloadQueue.length });

  } catch (error) {
    debugMediaCache('[chunkDownloader] download-failed', { clipId: task.clipId, chunkKey: task.chunkKey, resLevel: task.resLevel, error: error instanceof Error ? error.message : String(error), queueDepth: downloadQueue.length });
    // Silently ignore dropouts; it will retry dynamically next loop
  } finally {
    activeDownloads--;
    activeKeys.delete(task.chunkKey);
    processQueue();
  }
}
