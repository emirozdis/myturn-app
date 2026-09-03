import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert, Image, Keyboard, TouchableWithoutFeedback, ScrollView, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Clock, Check, Play, Send, Users } from 'lucide-react-native';
import Animated, { Easing, Extrapolation, FadeIn, FadeOut, interpolate, KeyboardState, runOnJS, useAnimatedKeyboard, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';

import { ACCENT } from '../../lib/theme';
import { useTodayStore } from '../../store/useTodayStore';
import { useGroupStore } from '../../store/useGroupStore';
import { useUploadQueueStore } from '../../store/useUploadQueueStore';
import { generateThumbnail, generateBlurThumbnail, generateBlurThumbnailFromImage } from './utils';
import { Text } from '../ui/Text';
import { notifyError } from '../../lib/haptics';
import { ActionProgress } from '../ui/ActionProgress';
import { StoryIndicators } from '../today/StoryIndicators';
import { createCompositionMetadata, RecordingSegment } from './types';
import { useHoldToSeekGesture } from '../video/useHoldToSeekGesture';

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function PreviewPublishStep({ recordedSegments, acceptedPrompt, captureMode, onRetake, onPublishQueued, tutorialMode = false, onFinishTutorial }: {
  recordedSegments: RecordingSegment[];
  acceptedPrompt: string | null;
  captureMode: 'photo' | 'snippet' | 'vlog';
  onRetake: () => void;
  onPublishQueued: () => void;
  tutorialMode?: boolean;
  onFinishTutorial?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const todayStore = useTodayStore();
  const groupStore = useGroupStore();

  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState('');
  const [isResolvingLocation, setIsResolvingLocation] = useState(true);
  const locationEdited = useRef(false);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [taskId] = useState(() => Crypto.randomUUID());
  const [previewSegmentIndex, setPreviewSegmentIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<'sequence' | 'segment'>('sequence');
  const [displayedPreviewSegment, setDisplayedPreviewSegment] = useState<RecordingSegment | undefined>(recordedSegments[0]);
  const [isPreviewTransitioning, setIsPreviewTransitioning] = useState(captureMode !== 'photo');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(captureMode !== 'photo');
  const [segmentThumbnails, setSegmentThumbnails] = useState<string[]>([]);
  const [segmentsSectionHeight, setSegmentsSectionHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const previewLoadGeneration = useRef(0);
  const previewSeekStartTimeRef = useRef(0);
  const previewTransitionRef = useRef(captureMode !== 'photo');
  const previewProgress = useSharedValue(0);
  const recordedVideoUri = recordedSegments[0]?.uri || '';
  const activePreviewSegment = recordedSegments[previewSegmentIndex] || recordedSegments[0];
  const canBrowseSegments = captureMode !== 'photo' && recordedSegments.length > 1;

  useEffect(() => {
    let cancelled = false;

    if (captureMode === 'photo') {
      setSegmentThumbnails(recordedVideoUri ? [recordedVideoUri] : []);
      return () => { cancelled = true; };
    }

    const buildThumbnails = async () => {
      const thumbnails: string[] = [];
      for (const segment of recordedSegments) {
        try {
          thumbnails.push(await generateThumbnail(segment.uri, segment.facing, 100));
        } catch {
          thumbnails.push('');
        }
        if (cancelled) return;
        setSegmentThumbnails([...thumbnails]);
      }
    };

    void buildThumbnails();

    return () => { cancelled = true; };
  }, [captureMode, recordedSegments, recordedVideoUri]);

  useEffect(() => {
    let cancelled = false;

    if (tutorialMode) {
      setIsResolvingLocation(false);
      return () => { cancelled = true; };
    }

    const detectLocation = async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (!permission.granted) return;

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [place] = await Location.reverseGeocodeAsync(position.coords);
        if (cancelled || !place || locationEdited.current) return;

        const locality = place.city || place.district || place.subregion || place.region;
        const parts = [locality, place.country].filter(
          (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
        );
        setLocationName(parts.join(', '));
      } catch (error) {
        console.warn('[PreviewPublishStep] Location request failed:', error);
      } finally {
        if (!cancelled) setIsResolvingLocation(false);
      }
    };

    // Ask only after capture has finished. This keeps location tied to the
    // post being published and avoids interrupting the recording flow.
    void detectLocation();
    return () => { cancelled = true; };
  }, [tutorialMode]);

  // Hook reactive parameters directly to our background queue
  const assignmentId = todayStore.assignment?.id as string | undefined;
  const assignmentGroupId = todayStore.assignment?.groupId as string | undefined;

  const uploadTask = useUploadQueueStore(
    (state) => state.tasks[taskId]
  );

  const isUploading = uploadTask ? (uploadTask.status === 'uploading' || uploadTask.status === 'slicing') : false;

  // Real progress tracking calculations
  const uploadProgress = useMemo(() => {
    if (!uploadTask || uploadTask.totalSize === 0) return 0;
    const bytesSent = uploadTask.chunks.reduce((sum, chunk) => sum + chunk.bytesSent, 0);
    return Math.min(100, Math.round((bytesSent / uploadTask.totalSize) * 100));
  }, [uploadTask]);

  const uploadSuccess = uploadTask ? uploadTask.status === 'completed' : false;

  // Load groups on mount
  useEffect(() => {
    async function loadGroups() {
      if (groupStore.groups.length === 0) await groupStore.fetchGroups();
    }
    loadGroups();
  }, []);

  // Publishing is always bound to the assignment's group. Allowing a stale
  // UI-selected group here creates an invalid or cross-group upload request.
  const selectedGroup = useMemo(
    () => groupStore.groups.find((group) => group.id === assignmentGroupId) || null,
    [groupStore.groups, assignmentGroupId],
  );

  // FIX: Initialize with null to prevent AVFoundation "file:///" crash
  const previewPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Play the recording as one logical timeline while retaining the original
  // source files for server-side lossless ordering and speed composition.
  useEffect(() => {
    if (captureMode === 'photo' || !activePreviewSegment?.uri) return;

    const generation = ++previewLoadGeneration.current;
    let cancelled = false;
    let replayRetryTimer: ReturnType<typeof setTimeout> | undefined;
    previewTransitionRef.current = true;
    setIsPreviewTransitioning(true);
    setIsPreviewPlaying(false);

    const loadSegment = async () => {
      try {
        previewPlayer.pause();
        await previewPlayer.replaceAsync(activePreviewSegment.uri);
        if (cancelled || generation !== previewLoadGeneration.current) return;

        previewPlayer.playbackRate = activePreviewSegment.speed;
        setDisplayedPreviewSegment(activePreviewSegment);

        // replaceAsync can leave an AVPlayer that reached playToEnd in its
        // terminal state. replay() resets that state as well as seeking to 0.
        previewPlayer.replay();
        replayRetryTimer = setTimeout(() => {
          if (
            !cancelled
            && generation === previewLoadGeneration.current
            && !previewPlayer.playing
          ) {
            previewPlayer.replay();
          }
        }, 120);
      } catch (err) {
        console.warn("[PreviewPublishStep] Playback failed:", err);
        if (!cancelled && generation === previewLoadGeneration.current) {
          previewTransitionRef.current = false;
          setIsPreviewTransitioning(false);
        }
      }
    };

    void loadSegment();

    return () => {
      cancelled = true;
      if (replayRetryTimer) clearTimeout(replayRetryTimer);
    };
  }, [activePreviewSegment?.id, activePreviewSegment?.uri, activePreviewSegment?.speed, captureMode, previewPlayer]);

  useEffect(() => {
    if (captureMode === 'photo') return;
    const subscription = previewPlayer.addListener('playingChange', ({ isPlaying }) => {
      setIsPreviewPlaying(isPlaying);
      if (isPlaying && previewTransitionRef.current) {
        previewTransitionRef.current = false;
        requestAnimationFrame(() => setIsPreviewTransitioning(false));
      }
    });
    return () => subscription.remove();
  }, [captureMode, previewPlayer]);

  useEffect(() => {
    previewProgress.value = 0;
  }, [activePreviewSegment?.id, previewProgress]);

  useEffect(() => {
    if (captureMode === 'photo') return;
    const interval = setInterval(() => {
      if (!previewPlayer.duration || previewPlayer.currentTime === undefined) return;
      const progress = Math.max(0, Math.min(100, (previewPlayer.currentTime / previewPlayer.duration) * 100));
      previewProgress.value = withTiming(progress, {
        duration: 100,
        easing: Easing.linear,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [captureMode, previewPlayer, previewProgress]);

  useEffect(() => {
    if (captureMode === 'photo') return;
    const subscription = previewPlayer.addListener('playToEnd', () => {
      if (previewTransitionRef.current) return;
      if (previewMode === 'segment' || recordedSegments.length === 1) {
        previewPlayer.replay();
        return;
      }
      previewTransitionRef.current = true;
      previewPlayer.pause();
      setIsPreviewTransitioning(true);
      setPreviewSegmentIndex((current) => (
        current + 1 < recordedSegments.length ? current + 1 : 0
      ));
    });
    return () => subscription.remove();
  }, [captureMode, previewMode, previewPlayer, recordedSegments.length]);

  useEffect(() => {
    previewTransitionRef.current = captureMode !== 'photo';
    setPreviewSegmentIndex(0);
    setPreviewMode('sequence');
    setDisplayedPreviewSegment(recordedSegments[0]);
    setIsPreviewTransitioning(captureMode !== 'photo');
    setIsPreviewPlaying(captureMode !== 'photo');
  }, [recordedSegments]);

  // Pause playback during dynamic uploads to minimize rendering thread CPU consumption
  useEffect(() => {
    if (isUploading && captureMode !== 'photo') {
      try {
        previewPlayer.pause();
      } catch (e) { }
    }
  }, [isUploading, captureMode, previewPlayer]);

  const handlePublish = async () => {
    if (!recordedSegments.length || !assignmentId || !assignmentGroupId || selectedGroup?.id !== assignmentGroupId) {
      Alert.alert("Hata", "Bugünkü görevin grubu doğrulanamadı. Lütfen tekrar deneyin.");
      return;
    }
    Keyboard.dismiss();
    setLocalProcessing(true);

    try {
      // Step 1: Pre-process file thumbnails locally
      let thumbUri = "";
      let thumbBlurUri = "";

      if (captureMode === 'photo') {
        thumbUri = recordedVideoUri;
        thumbBlurUri = await generateBlurThumbnailFromImage(recordedVideoUri);
      } else {
        thumbUri = await generateThumbnail(recordedVideoUri, recordedSegments[0].facing);
        thumbBlurUri = await generateBlurThumbnail(recordedVideoUri, recordedSegments[0].facing);
      }

      setLocalProcessing(false);

      // Step 2: Queue background upload sequence
      const uploadMetadata = captureMode === 'photo'
        ? undefined
        : JSON.stringify({
            ...createCompositionMetadata(recordedSegments),
            ...(captureMode === 'vlog' && acceptedPrompt ? { prompt: acceptedPrompt } : {}),
          });

      await useUploadQueueStore.getState().startUpload(
        taskId,
        assignmentId,
        assignmentGroupId,
        recordedSegments.map((segment) => segment.uri),
        captureMode,
        caption,
        locationName,
        thumbUri,
        uploadMetadata,
      );

      // Let the owning record screen dismiss its native Modal before changing
      // routes. Navigating from inside a still-visible Modal can leave an
      // invisible native root intercepting touches on the destination screen.
      onPublishQueued();

    } catch (e: any) {
      setLocalProcessing(false);
      notifyError();
      Alert.alert("Hata", e.message || "Medya yüklemesi başlatılamadı.");
    }
  };

  const isWorking = isUploading || localProcessing;
  const publishDisabled = isWorking || isResolvingLocation || !selectedGroup;

  const togglePreviewPlayback = () => {
    if (captureMode === 'photo' || isPreviewTransitioning) return;
    try {
      if (previewPlayer.playing) previewPlayer.pause();
      else previewPlayer.play();
    } catch {
      previewPlayer.replay();
    }
  };

  const holdToSeekGesture = useHoldToSeekGesture({
    enabled: captureMode !== 'photo' && !isPreviewTransitioning,
    onHoldStart: () => {
      previewSeekStartTimeRef.current = previewPlayer.currentTime ?? 0;
      previewPlayer.pause();
    },
    onSeek: (translationX, elapsedMs) => {
      if (!previewPlayer.duration) return;
      const speed = Math.min(8, 0.75 + Math.abs(translationX) / 75);
      previewPlayer.currentTime = Math.max(
        0,
        Math.min(previewPlayer.duration, previewSeekStartTimeRef.current + Math.sign(translationX) * speed * (elapsedMs / 1000)),
      );
    },
    onHoldEnd: () => previewPlayer.play(),
  });

  const previewGesture = Gesture.Exclusive(
    holdToSeekGesture,
    Gesture.Tap().runOnJS(true).onEnd(togglePreviewPlayback),
  );

  const selectSegment = (index: number) => {
    if (isWorking || captureMode === 'photo') return;
    setPreviewMode('segment');

    if (index === previewSegmentIndex) {
      previewPlayer.replay();
      return;
    }

    previewTransitionRef.current = true;
    setIsPreviewTransitioning(true);
    setPreviewSegmentIndex(index);
  };

  const keyboard = useAnimatedKeyboard();

  useAnimatedReaction(
    () => keyboard.state.value,
    (state, previousState) => {
      if (
        (state === KeyboardState.OPENING || state === KeyboardState.OPEN) &&
        previousState !== KeyboardState.OPENING &&
        previousState !== KeyboardState.OPEN
      ) {
        runOnJS(setIsKeyboardVisible)(true);
      } else if (
        state === KeyboardState.CLOSED &&
        previousState !== KeyboardState.CLOSED
      ) {
        runOnJS(setIsKeyboardVisible)(false);
      }
    },
  );

  // Reanimated already reports keyboard height on the native transition
  // curve. Following it directly avoids restarting a spring on every frame.
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  const keyboardBackgroundStyle = useAnimatedStyle(() => ({
    height: keyboard.height.value,
  }));

  const segmentsAnimatedStyle = useAnimatedStyle(() => {
    const hiddenProgress = interpolate(
      keyboard.height.value,
      [0, 240],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      height: segmentsSectionHeight > 0
        ? segmentsSectionHeight * (1 - hiddenProgress)
        : undefined,
      opacity: 1 - hiddenProgress,
      transform: [{ translateY: -8 * hiddenProgress }],
    };
  }, [segmentsSectionHeight]);

  const previewAnimatedStyle = useAnimatedStyle(() => ({
    minHeight: interpolate(
      keyboard.height.value,
      [0, 240],
      [190, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const restingFooterPadding = Math.min(Math.max(insets.bottom, 10), 16);
  const footerAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      keyboard.height.value,
      [0, 80],
      [restingFooterPadding, 0],
      Extrapolation.CLAMP,
    ),
  }), [restingFooterPadding]);

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.View style={[styles.screen, containerAnimatedStyle]}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + (canBrowseSegments ? 18 : 6) }]}>
            <TouchableOpacity
              onPress={onRetake}
              disabled={isWorking}
              style={styles.headerButton}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Tekrar çek"
            >
              <ChevronLeft size={22} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>

          </View>

          <Animated.View style={[styles.previewSection, previewAnimatedStyle]}>
            <View style={styles.previewFrame}>
              {captureMode === 'photo' ? (
                <Image
                  source={{ uri: recordedVideoUri }}
                  style={[StyleSheet.absoluteFill, { transform: [{ scaleX: recordedSegments[0]?.facing === 'front' ? -1 : 1 }] }]}
                  resizeMode="cover"
                />
              ) : (
                recordedVideoUri && (
                  <VideoView
                    player={previewPlayer}
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        transform: [{ scaleX: displayedPreviewSegment?.facing === 'front' ? -1 : 1 }],
                      },
                    ]}
                    contentFit="cover"
                    nativeControls={false}
                  />
                )
              )}

              {captureMode !== 'photo' && (
                <GestureDetector gesture={previewGesture}>
                  <View
                    style={styles.mediaTapTarget}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={isPreviewPlaying ? 'Videoyu duraklat' : 'Videoyu oynat'}
                  />
                </GestureDetector>
              )}

              {captureMode !== 'photo' && isPreviewTransitioning && segmentThumbnails[previewSegmentIndex] && (
                <Animated.View
                  entering={FadeIn.duration(70)}
                  exiting={FadeOut.duration(150)}
                  style={styles.previewTransitionCover}
                  pointerEvents="none"
                >
                  <Image
                    source={{ uri: segmentThumbnails[previewSegmentIndex] }}
                    style={[
                      StyleSheet.absoluteFill,
                      { transform: [{ scaleX: activePreviewSegment?.facing === 'front' ? -1 : 1 }] },
                    ]}
                    resizeMode="cover"
                  />
                </Animated.View>
              )}

              {captureMode !== 'photo' && (
                <View
                  style={[styles.indicatorsWrapper, { top: Math.max(insets.top, 12) }]}
                  pointerEvents="none"
                >
                  <StoryIndicators
                    clips={recordedSegments}
                    currentClipSubIndex={previewSegmentIndex}
                    videoProgress={previewProgress}
                  />
                </View>
              )}

              {captureMode !== 'photo' && !isPreviewPlaying && !isPreviewTransitioning && (
                <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(100)} style={styles.playButton} pointerEvents="none">
                  <Play size={24} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                </Animated.View>
              )}

              {acceptedPrompt ? (
                <View style={styles.mediaFooter} pointerEvents="none">
                  <View style={styles.promptContent}>
                    <Text weight="bold" style={styles.promptEyebrow}>KLİP SORUSU</Text>
                    <Text numberOfLines={1} style={styles.promptText}>{acceptedPrompt}</Text>
                  </View>
                </View>
              ) : null}

              {isUploading && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                </View>
              )}
            </View>
          </Animated.View>

          {canBrowseSegments && (
            <Animated.View
              pointerEvents={isKeyboardVisible ? 'none' : 'auto'}
              style={[styles.segmentsClip, segmentsAnimatedStyle]}
            >
              <View
                style={styles.segmentsSection}
                onLayout={({ nativeEvent }) => {
                  const nextHeight = nativeEvent.layout.height;
                  // Capture only the expanded height. Accepting smaller
                  // measurements while the wrapper collapses creates a
                  // JS/UI-thread feedback loop and visible jitter.
                  setSegmentsSectionHeight((currentHeight) =>
                    nextHeight > currentHeight ? nextHeight : currentHeight
                  );
                }}
              >
                <View style={styles.segmentsHeader}>
                  <Text weight="bold" style={styles.sectionTitle}>Klipler</Text>
                  <Text style={styles.sectionHint}>Ayrı izlemek için bir klibe dokun</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.segmentRail}
                  keyboardShouldPersistTaps="handled"
                >
                  {recordedSegments.map((segment, index) => {
                    const isSelected = previewMode === 'segment' && previewSegmentIndex === index;
                    return (
                      <TouchableOpacity
                        key={segment.id}
                        onPress={() => selectSegment(index)}
                        disabled={isWorking}
                        style={[styles.segmentCard, isSelected && styles.segmentCardActive]}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel={`Klip ${index + 1}, ${formatDuration(segment.durationMs / segment.speed)}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        {segmentThumbnails[index] ? (
                          <Image
                            source={{ uri: segmentThumbnails[index] }}
                            style={[
                              StyleSheet.absoluteFill,
                              { transform: [{ scaleX: segment.facing === 'front' ? -1 : 1 }] },
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.segmentFallback} />
                        )}
                        <View style={styles.segmentNumber}>
                          <Text weight="bold" style={styles.segmentNumberText}>{index + 1}</Text>
                        </View>
                        {segment.speed === 2 ? <Text weight="bold" style={styles.segmentSpeed}>2×</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Animated.View>
          )}

          <View style={styles.postDetails}>
            <View style={styles.captionRow}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Bir açıklama yaz..."
                placeholderTextColor="rgba(255,255,255,0.34)"
                multiline
                maxLength={45}
                style={styles.captionInput}
              />
              <Text weight="bold" style={styles.captionCounter}>{caption.length}/45</Text>
            </View>

            <View style={styles.metadataRow}>
              <View style={styles.locationRow}>
                <View style={styles.detailIcon}>
                  <MapPin size={14} color="rgba(255,255,255,0.74)" />
                </View>
                <TextInput
                  value={locationName}
                  onChangeText={(value) => {
                    locationEdited.current = true;
                    setLocationName(value);
                  }}
                  style={styles.locationInput}
                  maxLength={60}
                  placeholder={isResolvingLocation ? 'Konum alınıyor...' : 'Konum ekle'}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>

              <View style={styles.timeRow}>
                <Clock size={13} color="rgba(255,255,255,0.4)" />
                <Text weight="medium" style={styles.metadataText}>9AM–12PM</Text>
              </View>
            </View>

            {tutorialMode ? (
              <View style={styles.audienceRow}>
                <View style={styles.groupAvatar}><Check size={16} color="#fff" /></View>
                <View style={styles.publishTarget}>
                  <Text style={styles.publishEyebrow}>REHBER ÖN İZLEMESİ</Text>
                  <Text weight="bold" style={styles.publishGroupName}>Bu kayıt grubunla paylaşılmayacak.</Text>
                </View>
              </View>
            ) : (
              <View style={styles.audienceRow}>
                <View style={styles.groupAvatar}>
                  <Text style={styles.groupEmoji}>🏠</Text>
                </View>
                <View style={styles.publishTarget}>
                  <Text style={styles.publishEyebrow}>PAYLAŞIM HEDEFİ</Text>
                  <View style={styles.publishGroupLine}>
                    <Text weight="bold" numberOfLines={1} style={styles.publishGroupName}>{selectedGroup?.name || 'Grup yükleniyor'}</Text>
                    <View style={styles.memberCount}>
                      <Users size={10} color="rgba(255,255,255,0.45)" />
                      <Text weight="bold" style={styles.memberCountText}>{selectedGroup?.memberCount || 0}</Text>
                    </View>
                  </View>
                </View>
                <Text weight="medium" style={styles.audienceType}>Görev grubu</Text>
              </View>
            )}
          </View>

          <Animated.View style={[styles.shareFooter, footerAnimatedStyle]}>
            <TouchableOpacity
              onPress={tutorialMode ? onFinishTutorial : handlePublish}
              disabled={!tutorialMode && publishDisabled}
              style={[styles.publishBtn, !tutorialMode && publishDisabled && styles.publishBtnDisabled]}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${selectedGroup?.name || 'Seçili grup'} grubunda paylaş`}
            >
              {tutorialMode ? (
                <>
                  <Text weight="bold" style={styles.publishBtnText}>Rehberi Bitir</Text>
                  <Check size={15} color="#fff" strokeWidth={2.5} />
                </>
              ) : isResolvingLocation ? (
                <ActionProgress color="#fff" label="Konum alınıyor" />
              ) : isWorking ? (
                <ActionProgress color="#fff" label={uploadTask?.status === 'slicing' ? 'Video hazırlanıyor' : `Yükleniyor · %${uploadProgress}`} />
              ) : (
                  <>
                    <Text weight="bold" style={styles.publishBtnText}>Paylaş</Text>
                    <Send size={15} color="#fff" strokeWidth={2.5} />
                  </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>

      <Animated.View
        pointerEvents="none"
        style={[styles.keyboardBackground, keyboardBackgroundStyle]}
      />

      {uploadSuccess && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.successOverlay} className="absolute inset-0 z-50 bg-black/95 justify-center items-center p-6">
          <View className="mb-6"><Check size={44} color="#22c55e" strokeWidth={3.5} /></View>
          <Text weight="bold" className="text-white text-lg mb-1">Vlog Paylaşıldı!</Text>
          <Text className="text-white/50 text-xs text-center max-w-[200px] leading-relaxed">Güncellemeniz grubunuza yüklendi ve arkadaşlarınıza duyuruldu.</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0C' },
  screen: { flex: 1, minHeight: 0, backgroundColor: '#0B0B0C' },
  keyboardBackground: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    backgroundColor: '#0B0B0C',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSection: { flex: 1, minHeight: 190 },
  previewFrame: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  mediaTapTarget: { ...StyleSheet.absoluteFill, zIndex: 8 },
  previewTransitionCover: { ...StyleSheet.absoluteFill, zIndex: 9, overflow: 'hidden' },
  indicatorsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
  },
  playButton: {
    position: 'absolute',
    zIndex: 19,
    left: '50%',
    top: '50%',
    marginLeft: -28,
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mediaFooter: { position: 'absolute', left: 14, right: 14, bottom: 14, zIndex: 18, alignItems: 'flex-start', gap: 8 },
  promptContent: {
    maxWidth: '88%',
  },
  promptEyebrow: { fontSize: 7, color: ACCENT, letterSpacing: 0.8, marginBottom: 1 },
  promptText: { fontSize: 11, color: '#fff', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: '#171717', zIndex: 30, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: ACCENT },
  segmentsClip: { overflow: 'hidden' },
  segmentsSection: { paddingTop: 12, paddingBottom: 14 },
  segmentsHeader: { paddingHorizontal: 16, marginBottom: 8, gap: 1 },
  sectionTitle: { fontSize: 12, color: '#fff', letterSpacing: -0.1 },
  sectionHint: { marginTop: 1, fontSize: 9, color: 'rgba(255,255,255,0.36)' },
  segmentRail: { paddingHorizontal: 16, gap: 8 },
  segmentCard: {
    width: 90,
    height: 70,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#191919',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  segmentCardActive: { borderColor: ACCENT },
  segmentFallback: { ...StyleSheet.absoluteFill, backgroundColor: '#141416' },
  segmentNumber: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentNumberText: { fontSize: 8, color: '#fff' },
  segmentSpeed: { position: 'absolute', right: 7, bottom: 7, fontSize: 8, color: '#111', backgroundColor: ACCENT, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1 },
  postDetails: { paddingHorizontal: 16 },
  captionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.075)',
  },
  groupAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.065)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  groupEmoji: { fontSize: 14 },
  captionInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 58,
    paddingVertical: 11,
    paddingHorizontal: 0,
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Satoshi-Regular',
  },
  captionCounter: { alignSelf: 'flex-end', marginBottom: 10, marginLeft: 10, fontSize: 8, color: 'rgba(255,255,255,0.26)' },
  metadataRow: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.075)',
  },
  locationRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  detailIcon: { width: 30, height: 30, alignItems: 'flex-start', justifyContent: 'center' },
  locationInput: { flex: 1, minWidth: 0, paddingVertical: 0, paddingHorizontal: 0, color: '#fff', fontSize: 11, fontFamily: 'Satoshi-Medium' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12 },
  metadataText: { fontSize: 9, color: 'rgba(255,255,255,0.58)' },
  audienceRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  publishTarget: { flex: 1, minWidth: 0 },
  publishEyebrow: { fontSize: 7, color: 'rgba(255,255,255,0.32)', letterSpacing: 0.75, marginBottom: 3 },
  publishGroupLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  publishGroupName: { flexShrink: 1, fontSize: 12, color: '#fff' },
  memberCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  memberCountText: { fontSize: 8, color: 'rgba(255,255,255,0.44)' },
  audienceType: { fontSize: 9, color: 'rgba(255,255,255,0.34)' },
  shareFooter: { paddingHorizontal: 16, paddingTop: 8 },
  publishBtn: {
    alignSelf: 'stretch',
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishBtnDisabled: { backgroundColor: '#2d2d2d' },
  publishBtnText: { fontSize: 13, color: '#fff' },
  successOverlay: { alignItems: 'center', justifyContent: 'center' },
});
