"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Modal,
  Alert,
  Share
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Play,
  Navigation,
  Heart,
  MessageCircle,
  Eye,
  Camera,
  MoreVertical
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  FadeInUp,
  FadeOutUp,
  FadeOut
} from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { apiClient } from '../../lib/apiClient';
import { appCheckFetch } from '../../lib/appCheck';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { GlassView } from '../ui/GlassView';
import { PhotoResponsesOverlay } from '../today/PhotoResponsesOverlay';
import { CommentsSheet } from '../today/CommentsSheet';
import { ViewsSheet } from '../today/ViewsSheet';
import { ACCENT } from '../../lib/theme';
import { useProfileStore } from '../../store/useProfileStore';
import { storage } from '../../lib/storage';
import { notifySuccess, lightTap } from '../../lib/haptics';
import { prepareCachedPhoto } from '../../lib/MediaCache';
import { getHlsPlaybackUrl, prepareAndroidHlsPlayback } from '../../lib/hlsPlayback';
import { useHoldToSeekGesture } from '../video/useHoldToSeekGesture';
import { parseMediaMetadata } from '../../lib/mediaMetadata';
import { LiveGuideCoachmark } from '../guides/LiveGuideCoachmark';
import type { GuideMotion, GuideStep } from '../guides/guideContent';

// Import split modular subcomponents
import { LoopingCommentPreview } from './LoopingCommentPreview';
import { StreakCarousel } from './StreakCarousel';
import { FloatingFeedNode, type FloatingFeedItem } from './FloatingFeedNode';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function isFrontFacing(clip: any): boolean {
  if (!clip?.metadata) return true;
  try {
    const meta = parseMediaMetadata(clip.metadata);
    if (!meta) return false;
    return meta.facingMode !== "environment";
  } catch {
    return true;
  }
}

