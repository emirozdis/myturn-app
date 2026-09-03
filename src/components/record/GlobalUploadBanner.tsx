// src/components/record/GlobalUploadBanner.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { StyleSheet, View, Dimensions, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, AlertTriangle, RefreshCw, X, ChevronDown, Trash2, Play } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing,
  runOnJS,
  FadeInUp
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import { UploadTask, useUploadQueueStore } from '../../store/useUploadQueueStore';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';
import { selectionTick, lightTap, notifyWarning } from '../../lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TUCKED_OFFSET = -280;
const SNAP_ANIMATION = { duration: 240, easing: Easing.out(Easing.cubic) };

function getTaskProgress(task: UploadTask) {
  if (!task.totalSize) return 0;
  const sent = task.chunks.reduce((sum, chunk) => sum + chunk.bytesSent, 0);
  return Math.min(100, Math.round((sent / task.totalSize) * 100));
}

function getCompactStatus(task: UploadTask, progress: number) {
  if (task.status === 'completed') return 'Hazır';
  if (task.status === 'processing') return 'İşleniyor';
  if (task.status === 'failed') return 'Hata';
  if (task.status === 'paused') return 'Bekliyor';
  if (task.status === 'slicing') return 'Hazırlanıyor';
  return `%${progress}`;
}