// Resolves a possibly-bare storage key into an absolute URL. Used for any
// media reference (photo responses, etc.) that gets handed to a native
// <Image> — an unresolved/no-scheme uri reaching native image loading has
// caused hard crashes in release builds, so nothing should skip this.
function resolveMediaUrl(value?: string | null): string | null {
  const normalizedValue = value?.trim();

  if (!normalizedValue) return null;
  if (/^(https?|file|content):\/\//i.test(normalizedValue)) return normalizedValue;
  if (normalizedValue.startsWith('/')) return `${apiClient.getBaseUrl()}${normalizedValue}`;

  return `${apiClient.getBaseUrl()}/api/media/vlogs/${normalizedValue}`;
}

export interface StreakVideoLayerRef {
  replay: () => void;
  pause: () => void;
  play: () => void;
  getCurrentTime: () => number;
  seekFrom: (startTime: number, translationX: number, elapsedMs: number) => void;
}

const StreakVideoLayer = forwardRef<StreakVideoLayerRef, {
  clip: any;
  isCurrent: boolean;
  isPaused: boolean;
  onProgress: (prog: number) => void;
  onEnd: () => void;
}>(({ clip, isCurrent, isPaused, onProgress, onEnd }, ref) => {
  const alwaysHighestQuality = useProfileStore((state) => state.alwaysHighestQuality);
  const url = useMemo(() => {
    if (!clip) return "";
    const isPhoto = clip.mediaType === 'photo';
    const targetPath = isPhoto
      ? clip.videoUrl
      : clip.hlsUrl
        ? getHlsPlaybackUrl(clip.hlsUrl, alwaysHighestQuality)
        : '';

    if (!targetPath) return "";
    if (/^(https?|file|content):\/\//.test(targetPath)) return targetPath;
    return `${apiClient.getBaseUrl()}/api/media/vlogs/${targetPath}`;
  }, [clip, alwaysHighestQuality]);

  const blurUrl = clip.thumbnailBlurUrl || clip.thumbnailUrl;
  const metadata = useMemo(() => {
    return parseMediaMetadata(clip.metadata);
  }, [clip.metadata]);

  const isPhoto = metadata?.mediaType === 'photo' || clip.mediaType === 'photo';
  const isFront = metadata?.facingMode === 'front' || metadata?.facingMode === 'user' || metadata?.facingMode === 'selfie';
  const mediaPlaybackStyle = { transform: [{ scaleX: isFront ? -1 : 1 }] };

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(url);
  const playbackStateRef = useRef({ isCurrent, isPaused });
  const onEndRef = useRef(onEnd);
  const didHandleEndRef = useRef(false);
  const hasRenderedFrameRef = useRef(false);
  const maxPlaybackTimeRef = useRef(0);
  const lastProgressLogSecondRef = useRef(-1);
  const lastPlaybackRecoveryAtRef = useRef(0);
  const isMountedRef = useRef(true);
  playbackStateRef.current = { isCurrent, isPaused };
  onEndRef.current = onEnd;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsVideoLoaded(false);
    setVideoError(false);
    didHandleEndRef.current = false;
    hasRenderedFrameRef.current = false;
    maxPlaybackTimeRef.current = 0;
    lastProgressLogSecondRef.current = -1;
  }, [clip.id, url]);

  useEffect(() => {
    if (!isPhoto || !url) return;
    let isActive = true;
    setPhotoUri(url);
    prepareCachedPhoto(url)
      .then((cachedUri) => {
        if (isActive) {
          setIsVideoLoaded(false);
          setPhotoUri(cachedUri);
        }
      })
      .catch((error) => console.warn('[StreakVideoLayer] Photo cache failed; using remote image:', error));
    return () => { isActive = false; };
  }, [isPhoto, url]);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[DEBUG][StreakVideoLayer] visual-state', {
      clipId: clip.id,
      isCurrent,
      isPhoto,
      isVideoLoaded,
      blurVisible: !isVideoLoaded && Boolean(blurUrl),
      hasBlurUrl: Boolean(blurUrl),
      playerStatus: player.status,
      playing: player.playing,
      currentTime: player.currentTime,
      duration: player.duration,
    });
  }, [blurUrl, clip.id, isCurrent, isPhoto, isVideoLoaded, player]);

  // Use the signed remote source directly on both platforms. Android can stall
  // without an error when HLS native caching is enabled for these signed URLs.
  useEffect(() => {
    if (isPhoto || !url || !player) return;
    let isActive = true;

    const loadStream = async () => {
      try {
        setIsVideoLoaded(false);
        setVideoError(false);
        didHandleEndRef.current = false;
        hasRenderedFrameRef.current = false;
        maxPlaybackTimeRef.current = 0;
        if (isActive) {
          if (__DEV__) {
            console.log('[DEBUG][StreakVideoLayer] load-start', {
              clipId: clip.id,
              platform: Platform.OS,
            });
          }
          const playbackUrl = Platform.OS === 'android'
            ? await prepareAndroidHlsPlayback(clip.id, url)
            : url;
          if (!isActive || !isMountedRef.current) return;
          if (__DEV__) {
            console.log('[DEBUG][StreakVideoLayer] playback-source-ready', {
              clipId: clip.id,
              rewrittenForAndroid: playbackUrl !== url,
              platform: Platform.OS,
              isLocal: playbackUrl.startsWith('file:'),
            });
          }
          await player.replaceAsync(playbackUrl);
          if (!isActive || !isMountedRef.current) return;
          if (__DEV__) {
            console.log('[DEBUG][StreakVideoLayer] load-complete', {
              clipId: clip.id,
              duration: player.duration,
              status: player.status,
            });
          }
          if (playbackStateRef.current.isCurrent && !playbackStateRef.current.isPaused) {
            player.play();
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!isActive || !isMountedRef.current) {
          if (__DEV__) {
            console.log('[DEBUG][StreakVideoLayer] load-cancelled-after-unmount', {
              clipId: clip.id,
              message: errorMessage,
            });
          }
          return;
        }
        console.warn("[StreakVideoLayer] HLS resolution failed, retrying:", errorMessage);
        try {
          const retryUrl = Platform.OS === 'android'
            ? await prepareAndroidHlsPlayback(clip.id, url)
            : url;
          if (!isActive || !isMountedRef.current) return;
          await player.replaceAsync(retryUrl);
          if (!isActive || !isMountedRef.current) return;
          if (playbackStateRef.current.isCurrent && !playbackStateRef.current.isPaused) player.play();
        } catch (fallbackError) {
          if (isActive && isMountedRef.current) {
            console.warn(
              "[StreakVideoLayer] HLS retry failed:",
              fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            );
          }
        }
      }
    };

    loadStream();

    return () => { isActive = false; };
  }, [clip.id, url, isPhoto, player]);

  useEffect(() => {
    if (isPhoto || !player) return;
    const sub = player.addListener('playToEnd', () => {
      if (!isMountedRef.current) return;
      const playbackState = playbackStateRef.current;
      const duration = player.duration;
      const reachedActualEnd = (
        hasRenderedFrameRef.current &&
        Number.isFinite(duration) &&
        duration > 0 &&
        maxPlaybackTimeRef.current >= Math.max(0.1, duration * 0.8)
      );
      if (__DEV__) {
        console.log('[DEBUG][StreakVideoLayer] play-to-end', {
          clipId: clip.id,
          playerStatus: player.status,
          currentTime: player.currentTime,
          duration,
          maxPlaybackTime: maxPlaybackTimeRef.current,
          hasPlaybackEvidence: hasRenderedFrameRef.current,
          reachedActualEnd,
          didHandleEnd: didHandleEndRef.current,
          ...playbackState,
        });
      }
      if (
        playbackState.isCurrent &&
        !playbackState.isPaused &&
        reachedActualEnd &&
        !didHandleEndRef.current
      ) {
        didHandleEndRef.current = true;
        onEndRef.current();
      }
    });
    return () => sub.remove();
  }, [player, isPhoto, clip.id]);

  useEffect(() => {
    if (isPhoto || !player) return;
    const statusSub = player.addListener('statusChange', (payload) => {
      if (!isMountedRef.current) return;
      if (__DEV__) {
        console.log('[DEBUG][StreakVideoLayer] status-change', {
          clipId: clip.id,
          status: payload.status,
          oldStatus: payload.oldStatus,
          error: payload.error?.message || null,
          currentTime: player.currentTime,
          duration: player.duration,
        });
      }
      if (payload.status === 'readyToPlay') {
        setIsVideoLoaded(true);
        const playbackState = playbackStateRef.current;
        if (playbackState.isCurrent && !playbackState.isPaused && !player.playing) {
          if (__DEV__) {
            console.log('[DEBUG][StreakVideoLayer] play-on-ready', {
              clipId: clip.id,
              oldStatus: payload.oldStatus,
            });
          }
          player.play();
        }
      }
      if (payload.status === 'error') {
        setVideoError(true);
      }
    });
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      if (!isMountedRef.current) return;
      if (__DEV__) {
        console.log('[DEBUG][StreakVideoLayer] playing-change', {
          clipId: clip.id,
          isPlaying,
          playerStatus: player.status,
          currentTime: player.currentTime,
          duration: player.duration,
        });
      }
      if (isPlaying) setIsVideoLoaded(true);
    });
    const sourceLoadSub = player.addListener('sourceLoad', ({ duration, availableVideoTracks, availableAudioTracks }) => {
      if (!isMountedRef.current) return;
      if (__DEV__) {
        console.log('[DEBUG][StreakVideoLayer] source-load', {
          clipId: clip.id,
          duration,
          videoTrackCount: availableVideoTracks.length,
          audioTrackCount: availableAudioTracks.length,
        });
      }
    });
    return () => {
      statusSub.remove();
      playingSub.remove();
      sourceLoadSub.remove();
    };
  }, [player, isPhoto, clip.id]);

  useEffect(() => {
    if (isPhoto || !player) return;
    if (__DEV__) {
      console.log('[DEBUG][StreakVideoLayer] playback-controller', {
        clipId: clip.id,
        shouldPlay: isCurrent && !isPaused,
        isCurrent,
        isPaused,
        playerStatus: player.status,
        playing: player.playing,
      });
    }
    if (isCurrent && !isPaused) {
      if (player.status !== 'error') player.play();
    } else {
      player.pause();
    }
  }, [clip.id, isCurrent, isPaused, player, isPhoto]);

  useEffect(() => {
    let interval: any;
    if (isCurrent && !isPaused && !isPhoto) {
      interval = setInterval(() => {
        if (!isMountedRef.current) return;
        if (player.status === 'readyToPlay' && !player.playing) {
          const now = Date.now();
          if (now - lastPlaybackRecoveryAtRef.current >= 1000) {
            lastPlaybackRecoveryAtRef.current = now;
            if (__DEV__) {
              console.log('[DEBUG][StreakVideoLayer] recover-ready-player', {
                clipId: clip.id,
                currentTime: player.currentTime,
                duration: player.duration,
              });
            }
            player.play();
          }
        }
        if (player.duration && player.currentTime !== undefined) {
          const current = player.currentTime;
          maxPlaybackTimeRef.current = Math.max(maxPlaybackTimeRef.current, current);
          const currentSecond = Math.floor(current);
          if (
            __DEV__ &&
            currentSecond !== lastProgressLogSecondRef.current &&
            (currentSecond === 0 || currentSecond % 2 === 0)
          ) {
            lastProgressLogSecondRef.current = currentSecond;
            console.log('[DEBUG][StreakVideoLayer] progress', {
              clipId: clip.id,
              currentTime: current,
              duration: player.duration,
              playerStatus: player.status,
              playing: player.playing,
            });
          }
          if (current > 0.05) {
            hasRenderedFrameRef.current = true;
            setIsVideoLoaded(true);
          }
          onProgress((current / player.duration) * 100);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [clip.id, isCurrent, isPaused, player, isPhoto, onProgress]);

  useImperativeHandle(ref, () => ({
    replay: () => {
      if (player) {
        didHandleEndRef.current = false;
        maxPlaybackTimeRef.current = 0;
        player.replay();
        player.play();
      }
    },
    pause: () => {
      if (player) player.pause();
    },
    play: () => {
      if (player) player.play();
    },
    getCurrentTime: () => player?.currentTime ?? 0,
    seekFrom: (startTime: number, translationX: number, elapsedMs: number) => {
      if (!player?.duration) return;
      const speed = Math.min(8, 0.75 + Math.abs(translationX) / 75);
      player.currentTime = Math.max(
        0,
        Math.min(player.duration, startTime + Math.sign(translationX) * speed * (elapsedMs / 1000)),
      );
    },
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: isCurrent ? 1 : 0, zIndex: isCurrent ? 10 : 1 }]} pointerEvents={isCurrent ? "auto" : "none"}>
      {isPhoto ? (
        <>
          <Image
            source={{ uri: photoUri || url || clip?.thumbnailUrl }}
            style={[styles.fullscreenMedia, mediaPlaybackStyle]}
            resizeMode="cover"
            onLoad={() => setIsVideoLoaded(true)}
            onError={() => setIsVideoLoaded(true)}
          />
          {!isVideoLoaded && blurUrl && (
            <Animated.Image
              exiting={FadeOut.duration(300)}
              source={{ uri: photoUri || blurUrl }}
              style={[styles.fullscreenMedia, mediaPlaybackStyle, { zIndex: 10 }]}
              resizeMode="cover"
              blurRadius={20}
            />
          )}
        </>
      ) : (
        <>
          <Image
            source={{ uri: clip?.thumbnailUrl }}
            style={[styles.fullscreenMedia, mediaPlaybackStyle]}
            resizeMode="cover"
          />
          {isCurrent && (
            <VideoView
              player={player}
              style={[styles.fullscreenMedia, mediaPlaybackStyle]}
              contentFit="cover"
              nativeControls={false}
              onFirstFrameRender={() => {
                if (!isMountedRef.current) return;
                if (__DEV__) {
                  console.log('[DEBUG][StreakVideoLayer] first-frame', {
                    clipId: clip.id,
                    currentTime: player.currentTime,
                    duration: player.duration,
                    playerStatus: player.status,
                  });
                }
                hasRenderedFrameRef.current = true;
                setIsVideoLoaded(true);
              }}
            />
          )}

          {!isVideoLoaded && blurUrl && (
            <Animated.Image
              exiting={FadeOut.duration(300)}
              source={{ uri: blurUrl }}
              style={[styles.fullscreenMedia, mediaPlaybackStyle, { zIndex: 10 }]}
              blurRadius={20}
            />
          )}

          {!isVideoLoaded && !videoError && !isPhoto && (
             <View style={[StyleSheet.absoluteFill, styles.videoCardLoader]}>
                <ActivityIndicator size="small" color="#fff" />
             </View>
          )}
        </>
      )}
    </View>
  );
});

interface StreakClipPlaybackOverlayProps {
  vloggedDays: any[];
  dayIndex: number;
  initialClipIndex: number;
  onClose: () => void;
  liveGuide?: {
    visible: boolean;
    step?: GuideStep;
    stepIndex: number;
    totalSteps: number;
    stepComplete: boolean;
    completeAction: (motion: GuideMotion) => boolean;
    skipStep: () => void;
    skipTour: () => void;
    goBack: () => void;
  } | null;
}

export function StreakClipPlaybackOverlay({
  vloggedDays,
  dayIndex,
  initialClipIndex = 0,
  onClose,
  liveGuide,
}: StreakClipPlaybackOverlayProps) {
  const insets = useSafeAreaInsets();
  const [clipIndex, setClipIndex] = useState(initialClipIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Archive interactions modals visibility
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [selectedPhotoResponseIndex, setSelectedPhotoResponseIndex] = useState<number | null>(null);

  const openProgress = useSharedValue(0);
  const dragY = useSharedValue(0);

  const dayData = vloggedDays[dayIndex];
  const clips = dayData?.assignment?.clips || [];
  const activeClip = clips[clipIndex];

  const activeClipMetadata = useMemo(() => {
    if (!activeClip?.metadata) return null;

    try {
      return parseMediaMetadata(activeClip.metadata);
    } catch {
      return null;
    }
  }, [activeClip?.metadata]);

  const isPhoto = activeClipMetadata?.mediaType === 'photo' || activeClip?.mediaType === 'photo';

  useEffect(() => {
    // The carousel can move from a video to a still while the guide is open.
    // Holding a still cannot seek, so do not leave that lesson waiting for an
    // action the current media cannot perform.
    if (liveGuide?.visible && liveGuide.step?.motion === 'hold' && isPhoto) {
      liveGuide.skipStep();
    }
  }, [isPhoto, liveGuide]);

  const carouselRef = useRef<any>(null);
  const isProgrammaticChangeRef = useRef(false);
  const currentVideoRef = useRef<StreakVideoLayerRef>(null);

  // Relation Lists with Fallbacks
  const [loadedComments, setLoadedComments] = useState<any[]>([]);
  const [loadedReactions, setLoadedReactions] = useState<any[]>([]);
  const [loadedViews, setLoadedViews] = useState<any[]>([]);
  const [loadedClipId, setLoadedClipId] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [floatingFeed, setFloatingFeed] = useState<FloatingFeedItem[]>([]);
  const dismissedFloatingFeedIdsRef = useRef<Set<string>>(new Set());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserId = useMemo(() => storage.getString('auth_user_id') || "", []);
  const isOwnContent = useMemo(() => {
    if (!activeClip) return false;
    return activeClip.userId === currentUserId || activeClip.user?.id === currentUserId;
  }, [activeClip, currentUserId]);

  useEffect(() => {
    openProgress.value = withTiming(1, {
      duration: 300,
      easing: Easing.bezier(0.16, 1, 0.3, 1)
    });
  }, []);

  // Sync scroll positioning on active programmatic clipIndex changes
  useEffect(() => {
    if (isProgrammaticChangeRef.current) {
      carouselRef.current?.scrollTo({ index: clipIndex, animated: true });
    }
  }, [clipIndex]);

  // Tactile selection snap haptic trigger on index changes
  useEffect(() => {
    setVideoProgress(0); // Reset progress immediately on slide changes
    if (clipIndex !== initialClipIndex) {
      Haptics.impactAsync().catch(() => {});
    }
  }, [clipIndex]);

  // Synchronized Photo Advance Tracking Reference Mapping
  const photoPlaybackRef = useRef<{ start: number, pausedAt: number }>({ start: 0, pausedAt: 0 });

  useEffect(() => {
    setVideoProgress(0);
    if (isPhoto) {
      photoPlaybackRef.current = { start: Date.now(), pausedAt: 0 };
    }
  }, [activeClip?.id, isPhoto]);

  // Dynamic progress tracker listener loop for photos
  useEffect(() => {
    let interval: any;
    if (isPhoto) {
      interval = setInterval(() => {
        if (isPaused) {
          if (photoPlaybackRef.current.pausedAt === 0) {
            photoPlaybackRef.current.pausedAt = Date.now();
          }
        } else {
          if (photoPlaybackRef.current.pausedAt > 0) {
            const pauseDuration = Date.now() - photoPlaybackRef.current.pausedAt;
            photoPlaybackRef.current.start += pauseDuration;
            photoPlaybackRef.current.pausedAt = 0;
          }
          const elapsed = Date.now() - photoPlaybackRef.current.start;
          if (elapsed >= 4000) {
            photoPlaybackRef.current.start = Date.now();
            const isLastClipOverall = activeClip && clips.length > 0 && activeClip.id === clips[clips.length - 1].id;
            if (!isLastClipOverall) {
              isProgrammaticChangeRef.current = true;
              setClipIndex(prev => prev + 1);
            } else {
              setVideoProgress(0);
            }
          } else {
            setVideoProgress((elapsed / 4000) * 100);
          }
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPaused, isPhoto, clips, activeClip]);

  const handleNext = () => {
    if (clipIndex < clips.length - 1) {
      isProgrammaticChangeRef.current = true;
      setClipIndex(clipIndex + 1);
    }
  };

  const handlePrev = () => {
    if (clipIndex > 0) {
      isProgrammaticChangeRef.current = true;
      setClipIndex(clipIndex - 1);
    }
  };

  const triggerClose = useCallback(() => {
    if (closeTimerRef.current) return;

    setIsPaused(true);
    if (!isPhoto) currentVideoRef.current?.pause();

    openProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });

    // Keep React/native-root teardown on the JavaScript thread rather than
    // invoking onClose from a Reanimated completion worklet.
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 240);
  }, [isPhoto, onClose, openProgress]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleMenuPress = () => {
    lightTap();
    setIsPaused(true);
    if (!isPhoto) currentVideoRef.current?.pause();

    const options = [
      {
        text: "Paylaş",
        onPress: () => {
          lightTap();
          const cleanUrl = activeClip.videoUrl.startsWith('http') ? activeClip.videoUrl : `${apiClient.getBaseUrl()}/api/media/vlogs/${activeClip.videoUrl}`;
          Share.share({
            message: `MyTurn'de paylaştığım güncel vlog klibime göz atın! 🍿\n${cleanUrl}`,
          }).catch(() => {});
          
          setIsPaused(false);
          if (!isPhoto) currentVideoRef.current?.play();
        }
      }
    ];

    if (isOwnContent) {
      options.push({
        text: "Klibi Sil",
        style: "destructive",
        onPress: () => {
          lightTap();
          Alert.alert(
            "Emin misiniz?",
            "Bu vlog klibini arşivlerinizden kalıcı olarak silmek istediğinizden emin misiniz?",
            [
              {
                text: "Vazgeç",
                style: "cancel",
                onPress: () => {
                  setIsPaused(false);
                  if (!isPhoto) currentVideoRef.current?.play();
                }
              },
              {
                text: "Sil",
                style: "destructive",
                onPress: async () => {
                  try {
                    const profileStore = useProfileStore.getState();
                    await profileStore.deleteClip(activeClip.id);

                    notifySuccess();
                    triggerClose();
                    Alert.alert("Başarılı", "Vlog başarıyla silindi.");
                  } catch (err) {
                    Alert.alert("Hata", "Vlog silinirken bir hata oluştu.");
                    setIsPaused(false);
                    if (!isPhoto) currentVideoRef.current?.play();
                  }
                }
              }
            ]
          );
        }
      } as any);
    }

    options.push({
      text: "İptal",
      style: "cancel",
      onPress: () => {
        setIsPaused(false);
        if (!isPhoto) currentVideoRef.current?.play();
      }
    } as any);

    Alert.alert(
      "Vlog Seçenekleri",
      "Klip üzerinde uygulamak istediğiniz işlemi seçin.",
      options
    );
  };

  useEffect(() => {
    setLoadedComments([]);
    setLoadedReactions([]);
    setLoadedViews([]);

    if (!activeClip) return;

    if (activeClip.comments && activeClip.comments.length > 0) {
      setLoadedComments(activeClip.comments);
    }
    if (activeClip.reactions && activeClip.reactions.length > 0) {
      setLoadedReactions(activeClip.reactions);
    }
    if (activeClip.views && activeClip.views.length > 0) {
      setLoadedViews(activeClip.views);
    }
    setLoadedClipId(activeClip.id);

    async function loadRichDetails() {
      setIsLoadingDetails(true);
      try {
        const url1 = `${apiClient.getBaseUrl()}/api/vlog?intent=getClip&clipId=${activeClip.id}`;
        // Corrected parameter footprint: 'credentials: include' flag stripped
        const res1 = await appCheckFetch(url1, { headers: { 'Accept': 'application/json' } });
        if (res1.ok) {
          const data1 = await res1.json();
          if (data1?.success && data1.clip) {
            if (data1.clip.comments) setLoadedComments(data1.clip.comments);
            if (data1.clip.reactions) setLoadedReactions(data1.clip.reactions);
            if (data1.clip.views) setLoadedViews(data1.clip.views);
            setIsLoadingDetails(false);
            return;
          }
        }
      } catch { }

      try {
        const res2 = (await apiClient.request<any>('vlog', [{ action: 'getClip', clipId: activeClip.id }])) as any;
        if (res2?.success && res2.clip) {
          if (res2.clip.comments) setLoadedComments(res2.clip.comments);
          if (res2.clip.reactions) setLoadedReactions(res2.clip.reactions);
          if (res2.clip.views) setLoadedViews(res2.clip.views);
          setIsLoadingDetails(false);
          return;
        }
      } catch { }

      setIsLoadingDetails(false);
    }

    loadRichDetails();
  }, [activeClip]);

  const removeFloatingFeedItem = useCallback((itemId: string) => {
    dismissedFloatingFeedIdsRef.current.add(itemId);
    setFloatingFeed((previousFeed) =>
      previousFeed.filter((feedItem) => feedItem.id !== itemId),
    );
  }, []);

  // Initialize the feed once per clip. Stable IDs prevent React from tearing
  // down and recreating animated native views when richer details arrive.
  useEffect(() => {
    dismissedFloatingFeedIdsRef.current.clear();

    if (!activeClip) {
      setFloatingFeed([]);
      return;
    }

    const nextFeed: FloatingFeedItem[] = [];
    let currentDelay = 450;

    (activeClip.comments || [])
      .filter((comment: any) => !comment.parentId)
      .slice(0, 10)
      .forEach((comment: any) => {
        nextFeed.push({
          id: `c_${activeClip.id}_${comment.id}`,
          type: 'comment',
          userImage: comment.user?.image ?? null,
          userName: comment.user?.name || 'Friend',
          text: comment.text,
          delay: currentDelay,
        });
        currentDelay += Math.random() * 900 + 800;
      });

    // Keep this conservative while isolating the production crash. Images are
    // mounted only when their own delay begins inside FloatingFeedNode.
    (activeClip.photoResponses || []).slice(0, 3).forEach((photoResponse: any) => {
      const resolvedImageUrl = resolveMediaUrl(photoResponse.imageUrl);
      if (!resolvedImageUrl) return;

      nextFeed.push({
        id: `pr_${activeClip.id}_${photoResponse.id}`,
        type: 'photoResponse',
        userImage: photoResponse.user?.image ?? null,
        userName: photoResponse.user?.name || 'Friend',
        imageUrl: resolvedImageUrl,
        delay: currentDelay,
      });
      currentDelay += Math.random() * 1200 + 1000;
    });

    setFloatingFeed(nextFeed);
  }, [activeClip?.id]);

  // Rich details can arrive after the initial render. Append only genuinely new
  // comments instead of replacing every feed node and changing all native keys.
  useEffect(() => {
    if (!activeClip?.id || loadedComments.length === 0) return;

    setFloatingFeed((previousFeed) => {
      const existingIds = new Set(previousFeed.map((feedItem) => feedItem.id));
      const dismissedIds = dismissedFloatingFeedIdsRef.current;
      let currentDelay = previousFeed.reduce(
        (largestDelay, feedItem) => Math.max(largestDelay, feedItem.delay),
        450,
      ) + 800;

      const additions: FloatingFeedItem[] = [];

      loadedComments
        .filter((comment: any) => !comment.parentId)
        .slice(0, 10)
        .forEach((comment: any) => {
          const itemId = `c_${activeClip.id}_${comment.id}`;

          if (existingIds.has(itemId) || dismissedIds.has(itemId)) return;

          existingIds.add(itemId);
          additions.push({
            id: itemId,
            type: 'comment',
            userImage: comment.user?.image ?? null,
            userName: comment.user?.name || 'Friend',
            text: comment.text,
            delay: currentDelay,
          });
          currentDelay += Math.random() * 900 + 800;
        });

      return additions.length > 0
        ? [...previousFeed, ...additions]
        : previousFeed;
    });
  }, [activeClip?.id, loadedComments]);

  const reportArchiveDismiss = () => liveGuide?.completeAction('dismiss');
  const reportArchiveEdges = () => liveGuide?.completeAction('edges');

  const verticalDragGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        dragY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 150 || e.velocityY > 500) {
        dragY.value = withTiming(SCREEN_HEIGHT, {
          duration: 200,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        });
        reportArchiveDismiss();
        triggerClose();
      } else {
        dragY.value = withSpring(0, { damping: 28, stiffness: 150 });
      }
    });

  const tapLeftOrRightGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.x < SCREEN_WIDTH * 0.25) {
        handlePrev();
        reportArchiveEdges();
      } else if (e.x > SCREEN_WIDTH * 0.75) {
        handleNext();
        reportArchiveEdges();
      }
    });

  const seekStartTimeRef = useRef(0);
  const holdToSeekGesture = useHoldToSeekGesture({
    enabled: !isPhoto,
    onHoldStart: () => {
      seekStartTimeRef.current = currentVideoRef.current?.getCurrentTime() ?? 0;
      setIsPaused(true);
      currentVideoRef.current?.pause();
      liveGuide?.completeAction('hold');
    },
    onSeek: (translationX, elapsedMs) => currentVideoRef.current?.seekFrom(seekStartTimeRef.current, translationX, elapsedMs),
    onHoldEnd: () => {
      setIsPaused(false);
      currentVideoRef.current?.play();
    },
  });

  const cardComposedGestures = Gesture.Exclusive(holdToSeekGesture, tapLeftOrRightGesture);

  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: openProgress.value,
    backgroundColor: 'rgba(5, 5, 5, 0.88)',
  }));

  const animatedContent = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(openProgress.value, [0, 1], [SCREEN_HEIGHT * 0.1, 0]) + dragY.value },
      { scale: interpolate(openProgress.value, [0, 1], [0.95, 1]) }
    ],
    opacity: openProgress.value,
  }));

  const VIDEO_CARD_HEIGHT = (SCREEN_WIDTH - 32) * 1.33;

  if (!activeClip) return null;

  const detailsMatchActiveClip = loadedClipId === activeClip.id;
  const commentCount = detailsMatchActiveClip
    ? loadedComments.length
    : (activeClip.comments?.length ?? activeClip._count?.comments ?? 0);
  const reactionCount = detailsMatchActiveClip
    ? loadedReactions.length
    : (activeClip.reactions?.length ?? activeClip._count?.reactions ?? 0);
  const photoCount = activeClip.photoResponses?.length ?? activeClip._count?.photoResponses ?? 0;
    
  const pinnedPrompt = activeClip.prompt || activeClipMetadata?.prompt;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      {/* Semi-transparent Backdrop */}
      <TouchableWithoutFeedback onPress={triggerClose}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedBackdrop]} />
      </TouchableWithoutFeedback>

      <GestureDetector gesture={verticalDragGesture}>
        {/* pointerEvents must be box-none to allow components like Carousel & Action Buttons to receive touches */}
        <Animated.View style={[StyleSheet.absoluteFill, animatedContent, { paddingTop: Math.max(insets.top, 24) }]} pointerEvents="box-none">

          <View style={styles.dismissHandleWrapper} pointerEvents="none">
            <View style={styles.dismissHandleLine} />
          </View>

          {/* 1. VIDEO VIEW PORT CONTAINER */}
          <View style={styles.videoCardContainer} pointerEvents="box-none">
            <GestureDetector gesture={cardComposedGestures}>
              <View style={[styles.videoCardInner, { height: VIDEO_CARD_HEIGHT }]}>
                
                {clips.map((clip: any, index: number) => {
                  const shouldPrefetch = Math.abs(index - clipIndex) <= 1;
                  if (!shouldPrefetch) return null;
                  return (
                    <StreakVideoLayer
                      key={clip.id}
                      ref={index === clipIndex ? currentVideoRef : null}
                      clip={clip}
                      isCurrent={index === clipIndex}
                      isPaused={isPaused}
                      onProgress={(prog) => setVideoProgress(prog)}
                      onEnd={() => {
                        if (clips[clipIndex]?.id !== clip.id) return;
                        const isLastClipOverall = activeClip && clips.length > 0 && activeClip.id === clips[clips.length - 1].id;
                        if (!isLastClipOverall) {
                          isProgrammaticChangeRef.current = true;
                          setClipIndex(prev => (
                            clips[prev]?.id === clip.id ? Math.min(prev + 1, clips.length - 1) : prev
                          ));
                        } else {
                          currentVideoRef.current?.replay();
                        }
                      }}
                    />
                  );
                })}

                {/* Vignette Gradients */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.7)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                {/* Video Index progress bars */}
                <View style={styles.videoCardIndicators}>
                  <View style={styles.storyIndicatorsRow}>
                    {clips.map((c: any, idx: number) => {
                      const isActive = idx === clipIndex;
                      const isDone = idx < clipIndex;
                      const barWidth = isDone ? 100 : isActive ? videoProgress : 0;

                      return (
                        <View key={c.id || idx} style={styles.storyIndicatorTrack}>
                          <View style={[styles.storyIndicatorFill, { width: `${barWidth}%` }]} />
                        </View>
                      );
                    })}
                  </View>

                  {/* Top Action Overlay Row: Options Modal Ellipsis Menu */}
                  <View style={styles.topActionsOverlayRow}>
                    <View />
                    <TouchableOpacity 
                      onPress={handleMenuPress} 
                      style={styles.ellipsisMenuBtn}
                      activeOpacity={0.7}
                    >
                      <MoreVertical size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Pause icon overlay */}
                {isPaused && (
                  <View style={styles.pauseOverlay} pointerEvents="none">
                    <Play size={32} color="#fff" fill="#fff" style={{ opacity: 0.6 }} />
                  </View>
                )}

                {/* Unified Floating Real Data Feed Overlay */}
                {activeClip && floatingFeed.map((item) => (
                  <FloatingFeedNode
                    key={item.id}
                    item={item}
                    cardHeight={VIDEO_CARD_HEIGHT}
                    onComplete={removeFloatingFeedItem}
                  />
                ))}


                {/* Left Bottom Profile Box */}
                <View style={styles.videoCardProfileArea} pointerEvents="box-none">
                  
                  {/* Opt-In Pinned Task Prompt UI */}
                  {pinnedPrompt && (
                    <Animated.View entering={FadeInUp.duration(300)} exiting={FadeOutUp.duration(300)} style={{ marginBottom: 12 }} pointerEvents="none">
                      <GlassView preset="specular" style={styles.notificationPromptPill}>
                        <Image source={require('../../../assets/icons/star.png')} style={{ width: 16, height: 16 }} />
                        <Text weight="medium" style={styles.notificationPromptText} numberOfLines={3}>
                          {pinnedPrompt}
                        </Text>
                      </GlassView>
                    </Animated.View>
                  )}

                  <View className="flex-row items-center gap-2.5">
                    <Avatar src={dayData.assignment?.user?.image} name={dayData.assignment?.user?.name} size={28} />
                    <View className="flex-col">
                      <Text weight="bold" className="text-white text-xs leading-none">
                        @{dayData.assignment?.user?.handle || "user"}
                      </Text>
                      {activeClip.location && (
                        <View className="flex-row items-center mt-1">
                          <Navigation size={7} color="rgba(255,255,255,0.6)" fill="rgba(255,255,255,0.6)" />
                          <Text className="text-white/60 text-[8px] font-medium ml-1">
                            {activeClip.location}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {activeClip.caption ? (
                    <Text className="text-white text-[11px] mt-2 leading-relaxed text-shadow-sm" numberOfLines={2}>
                      {activeClip.caption}
                    </Text>
                  ) : null}
                </View>

                {/* Right Bottom Tab Pill Button */}
                <View style={styles.videoCardViewsArea} pointerEvents="box-none">
                  <GlassView preset="frosted" style={styles.passiveCountPillCompact}>
                    <TouchableOpacity style={styles.pillSubButton} onPress={() => setCommentsOpen(true)} activeOpacity={0.75}>
                      <MessageCircle size={10} color="rgba(255,255,255,0.8)" fill="#fff" />
                      <Text weight="bold" className="text-white text-[9px] font-mono ml-1 mr-1.5">{commentCount}</Text>
                    </TouchableOpacity>

                    <View style={styles.pillSeparator} />

                    <TouchableOpacity style={styles.pillSubButton} onPress={() => setViewsOpen(true)} activeOpacity={0.75}>
                      <Heart size={10} color="#ff6b6b" fill="#ff6b6b" />
                      <Text weight="bold" className="text-white text-[9px] font-mono ml-1 mr-1.5">{reactionCount}</Text>
                    </TouchableOpacity>

                    <View style={styles.pillSeparator} />

                    <TouchableOpacity style={styles.pillSubButton} onPress={() => setViewsOpen(true)} activeOpacity={0.75}>
                      <Eye size={10} color="rgba(255,255,255,0.85)" />
                      <Text weight="bold" className="text-white text-[9px] font-mono ml-1">{loadedViews.length}</Text>
                    </TouchableOpacity>

                    {/* Dynamic Hide Photo Response Icon if no responses are present */}
                    {photoCount > 0 && (
                      <>
                        <View style={styles.pillSeparator} />
                        <TouchableOpacity style={styles.pillSubButton} onPress={() => setSelectedPhotoResponseIndex(0)} activeOpacity={0.75}>
                          <Camera size={10} color="rgba(255,255,255,0.8)" fill="#fff" />
                          <Text weight="bold" className="text-white text-[9px] font-mono ml-1">{photoCount}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </GlassView>
                </View>
              </View>
            </GestureDetector>
          </View>

          {/* 2. LIQUID GLASS COHESIVE LOOPING COMMENTS DECK - STYLED TO MATCH PREVIEW */}
          <View style={styles.metadataDeckContainer} className="px-5" pointerEvents="box-none">
            <LoopingCommentPreview 
              comments={loadedComments}
              commentCount={commentCount}
              onPress={() => setCommentsOpen(true)}
            />
          </View>

          {/* 3. REFINED ACTIVE-HIGHLIGHTED SNAPPING HORIZONTAL WHEEL WITH CARD-FANNING EFFECT */}
          {clips.length > 1 && (
            <View style={styles.carouselSection} pointerEvents="box-none">
              <StreakCarousel 
                clips={clips}
                clipIndex={clipIndex}
                setClipIndex={setClipIndex}
                isProgrammaticChangeRef={isProgrammaticChangeRef}
                SCREEN_WIDTH={SCREEN_WIDTH}
              />
            </View>
          )}

        </Animated.View>
      </GestureDetector>

      {/* Reused High-Fidelity Read-only Comments Sheet */}
      <CommentsSheet
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        commentList={loadedComments}
        groupMembers={[]}
        onAddComment={async () => { }} // No-op to disable interaction
        onDeleteComment={async () => { }} // No-op to disable interaction
        currentUserId="" // Empty string so that no comments can be deleted by current user context
        readOnly={true}
      />

      {/* Reused High-Fidelity Views/Likes Sheet */}
      <ViewsSheet
        isOpen={viewsOpen}
        onClose={() => setViewsOpen(false)}
        views={loadedViews}
        likes={loadedReactions.map((r: any) => ({
          id: r.id,
          user: r.user || { id: r.userId, name: "Member", handle: "" }
        }))}
        groupMembers={[]}
      />

      {/* Real-time Horizontal photo responses collapsible menu list */}
      <PhotoResponsesOverlay
        responses={activeClip.photoResponses || []}
        externalExpandedIndex={selectedPhotoResponseIndex}
        onExternalClose={() => setSelectedPhotoResponseIndex(null)}
        hasResponded={true}
      />
      {liveGuide && (
        <LiveGuideCoachmark
          visible={liveGuide.visible}
          step={liveGuide.step}
          stepIndex={liveGuide.stepIndex}
          totalSteps={liveGuide.totalSteps}
          stepComplete={liveGuide.stepComplete}
          onBack={liveGuide.goBack}
          onSkipStep={liveGuide.skipStep}
          onClose={liveGuide.skipTour}
          placement="top"
          topOffset={120}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dismissHandleWrapper: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  dismissHandleLine: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  videoCardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  videoCardInner: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  videoCardLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 11,
  },
  videoCardIndicators: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 40,
  },
  storyIndicatorsRow: {
    flexDirection: 'row',
    gap: 4,
    height: 2,
    width: '100%',
  },
  storyIndicatorTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  storyIndicatorFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  topActionsOverlayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  ellipsisMenuBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  notificationPromptPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  notificationPromptText: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#fff', marginLeft: 8, flexShrink: 1, lineHeight: 18 },

  pauseOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 15,
  },
  videoCardProfileArea: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 160,
    zIndex: 30,
  },
  videoCardViewsArea: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 35,
  },
  passiveCountPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pillSubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  pillSeparator: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 1,
  },
  metadataDeckContainer: {
    width: '100%',
    marginBottom: 16,
  },
  carouselSection: {
    width: '100%',
    marginTop: 10,
    overflow: 'visible',
  },
  fullscreenMedia: {
    ...StyleSheet.absoluteFill,
  },
});

// Changelog:
// - Keeps animated-feed completion and overlay teardown on the JavaScript thread.
// - Uses stable feed IDs and append-only detail updates to prevent animated native
//   views from being destroyed and recreated while their animations are active.
// - Resolves and validates photo-response URLs before they reach native Image.
// - Removes the duplicate uncontrolled PhotoResponsesOverlay instance.