export function GlobalUploadBanner() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const tasks = useUploadQueueStore((state) => state.tasks);
  const bannerRevealRequest = useUploadQueueStore((state) => state.bannerRevealRequest);
  const setBannerTucked = useUploadQueueStore((state) => state.setBannerTucked);

  // Core Hooks declared safely at absolute top
  const translateY = useSharedValue(0);
  const isTucked = useSharedValue(false);
  const [localTucked, setLocalTucked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const previousTaskIdsRef = useRef<string[]>([]);

  const taskList = useMemo(() => Object.values(tasks), [tasks]);
  const taskIdsKey = useMemo(() => taskList.map((task) => task.id).join('|'), [taskList]);
  const activeTask = useMemo(() => {
    if (!taskList.length) return null;
    return taskList.find((task) => task.id === selectedTaskId) || taskList[taskList.length - 1];
  }, [selectedTaskId, taskList]);
  const isToday = pathname === '/today' || pathname === '/(app)/today';

  const aggregateProgress = useMemo(() => {
    const totalBytes = taskList.reduce((sum, task) => sum + task.totalSize, 0);
    if (!totalBytes) return 0;
    const sentBytes = taskList.reduce(
      (sum, task) => sum + task.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.bytesSent, 0),
      0,
    );
    return Math.min(100, Math.round((sentBytes / totalBytes) * 100));
  }, [tasks]);

  const progress = useMemo(() => {
    return activeTask ? getTaskProgress(activeTask) : 0;
  }, [activeTask]);

  // Select the newest task when the set changes, while preserving manual
  // selection across ordinary progress updates.
  useEffect(() => {
    const currentTaskIds = taskList.map((task) => task.id);
    const addedTaskIds = currentTaskIds.filter((taskId) => !previousTaskIdsRef.current.includes(taskId));
    const newestTask = taskList[taskList.length - 1];

    if (addedTaskIds.length) {
      setSelectedTaskId(addedTaskIds[addedTaskIds.length - 1]);
      translateY.value = withTiming(0, SNAP_ANIMATION);
      isTucked.value = false;
      setLocalTucked(false);
      setBannerTucked(false);
      setShowConfirm(false);
    } else if (newestTask && !currentTaskIds.includes(selectedTaskId || '')) {
      setSelectedTaskId(newestTask.id);
      setShowConfirm(false);
    } else {
      if (!newestTask) setSelectedTaskId(null);
    }

    previousTaskIdsRef.current = currentTaskIds;
  }, [setBannerTucked, taskIdsKey]);

  const processingTaskIds = useMemo(
    () => taskList.filter((task) => task.status === 'processing').map((task) => task.id),
    [taskList],
  );
  const processingTaskIdsKey = processingTaskIds.join('|');
  useEffect(() => {
    if (!processingTaskIds.length) return;
    const checkAllProcessingTasks = () => {
      processingTaskIds.forEach((taskId) => {
        void useUploadQueueStore.getState().checkProcessingTask(taskId);
      });
    };
    checkAllProcessingTasks();
    const interval = setInterval(() => {
      checkAllProcessingTasks();
    }, 8000);
    return () => clearInterval(interval);
  }, [processingTaskIdsKey]);

  // --- Pan Gesture Handler Setup ---
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .onUpdate((e) => {
        if (isTucked.value) {
          // Dragging down from off-screen
          translateY.value = Math.max(TUCKED_OFFSET, TUCKED_OFFSET + e.translationY);
        } else {
          // Dragging up to hide
          translateY.value = Math.min(15, e.translationY);
        }
      })
      .onEnd((e) => {
        if (isTucked.value) {
          if (e.translationY > 40 || e.velocityY > 300) {
            translateY.value = withTiming(0, SNAP_ANIMATION);
            isTucked.value = false;
            runOnJS(setLocalTucked)(false);
            runOnJS(setBannerTucked)(false);
          } else {
            translateY.value = withTiming(TUCKED_OFFSET, SNAP_ANIMATION);
          }
        } else {
          if (e.translationY < -40 || e.velocityY < -300) {
            translateY.value = withTiming(TUCKED_OFFSET, SNAP_ANIMATION);
            isTucked.value = true;
            runOnJS(setLocalTucked)(true);
            runOnJS(setBannerTucked)(true);
          } else {
            translateY.value = withTiming(0, SNAP_ANIMATION);
          }
        }
      });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!bannerRevealRequest || !isTucked.value) return;
    translateY.value = withTiming(0, SNAP_ANIMATION);
    isTucked.value = false;
    setLocalTucked(false);
    setBannerTucked(false);
  }, [bannerRevealRequest, setBannerTucked]);

  if (!activeTask) {
    return null;
  }

  const isSlicing = activeTask.status === 'slicing';
  const isFailed = activeTask.status === 'failed';
  const isCompleted = activeTask.status === 'completed';
  const isProcessing = activeTask.status === 'processing';
  const isPaused = activeTask.status === 'paused';

  const forceToggleReveal = () => {
    selectionTick();
    if (isTucked.value) {
      translateY.value = withTiming(0, SNAP_ANIMATION);
      isTucked.value = false;
      setLocalTucked(false);
      setBannerTucked(false);
    } else {
      translateY.value = withTiming(TUCKED_OFFSET, SNAP_ANIMATION);
      isTucked.value = true;
      setLocalTucked(true);
      setBannerTucked(true);
    }
  };

  const handleRetry = () => {
    lightTap();
    useUploadQueueStore.getState().retryFailedTask(activeTask.id);
  };

  const triggerCancelConfirmation = () => {
    notifyWarning();
    setShowConfirm(true);
    useUploadQueueStore.getState().pauseUpload(activeTask.id);
  };

  const handleKeepUploading = () => {
    lightTap();
    setShowConfirm(false);
    useUploadQueueStore.getState().retryFailedTask(activeTask.id);
  };

  const handleConfirmCancel = () => {
    lightTap();
    setShowConfirm(false);
    useUploadQueueStore.getState().clearTask(activeTask.id);
  };

  return (
    <View style={[styles.absoluteContainer, { top: Math.max(insets.top, 12) + 6 }]} pointerEvents="box-none">
      
      {/* 1. MAIN COLLAPSIBLE CARD */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.cardWrapper, animatedStyle]} pointerEvents="box-none">
          <View style={styles.glassCard}>
            
            {showConfirm ? (
              // --- CONFIRMATION DIALOG INTERFACE ---
              <View style={styles.confirmContainer}>
                <View className="flex-row items-center gap-4 mb-4">
                  <View style={[styles.iconWrapper, styles.iconWrapperError, { width: 34, height: 34, borderRadius: 10 }]}>
                    <Trash2 size={16} color="#f87171" />
                  </View>
                  <View className="flex-1">
                    <Text weight="bold" style={styles.primaryText} className="leading-tight">Yükleme İptal Edilsin mi?</Text>
                    <Text style={styles.secondaryText} className="mt-1 leading-relaxed">Bu işlem vlog kaydını cihazınızdan ve buluttan kalıcı olarak silecektir.</Text>
                  </View>
                </View>

                <View className="flex-row gap-3 justify-end mt-1">
                  <TouchableOpacity onPress={handleConfirmCancel} style={styles.confirmCancelBtn} activeOpacity={0.8}>
                    <Text weight="bold" style={{ color: '#f87171', fontSize: 11.5 }} className="uppercase tracking-wider font-extrabold">Yüklemeyi Sil</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleKeepUploading} style={styles.resumeBtn} activeOpacity={0.85}>
                    <Play size={10} color="#000" fill="#000" style={{ marginRight: 6 }} />
                    <Text weight="bold" style={{ color: '#000000', fontSize: 11.5 }} className="font-black">Yüklemeye Devam Et</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // --- STANDARD PROGRESS STATUS INTERFACE ---
              <>
                <View style={styles.headerRow}>
                  <View style={styles.metaRow}>
                    <View style={styles.previewWrapper}>
                      {activeTask.previewPath ? (
                        <Image source={{ uri: activeTask.previewPath }} style={styles.previewImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.previewFallback} />
                      )}
                      <View style={[styles.statusBadge, isCompleted && styles.statusBadgeSuccess, isFailed && styles.statusBadgeError]}>
                        {isProcessing ? <ActivityIndicator size={9} color="#fff" /> : isCompleted ? (
                          <CheckCircle size={10} color="#fff" />
                        ) : isFailed || isPaused ? (
                          <AlertTriangle size={10} color="#fff" />
                        ) : (
                          <Text weight="bold" style={styles.badgeProgress}>{progress}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.metaCopy}>
                      <View style={styles.titleRow}>
                        <Text weight="bold" style={styles.primaryText} className="leading-tight" numberOfLines={1}>
                          {isCompleted
                            ? activeTask.responseId ? "Yanıt hazır" : "Paylaşım hazır"
                            : isProcessing
                              ? activeTask.responseId ? "Yanıt hazırlanıyor" : "Moment hazırlanıyor"
                              : isFailed ? "Yükleme duraklatıldı" : isPaused ? "Yükleme bekletiliyor" : isSlicing ? "Medya hazırlanıyor" : "Medya yükleniyor"}
                        </Text>
                        {taskList.length > 1 && (
                          <View style={styles.taskCountBadge}>
                            <Text weight="bold" style={styles.taskCountText}>{taskList.length}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.secondaryText} className="mt-0.5" numberOfLines={1}>
                        {isCompleted
                          ? activeTask.responseId ? "Video yanıtın artık görünüyor" : "Artık grubunda görünüyor"
                          : isProcessing ? "Bitince haber vereceğiz • Uygulamayı kapatabilirsin" : isSlicing ? "Yükleme için hazırlanıyor" : isPaused ? "Devam etmek için aç" : isFailed ? "Bağlantını kontrol edip tekrar dene" : `%${progress} tamamlandı`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rightControlGroup}>
                    {isFailed && !activeTask.clipId && (
                      <TouchableOpacity onPress={handleRetry} style={styles.miniActionBtn} activeOpacity={0.7}>
                        <RefreshCw size={11} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {!isCompleted && !isProcessing && (
                      <TouchableOpacity onPress={triggerCancelConfirmation} style={styles.closeBtn} activeOpacity={0.7}>
                        <X size={11} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {taskList.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.taskSwitcher}
                  >
                    {taskList.map((task, index) => {
                      const taskProgress = getTaskProgress(task);
                      const selected = task.id === activeTask.id;
                      const taskFailed = task.status === 'failed' || task.status === 'paused';
                      const taskComplete = task.status === 'completed';
                      return (
                        <TouchableOpacity
                          key={task.id}
                          onPress={() => {
                            selectionTick();
                            setSelectedTaskId(task.id);
                            setShowConfirm(false);
                          }}
                          style={[styles.taskChip, selected && styles.taskChipSelected]}
                          activeOpacity={0.75}
                        >
                          {task.previewPath ? (
                            <Image source={{ uri: task.previewPath }} style={styles.taskChipPreview} />
                          ) : (
                            <View style={styles.taskChipPreviewFallback} />
                          )}
                          <View style={styles.taskChipCopy}>
                            <Text weight="bold" style={styles.taskChipTitle} numberOfLines={1}>
                              {task.mediaType === 'photo' ? 'Fotoğraf' : task.mediaType === 'snippet' ? 'Snippet' : `Vlog ${index + 1}`}
                            </Text>
                            <Text style={[styles.taskChipStatus, taskFailed && styles.taskChipStatusError, taskComplete && styles.taskChipStatusSuccess]}>
                              {getCompactStatus(task, taskProgress)}
                            </Text>
                          </View>
                          <View style={styles.taskChipTrack}>
                            <View
                              style={[
                                styles.taskChipBar,
                                taskFailed && styles.taskChipBarError,
                                taskComplete && styles.taskChipBarSuccess,
                                { width: `${taskComplete ? 100 : taskProgress}%` },
                              ]}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Progress Bar */}
                {!isCompleted && !isFailed && !isProcessing && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                  </View>
                )}

                {/* Drag Indicator */}
                <View style={styles.dragIndicatorWrapper}>
                  <View style={styles.dragLine} />
                </View>
              </>
            )}

          </View>
        </Animated.View>
      </GestureDetector>

      {/* 2. REVEAL GRAB TAB (Visible at top only when hidden) */}
      {localTucked && !isToday && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.tuckedTabWrapper} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.8} onPress={forceToggleReveal} style={styles.tuckedTabTouch}>
            <View style={styles.tuckedTab}>
              {activeTask.previewPath && <Image source={{ uri: activeTask.previewPath }} style={styles.tuckedPreview} />}
              {isProcessing && <ActivityIndicator size="small" color={ACCENT} style={{ marginLeft: 6 }} />}
              <Text weight="bold" style={{ color: '#ffffff', fontSize: 10, marginLeft: 6, fontFamily: 'Satoshi-Bold' }}>
                {taskList.length > 1 ? `${taskList.length} yükleme • ${aggregateProgress}%` : isProcessing ? "İşleniyor" : isCompleted ? "Hazır" : `${progress}%`}
              </Text>
              <ChevronDown size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  cardWrapper: {
    width: '100%',
  },
  glassCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)', // spec-depth outline
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4, 
    backgroundColor: '#161618', // rich solid velvet background guarantees 100% text legibility
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  metaCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  taskCountBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,124,48,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(224,124,48,0.3)',
  },
  taskCountText: {
    color: ACCENT,
    fontSize: 9,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 13.5,
  },
  secondaryText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10.5,
    maxWidth: SCREEN_WIDTH - 150,
  },
  previewWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: 'visible',
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#252529',
  },
  previewFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#252529',
  },
  statusBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: '#161618',
  },
  statusBadgeSuccess: { backgroundColor: '#22c55e' },
  statusBadgeError: { backgroundColor: '#ef4444' },
  badgeProgress: { color: '#fff', fontSize: 7 },
  tuckedPreview: {
    width: 22,
    height: 22,
    borderRadius: 7,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(224, 124, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224, 124, 48, 0.15)',
  },
  iconWrapperSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  iconWrapperError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.22)',
  },
  iconWrapperPaused: {
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  rightControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  taskSwitcher: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    paddingRight: 2,
  },
  taskChip: {
    width: 112,
    height: 48,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  taskChipSelected: {
    borderColor: 'rgba(224,124,48,0.5)',
    backgroundColor: 'rgba(224,124,48,0.08)',
  },
  taskChipPreview: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#252529',
  },
  taskChipPreviewFallback: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#252529',
  },
  taskChipCopy: {
    flex: 1,
    minWidth: 0,
  },
  taskChipTitle: {
    color: '#fff',
    fontSize: 9.5,
  },
  taskChipStatus: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 8,
    marginTop: 1,
  },
  taskChipStatusError: { color: '#f87171' },
  taskChipStatusSuccess: { color: '#4ade80' },
  taskChipTrack: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 3,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  taskChipBar: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: ACCENT,
  },
  taskChipBarError: { backgroundColor: '#ef4444' },
  taskChipBarSuccess: { backgroundColor: '#22c55e' },
  progressTrack: {
    height: 3.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1.75,
    overflow: 'hidden',
    marginTop: 12,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 1.75,
  },
  dragIndicatorWrapper: {
    width: '100%',
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dragLine: {
    width: 28,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tuckedTabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    top: -4,
  },
  tuckedTabTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuckedTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#161618',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmContainer: {
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  alertIconOuter: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  confirmCancelBtn: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(239,68,68,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
