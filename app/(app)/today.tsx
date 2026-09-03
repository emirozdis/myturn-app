"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from "expo-router/react-navigation";
import { Repeat, Users, Clock, Eye, Pause, Heart, Navigation, MessageCircle, Camera, Zap, Film, AlertTriangle, Upload } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
  interpolate,
  LinearTransition
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Crypto from 'expo-crypto';
import { getColors } from 'react-native-image-colors';

import { useTodayStore, getSlotForClip } from '../../src/store/useTodayStore';
import { useGroupStore } from '../../src/store/useGroupStore';
import { useUploadQueueStore } from '../../src/store/useUploadQueueStore';
import { useProfileStore } from '../../src/store/useProfileStore';
import { apiClient } from '../../src/lib/apiClient';
import { storage } from '../../src/lib/storage';
import { SEEN_MEDIA_VIEW_THRESHOLD_MS } from '../../src/lib/seenMedia';
import { GlassView } from '../../src/components/ui/GlassView';
import { Text } from '../../src/components/ui/Text';
import { Avatar } from '../../src/components/ui/Avatar';
import { CountdownTimer } from '../../src/components/ui/CountdownTimer';
import { mediumTap, lightTap, heavyTap, notifySuccess } from '../../src/lib/haptics';
import { prepareCachedPhoto } from '../../src/lib/MediaCache';
import { formatBusinessDate, getBusinessClock } from '../../src/lib/businessTime';
import { fetchWithTimeout } from '../../src/lib/network';
import { prepareAndroidHlsPlayback } from '../../src/lib/hlsPlayback';

import { StoryIndicators } from '../../src/components/today/StoryIndicators';
import { VideoActionBar } from '../../src/components/today/VideoActionBar';
import { CommentsSheet } from '../../src/components/today/CommentsSheet';
import { ViewsSheet } from '../../src/components/today/ViewsSheet';
import { PhotoCaptureModal } from '../../src/components/today/PhotoCaptureModal';
import { NoClipView } from '../../src/components/today/NoClipView';
import { SleepModeView } from '../../src/components/today/SleepModeView';
import { PhotoResponsesOverlay } from '../../src/components/today/PhotoResponsesOverlay';
import { VloggerProfileDrawer } from '../../src/components/today/VloggerProfileDrawer';
import { TimelineTracker } from '../../src/components/today/TimelineTracker';
import { VloggerRevealModal } from '../../src/components/today/VloggerRevealModal';
import { JoinOrCreateGroupWall } from '../../src/components/group/JoinOrCreateGroupWall';
import { GroupSelectorSheet } from '../../src/components/group/GroupSelectorSheet';
import { WaitingForMembersView } from '../../src/components/group/WaitingForMembersView';
import { LiveGuideCoachmark } from '../../src/components/guides/LiveGuideCoachmark';
import { getGuideDefinition } from '../../src/components/guides/guideContent';
import { useLiveGuide } from '../../src/components/guides/useLiveGuide';
import { useTranslation } from '../../src/lib/i18n';
import { parseMediaMetadata } from '../../src/lib/mediaMetadata';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function describePlaybackSource(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return { present: false };
  try {
    const parsed = new URL(sourceUrl);
    return {
      present: true,
      protocol: parsed.protocol,
      host: parsed.host,
      isHls: parsed.pathname.endsWith('.m3u8'),
      isHighestVariant: parsed.pathname.includes('/stream_0/'),
      hasQuery: parsed.search.length > 0,
      urlLength: sourceUrl.length,
    };
  } catch {
    return {
      present: true,
      protocol: 'unparsed',
      isHls: sourceUrl.includes('.m3u8'),
      hasQuery: sourceUrl.includes('?'),
      urlLength: sourceUrl.length,
    };
  }
}

function debugFeedVideo(event: string, details: Record<string, unknown>) {
  if (__DEV__) console.log(`[DEBUG][FeedVideoLayer] ${event}`, details);
}

const probedHlsClipIds = new Set<string>();

async function probeHlsSource(clipId: string, sourceUrl: string) {
  if (!__DEV__ || Platform.OS !== 'android' || probedHlsClipIds.has(clipId)) return;
  probedHlsClipIds.add(clipId);

  try {
    const response = await fetchWithTimeout(sourceUrl, {}, 8000);
    const body = await response.text();
    const uriLines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    const firstReference = uriLines[0] || null;
    const parent = new URL(sourceUrl);
    const naturallyResolved = firstReference ? new URL(firstReference, sourceUrl) : null;
    const inheritedQueryResolved = naturallyResolved ? new URL(naturallyResolved.toString()) : null;
    if (inheritedQueryResolved && !inheritedQueryResolved.search && parent.search) {
      inheritedQueryResolved.search = parent.search;
    }

    debugFeedVideo('hls-probe-manifest', {
      clipId,
      httpStatus: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      bodyLength: body.length,
      isExtM3u: body.trimStart().startsWith('#EXTM3U'),
      isMasterPlaylist: body.includes('#EXT-X-STREAM-INF'),
      uriLineCount: uriLines.length,
      firstReferenceKind: firstReference?.startsWith('http') ? 'absolute' : firstReference ? 'relative' : 'missing',
      parentHasQuery: parent.search.length > 0,
      naturalChildHasQuery: Boolean(naturallyResolved?.search),
      inheritedChildHasQuery: Boolean(inheritedQueryResolved?.search),
    });

    if (
      response.ok &&
      body.includes('#EXT-X-STREAM-INF') &&
      naturallyResolved &&
      inheritedQueryResolved
    ) {
      const naturalChildResponse = await fetchWithTimeout(naturallyResolved.toString(), {}, 8000);
      debugFeedVideo('hls-probe-natural-child', {
        clipId,
        httpStatus: naturalChildResponse.status,
        ok: naturalChildResponse.ok,
        contentType: naturalChildResponse.headers.get('content-type'),
        hasQuery: naturallyResolved.search.length > 0,
      });

      if (naturallyResolved.toString() !== inheritedQueryResolved.toString()) {
        const inheritedChildResponse = await fetchWithTimeout(inheritedQueryResolved.toString(), {}, 8000);
        debugFeedVideo('hls-probe-inherited-query-child', {
          clipId,
          httpStatus: inheritedChildResponse.status,
          ok: inheritedChildResponse.ok,
          contentType: inheritedChildResponse.headers.get('content-type'),
          hasQuery: inheritedQueryResolved.search.length > 0,
        });
      }
    }
  } catch (error) {
    debugFeedVideo('hls-probe-error', {
      clipId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function isLightColor(color: string | undefined) {
  if (!color) return false;
  const match = color.trim().match(/^#([\da-f]{6})(?:[\da-f]{2})?$/i);
  if (!match) return false;

  const value = match[1];
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  // This is the WCAG crossover where black text has greater contrast than white.
  return luminance > 0.179;
}

type FloatingFeedItem = {
  id: string;
  sourceId?: string;
  type: 'comment' | 'photoResponse' | 'like';
  userImage: string | null;
  userName: string;
  text?: string;
  imageUrl?: string;
  delay: number;
};

export interface FeedVideoLayerRef {
  scrub: (startTime: number, diffX: number, elapsedMs: number) => number | null;
  getCurrentTime: () => number;
  replay: () => void;
  pause: () => void;
  play: () => void;
}

// Dedicated prefetching video layer allowing instant multi-clip caching
const FeedVideoLayer = forwardRef<FeedVideoLayerRef, {
  clip: any;
  isCurrent: boolean;
  isPaused: boolean;
  isFocused: boolean;
  onProgress: (prog: number) => void;
  onEnd: () => void;
  onPlaybackReady: (clipId: string, signal: string) => void;
  onPlaybackError: (clipId: string, message: string | null) => void;
}>(({ clip, isCurrent, isPaused, isFocused, onProgress, onEnd, onPlaybackReady, onPlaybackError }, ref) => {
  const url = useTodayStore(s => s.resolvedClipUrls[clip.id]);
  const blurUrl = useTodayStore(s => s.resolvedClipBlurThumbnails[clip.id]);
  const metadata = useMemo(() => {
    return parseMediaMetadata(clip.metadata);
  }, [clip.metadata]);

  const isPhoto = metadata?.mediaType === 'photo' || clip.mediaType === 'photo';
  const mediaPlaybackStyle = {};

  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const wasCurrentRef = useRef(isCurrent);
  const [photoUri, setPhotoUri] = useState<string | null>(url);
  const playbackStateRef = useRef({ isCurrent, isPaused, isFocused });
  const onEndRef = useRef(onEnd);
  const onPlaybackReadyRef = useRef(onPlaybackReady);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  const didHandleEndRef = useRef(false);
  const didReportPlaybackReadyRef = useRef(false);
  const hasRenderedFrameRef = useRef(false);
  const maxPlaybackTimeRef = useRef(0);
  const lastProgressLogSecondRef = useRef(-1);
  const lastPlaybackRecoveryAtRef = useRef(0);
  const isMountedRef = useRef(true);
  playbackStateRef.current = { isCurrent, isPaused, isFocused };
  onEndRef.current = onEnd;
  onPlaybackReadyRef.current = onPlaybackReady;
  onPlaybackErrorRef.current = onPlaybackError;

  const reportPlaybackReady = (signal: string) => {
    // Adjacent layers keep a hidden VideoView mounted to warm their first
    // frame. Only the visible layer may satisfy active playback/seen tracking.
    if (!playbackStateRef.current.isCurrent) return;
    if (didReportPlaybackReadyRef.current) return;
    didReportPlaybackReadyRef.current = true;
    debugFeedVideo('playback-ready', { clipId: clip.id, signal });
    onPlaybackReadyRef.current(clip.id, signal);
  };

  useEffect(() => {
    isMountedRef.current = true;
    debugFeedVideo('mount', {
      clipId: clip.id,
      mediaType: metadata?.mediaType || clip.mediaType || 'vlog',
      isPhoto,
      isCurrent,
      isPaused,
      isFocused,
      source: describePlaybackSource(url),
    });
    return () => {
      isMountedRef.current = false;
      debugFeedVideo('unmount', {
        clipId: clip.id,
        maxPlaybackTime: maxPlaybackTimeRef.current,
      });
    };
  }, [clip.id]);

  useEffect(() => {
    setIsVideoLoaded(false);
    setStreamUrl(null);
    didHandleEndRef.current = false;
    didReportPlaybackReadyRef.current = false;
    hasRenderedFrameRef.current = false;
    maxPlaybackTimeRef.current = 0;
    lastProgressLogSecondRef.current = -1;
    debugFeedVideo('clip-reset', {
      clipId: clip.id,
      source: describePlaybackSource(url),
    });
  }, [clip.id]);

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
      .catch((error) => console.warn('[FeedVideoLayer] Photo cache failed; using remote image:', error));
    return () => { isActive = false; };
  }, [isPhoto, url]);

  // FIX: Initialize empty player instance with `null` to prevent AVFoundation load crash
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    debugFeedVideo('visual-state', {
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

  // Use the signed remote source directly on both platforms. A data refresh
  // can rotate the signed URL without changing the underlying clip. Never
  // replace the source of the clip that is currently playing: replaceAsync()
  // resets playback to zero. The fresh URL is picked up as soon as this layer
  // becomes inactive, keeping the current session uninterrupted while still
  // refreshing adjacent preloaded media.
  useEffect(() => {
    if (isPhoto || !url) {
      if (!isPhoto) {
        debugFeedVideo('source-missing', {
          clipId: clip.id,
          isPhoto,
          source: describePlaybackSource(url),
        });
      }
      return;
    }
    if (isCurrent && streamUrl) {
      if (streamUrl !== url) {
        debugFeedVideo('source-refresh-deferred-active-playback', {
          clipId: clip.id,
          activeSource: describePlaybackSource(streamUrl),
          refreshedSource: describePlaybackSource(url),
        });
      }
      return;
    }
    debugFeedVideo('source-selected', {
      clipId: clip.id,
      source: describePlaybackSource(url),
    });
    setStreamUrl(url);
  }, [clip.id, url, isPhoto, isCurrent, streamUrl]);

  // Feed the resolved stream URL directly to the player when it's ready.
  useEffect(() => {
    if (!streamUrl || !player) return;
    let isActive = true;
    let stalledTimer: ReturnType<typeof setTimeout> | null = null;

    const loadPlayer = async () => {
      const startedAt = Date.now();
      try {
        didHandleEndRef.current = false;
        hasRenderedFrameRef.current = false;
        maxPlaybackTimeRef.current = 0;
        debugFeedVideo('load-start', {
          clipId: clip.id,
          platform: Platform.OS,
          playerStatus: player.status,
          source: describePlaybackSource(streamUrl),
        });
        void probeHlsSource(clip.id, streamUrl);
        stalledTimer = setTimeout(() => {
          if (!isActive || !isMountedRef.current) return;
          debugFeedVideo('load-stalled-8s', {
            clipId: clip.id,
            playerStatus: player.status,
            currentTime: player.currentTime,
            duration: player.duration,
            playing: player.playing,
            source: describePlaybackSource(streamUrl),
          });
        }, 8000);
        const playbackUrl = Platform.OS === 'android'
          ? await prepareAndroidHlsPlayback(clip.id, streamUrl)
          : streamUrl;
        if (!isActive || !isMountedRef.current) return;
        debugFeedVideo('playback-source-ready', {
          clipId: clip.id,
          source: describePlaybackSource(playbackUrl),
          rewrittenForAndroid: playbackUrl !== streamUrl,
          platform: Platform.OS,
        });
        await player.replaceAsync(playbackUrl);
        if (!isActive || !isMountedRef.current) return;
        debugFeedVideo('load-complete', {
          clipId: clip.id,
          elapsedMs: Date.now() - startedAt,
          duration: player.duration,
          status: player.status,
        });
        // If this layer happens to be the active one right now, start playing
        const playbackState = playbackStateRef.current;
        if (isActive && playbackState.isCurrent && playbackState.isFocused && !playbackState.isPaused) {
          debugFeedVideo('play-after-load', {
            clipId: clip.id,
            status: player.status,
          });
          player.play();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!isActive || !isMountedRef.current) {
          debugFeedVideo('load-cancelled-after-unmount', {
            clipId: clip.id,
            elapsedMs: Date.now() - startedAt,
            message: errorMessage,
          });
          return;
        }
        console.warn("[FeedVideoLayer] Replace error:", {
          clipId: clip.id,
          elapsedMs: Date.now() - startedAt,
          playerStatus: player.status,
          message: errorMessage,
        });
        if (isActive && isMountedRef.current) {
          try {
            debugFeedVideo('load-retry-start', {
              clipId: clip.id,
              source: describePlaybackSource(streamUrl),
            });
            const retryUrl = Platform.OS === 'android'
              ? await prepareAndroidHlsPlayback(clip.id, streamUrl)
              : streamUrl;
            if (!isActive || !isMountedRef.current) return;
            await player.replaceAsync(retryUrl);
            if (!isActive || !isMountedRef.current) return;
            debugFeedVideo('load-retry-complete', {
              clipId: clip.id,
              playerStatus: player.status,
              duration: player.duration,
            });
            const playbackState = playbackStateRef.current;
            if (playbackState.isCurrent && playbackState.isFocused && !playbackState.isPaused) {
              player.play();
            }
          } catch (fallbackError) {
            if (isActive && isMountedRef.current) {
              console.warn("[FeedVideoLayer] Uncached retry failed:", fallbackError);
            }
          }
        }
      } finally {
        if (stalledTimer) clearTimeout(stalledTimer);
      }
    };

    loadPlayer();
    return () => {
      isActive = false;
      if (stalledTimer) clearTimeout(stalledTimer);
    };
  }, [streamUrl, player, clip.id]);

  // Handle PlayToEnd event
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
      debugFeedVideo('play-to-end', {
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
      if (
        playbackState.isCurrent &&
        playbackState.isFocused &&
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
    const statusSub = player.addListener('statusChange', ({ status, oldStatus, error }) => {
      if (!isMountedRef.current) return;
      debugFeedVideo('status-change', {
        clipId: clip.id,
        status,
        oldStatus,
        error: error?.message || null,
        currentTime: player.currentTime,
        duration: player.duration,
      });
      if (status === 'readyToPlay') {
        setIsVideoLoaded(true);
        const playbackState = playbackStateRef.current;
        if (
          playbackState.isCurrent &&
          playbackState.isFocused &&
          !playbackState.isPaused &&
          !player.playing
        ) {
          debugFeedVideo('play-on-ready', {
            clipId: clip.id,
            oldStatus,
          });
          player.play();
        }
      }
      if (status === 'error') {
        setIsVideoLoaded(false);
        onPlaybackErrorRef.current(clip.id, error?.message || null);
      }
    });
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      if (!isMountedRef.current) return;
      debugFeedVideo('playing-change', {
        clipId: clip.id,
        isPlaying,
        playerStatus: player.status,
        currentTime: player.currentTime,
        duration: player.duration,
      });
      if (isPlaying) {
        setIsVideoLoaded(true);
        reportPlaybackReady('playing-change');
      }
    });
    const sourceLoadSub = player.addListener('sourceLoad', ({ duration, availableVideoTracks, availableAudioTracks }) => {
      if (!isMountedRef.current) return;
      debugFeedVideo('source-load', {
        clipId: clip.id,
        duration,
        videoTrackCount: availableVideoTracks.length,
        audioTrackCount: availableAudioTracks.length,
      });
    });
    return () => {
      statusSub.remove();
      playingSub.remove();
      sourceLoadSub.remove();
    };
  }, [player, isPhoto, clip.id]);

  // Dedicated Play/Pause state controller
  useEffect(() => {
    if (isPhoto || !player || !streamUrl) return;
    const shouldPlay = isCurrent && isFocused && !isPaused;
    debugFeedVideo('playback-controller', {
      clipId: clip.id,
      shouldPlay,
      isCurrent,
      isFocused,
      isPaused,
      playerStatus: player.status,
      playing: player.playing,
    });
    if (shouldPlay) {
      if (player.status !== 'error') player.play();
    } else {
      player.pause();
    }
  }, [clip.id, isCurrent, isFocused, isPaused, player, isPhoto, streamUrl]);

  // Adjacent clips remain mounted for preloading. Reset a clip when the user
  // advances away from it so returning never resumes the skipped position.
  useEffect(() => {
    if (wasCurrentRef.current && !isCurrent && !isPhoto && player) {
      player.pause();
      player.currentTime = 0;
    }
    wasCurrentRef.current = isCurrent;
  }, [isCurrent, isPhoto, player]);

  // Progress and Speed adjustments mapping
  useEffect(() => {
    let interval: any;
    if (isCurrent && isFocused && !isPaused && !isPhoto) {
      interval = setInterval(() => {
        if (!isMountedRef.current) return;
        if (player.status === 'readyToPlay' && !player.playing) {
          const now = Date.now();
          if (now - lastPlaybackRecoveryAtRef.current >= 1000) {
            lastPlaybackRecoveryAtRef.current = now;
            debugFeedVideo('recover-ready-player', {
              clipId: clip.id,
              currentTime: player.currentTime,
              duration: player.duration,
            });
            player.play();
          }
        }
        if (player.duration && player.currentTime !== undefined) {
          const current = player.currentTime;
          maxPlaybackTimeRef.current = Math.max(maxPlaybackTimeRef.current, current);
          const currentSecond = Math.floor(current);
          if (
            currentSecond !== lastProgressLogSecondRef.current &&
            (currentSecond === 0 || currentSecond % 2 === 0)
          ) {
            lastProgressLogSecondRef.current = currentSecond;
            debugFeedVideo('progress', {
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
            reportPlaybackReady('progress');
          }
          onProgress((current / player.duration) * 100);

          try {
            // Segmented recordings have speed permanently baked by the
            // transcoder. Legacy clips may still rely on playback metadata.
            const segs = metadata?.speedBaked ? undefined : metadata?.speedSegments;
            if (segs?.length) {
              const activeSeg = [...segs].reverse().find((s: any) => current >= s.start);
              const targetSpeed = activeSeg ? activeSeg.speed : 1;
              if (player.playbackRate !== targetSpeed) player.playbackRate = targetSpeed;
            }
          } catch { }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [clip.id, isCurrent, isFocused, isPaused, player, isPhoto, metadata, onProgress]);

  useImperativeHandle(ref, () => ({
    scrub: (startTime: number, diffX: number, elapsedMs: number) => {
      if (isPhoto || !player) return null;
      if (player.duration && player.currentTime !== undefined) {
        const speed = Math.min(8, 0.75 + Math.abs(diffX) / 75);
        let newTime = startTime + Math.sign(diffX) * speed * (elapsedMs / 1000);
        newTime = Math.max(0, Math.min(player.duration, newTime));
        player.currentTime = newTime;
        return (newTime / player.duration) * 100;
      }
      return null;
    },
    getCurrentTime: () => player?.currentTime ?? 0,
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
    }
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
          <VideoView
            player={player}
            style={[styles.fullscreenMedia, mediaPlaybackStyle]}
            contentFit="cover"
            nativeControls={false}
            surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
            onFirstFrameRender={() => {
              if (!isMountedRef.current) return;
              debugFeedVideo('first-frame', {
                clipId: clip.id,
                currentTime: player.currentTime,
                duration: player.duration,
                playerStatus: player.status,
                isCurrent: playbackStateRef.current.isCurrent,
              });
              hasRenderedFrameRef.current = true;
              setIsVideoLoaded(true);
              reportPlaybackReady('first-frame');
            }}
          />

          {!isVideoLoaded && blurUrl && (
            <Animated.Image
              exiting={FadeOut.duration(300)}
              source={{ uri: blurUrl }}
              style={[styles.fullscreenMedia, mediaPlaybackStyle, { zIndex: 10 }]}
              blurRadius={20}
            />
          )}
        </>
      )}
    </View>
  );
});

function getClipsForSlot(clips: any[], slotIdx: number, timezone?: string) {
  return clips.filter((c) => getSlotForClip(c.recordedAt, timezone) === slotIdx);
}

function currentClipSubIndexInSlot(slotClips: any[], activeClip: any) {
  if (!activeClip) return 0;
  const idx = slotClips.findIndex(c => c.id === activeClip.id);
  return idx === -1 ? 0 : idx;
}

function FloatingFeedNode({
  item,
  onComplete,
  onOpenComments,
  onOpenViews
}: {
  item: FloatingFeedItem;
  onComplete: () => void;
  onOpenComments: () => void;
  onOpenViews: () => void;
}) {
  const floatY = useSharedValue(SCREEN_HEIGHT * 0.74);
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const driftX = useSharedValue(32);
  const rotation = useSharedValue(0);

  const delay = item.delay;

  // Utilize setTimeout instead of buggy withDelay chains to ensure reliable thread animations
  useEffect(() => {
    const timeout = setTimeout(() => {
      scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.4)) });
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(1800, withTiming(0, { duration: 1000 }))
      );

      floatY.value = withTiming(SCREEN_HEIGHT * 0.46, {
        duration: 5200,
        easing: Easing.out(Easing.quad)
      }, (finished) => {
        if (finished) runOnJS(onComplete)();
      });

      driftX.value = withRepeat(
        withTiming(32 + (Math.random() * 40 - 20), { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );

      rotation.value = withTiming(Math.random() * 24 - 12, { duration: 5200 });
    }, delay);

    return () => clearTimeout(timeout);
  }, [item]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { translateX: driftX.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` }
    ],
    opacity: opacity.value,
  }));

  if (item.type === 'like') {
    return (
      <Animated.View style={[styles.floatingFeedNode, animatedStyle]} pointerEvents="none">
        <View style={styles.avatarLikeWrapper}>
          <Avatar src={item.userImage} name={item.userName} size={32} />
          <View style={styles.heartBadgeCompact}>
            <Heart size={8} color="#fff" fill="#fff" />
          </View>
        </View>
      </Animated.View>
    );
  }

  if (item.type === 'photoResponse') {
    return (
      <Animated.View style={[styles.floatingFeedNode, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenViews}
          style={styles.bubbleImgContainer}
        >
          <Image source={{ uri: item.imageUrl }} style={styles.bubbleImg} />
          <View style={styles.bubbleAvatarWrapper}>
            <Avatar src={item.userImage} name={item.userName} size={18} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.floatingFeedNode, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onOpenComments}
        style={styles.commentPillGlassCompact}
      >
        <Avatar src={item.userImage} name={item.userName} size={20} />
        <Text weight="bold" className="text-white text-[11px] font-semibold">
          @{item.userName.toLowerCase().replace(/\s+/g, '')}:
        </Text>
        <Text className="text-white/90 text-[11px] truncate max-w-[120px]" numberOfLines={1}>
          {item.text}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function DoubleTapHeart({ heart, onComplete }: { heart: any; onComplete: () => void }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = Math.random() * 30 - 15;

    scale.value = withSequence(
      withTiming(1.25, { duration: 140, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(1, { duration: 100 }),
      withDelay(450, withTiming(0, { duration: 200 }))
    );

    opacity.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withDelay(450, withTiming(0, { duration: 200 }))
    );

    translateY.value = withTiming(-60, { duration: 700, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
  }, [heart]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.doubleTapHeart,
        { left: heart.x - 40, top: heart.y - 40 },
        animatedStyle
      ]}
      pointerEvents="none"
    >
      <View style={styles.doubleTapHeartWrapper}>
        <Heart size={80} color="#ff3b30" fill="#ff3b30" />
      </View>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const groupStore = useGroupStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const todayStore = useTodayStore();
  const uploadTasks = useUploadQueueStore((state) => state.tasks);
  const isUploadBannerTucked = useUploadQueueStore((state) => state.isBannerTucked);
  const requestUploadBannerReveal = useUploadQueueStore((state) => state.requestBannerReveal);
  const { locale } = useTranslation();
  const currentUserId = storage.getString('auth_user_id') || "";
  const notificationParams = useLocalSearchParams<{
    groupId?: string;
    clipId?: string;
    focus?: string;
    itemId?: string;
    userId?: string;
  }>();
  const handledNotificationRef = useRef<string | null>(null);

  const videoProgress = useSharedValue(0);

  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [isViewsOpen, setIsViewsOpen] = useState(false);
  const [highlightedReactionUserId, setHighlightedReactionUserId] = useState<string | null>(null);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const currentVideoRef = useRef<FeedVideoLayerRef>(null);
  const commentsOpenRef = useRef(false);
  const deferredCommentSheetAdvanceRef = useRef<string | null>(null);

  const handleOpenComments = useCallback(() => {
    commentsOpenRef.current = true;
    deferredCommentSheetAdvanceRef.current = null;
    setIsCommentsOpen(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    commentsOpenRef.current = false;
    setIsCommentsOpen(false);
    setHighlightedCommentId(null);

    const endedClipId = deferredCommentSheetAdvanceRef.current;
    deferredCommentSheetAdvanceRef.current = null;
    if (!endedClipId) return;

    const currentState = useTodayStore.getState();
    const currentClip = currentState.clips[currentState.currentClipIndex];
    if (currentClip?.id !== endedClipId) return;

    const isLastClipOverall = currentState.clips.length > 0
      && endedClipId === currentState.clips[currentState.clips.length - 1].id;
    if (!isLastClipOverall) {
      currentState.nextSubClip();
    }
  }, []);

  const [gestureHUD, setGestureHUD] = useState<"none" | "paused" | "rewind" | "fastforward">("none");
  const [seekProgress, setSeekProgress] = useState<number | null>(null);
  const [scrubIndicatorText, setScrubIndicatorText] = useState("");

  const leftTapAlpha = useSharedValue(0);
  const rightTapAlpha = useSharedValue(0);

  const leftTapStyle = useAnimatedStyle(() => ({
    opacity: leftTapAlpha.value,
  }));
  const rightTapStyle = useAnimatedStyle(() => ({
    opacity: rightTapAlpha.value,
  }));

  const [floatingFeed, setFloatingFeed] = useState<FloatingFeedItem[]>([]);
  const [doubleTapHearts, setDoubleTapHearts] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const [selectedPhotoResponseIndex, setSelectedPhotoResponseIndex] = useState<number | null>(null);
  const [playbackReadyClipId, setPlaybackReadyClipId] = useState<string | null>(null);

  const activeClip = todayStore.clips[todayStore.currentClipIndex];
  const uploadProgress = useMemo(() => {
    const tasks = Object.values(uploadTasks);
    const totalBytes = tasks.reduce((sum, task) => sum + task.totalSize, 0);
    if (!totalBytes) return 0;
    const sentBytes = tasks.reduce((sum, task) => {
      if (task.status === 'processing' || task.status === 'completed') return sum + task.totalSize;
      return sum + task.chunks.reduce((chunkSum, chunk) => chunkSum + chunk.bytesSent, 0);
    }, 0);
    return Math.min(100, Math.round((sentBytes / totalBytes) * 100));
  }, [uploadTasks]);
  const isUploadProcessing = Object.values(uploadTasks).some((task) => task.status === 'processing');
  const uploadButtonLabel = isUploadProcessing ? 'İşleniyor' : `%${uploadProgress}`;
  const activeClipUrl = activeClip ? todayStore.resolvedClipUrls[activeClip.id] : null;
  const activeClipThumbnailUrl = activeClip
    ? todayStore.resolvedClipThumbnails[activeClip.id] || todayStore.resolvedClipBlurThumbnails[activeClip.id]
    : null;
  const [isHeaderBackgroundLight, setIsHeaderBackgroundLight] = useState(false);
  const hasResponded = activeClip?.photoResponses?.some(
    (res: any) => (!res.mediaType || res.mediaType === 'photo')
      && (res.user?.id === currentUserId || res.userId === currentUserId)
  ) || false;
  const todayGuideSteps = useMemo(() => {
    const responseCount = activeClip?.photoResponses?.filter(
      (res: any) => !res.mediaType || res.mediaType === 'photo',
    ).length || 0;
    return getGuideDefinition('today', locale).steps.filter((step) => {
      if (step.motion === 'responseOpen' || step.motion === 'responseDismiss') return responseCount > 0;
      if (step.motion === 'responseBrowse') return responseCount > 1;
      if (step.motion === 'photoResponse') return !hasResponded;
      return true;
    });
  }, [activeClip?.id, activeClip?.photoResponses?.length, hasResponded, locale]);
  const todayGuide = useLiveGuide({
    guideId: 'today',
    steps: todayGuideSteps,
    enabled: Boolean(isFocused && activeClipUrl && !showRevealModal),
    delay: 900,
    isStepAvailable: (step) => {
      if (step.motion === 'edges') return todayStore.clips.length > 1;
      if (step.motion === 'timeline') return todayStore.clips.length > 1;
      if (step.motion === 'hold') return !(
        activeClip?.mediaType === 'photo'
        || parseMediaMetadata(activeClip?.metadata)?.mediaType === 'photo'
      );
      return true;
    },
  });
  const responseGuideVisible = todayGuide.visible
    && (todayGuide.step?.motion === 'responseBrowse' || todayGuide.step?.motion === 'responseDismiss');

  useEffect(() => {
    const clipId = typeof notificationParams.clipId === 'string' ? notificationParams.clipId : null;
    const groupId = typeof notificationParams.groupId === 'string' ? notificationParams.groupId : null;
    const focus = typeof notificationParams.focus === 'string' ? notificationParams.focus : null;
    const itemId = typeof notificationParams.itemId === 'string' ? notificationParams.itemId : null;
    const userId = typeof notificationParams.userId === 'string' ? notificationParams.userId : null;
    if (!clipId || !groupId || todayStore.loadedGroupId !== groupId) return;

    const notificationKey = [groupId, clipId, focus, itemId, userId].join(':');
    if (handledNotificationRef.current === notificationKey) return;
    if (!todayStore.selectClip(clipId)) {
      handledNotificationRef.current = notificationKey;
      router.replace({
        pathname: '/(app)/streaks',
        params: { groupId, clipId },
      } as never);
      return;
    }
    handledNotificationRef.current = notificationKey;

    if (focus === 'comments') {
      setHighlightedCommentId(itemId);
      handleOpenComments();
    } else if (focus === 'responses') {
      const clip = useTodayStore.getState().clips.find((candidate) => candidate.id === clipId);
      const responseIndex = clip?.photoResponses?.findIndex((response: any) => response.id === itemId) ?? -1;
      setSelectedPhotoResponseIndex(responseIndex >= 0 ? responseIndex : 0);
    } else if (focus === 'reactions') {
      setHighlightedReactionUserId(userId);
      setIsViewsOpen(true);
    }
  }, [notificationParams, todayStore.loadedGroupId, todayStore.clips, router, handleOpenComments]);

  useEffect(() => {
    let isActive = true;
    if (!activeClip?.id || !activeClipThumbnailUrl) {
      setIsHeaderBackgroundLight(false);
      return () => { isActive = false; };
    }

    // A thumbnail is stable for the clip and much cheaper to inspect than live video
    // frames. The palette result is cached by clip so swiping back does no extra work.
    getColors(activeClipThumbnailUrl, {
      fallback: '#000000',
      cache: true,
      key: `today-header-${activeClip.id}`,
      quality: 'lowest',
      pixelSpacing: 8,
    })
      .then((colors) => {
        if (!isActive) return;
        const background = colors.platform === 'ios'
          ? colors.background
          : colors.platform === 'android'
            ? colors.average
            : colors.dominant;
        setIsHeaderBackgroundLight(isLightColor(background));
      })
      .catch(() => {
        if (isActive) setIsHeaderBackgroundLight(false);
      });

    return () => { isActive = false; };
  }, [activeClip?.id, activeClipThumbnailUrl]);

  const isSleepMode = todayStore.isSleepMode;
  const timelineTimezone = todayStore.assignment?.group?.timezone || "UTC";
  const uploadedSlots = Array.from(new Set(todayStore.clips.map(c => getSlotForClip(c.recordedAt, timelineTimezone))));

  const isCurrentUserVlogger = todayStore.assignment?.userId === currentUserId;
  const vloggerName = todayStore.assignment?.user?.name || "Vlogger";

  const trackingClipIdsRef = useRef<Set<string>>(new Set());
  const seenExposureRef = useRef<{
    clipId: string | null;
    elapsedMs: number;
    startedAt: number | null;
  }>({ clipId: null, elapsedMs: 0, startedAt: null });
  const prevCommentsLengthRef = useRef(0);
  const prevPhotosLengthRef = useRef(0);

  const isPassedButUnclaimed = todayStore.assignment?.isPassed && !todayStore.assignment?.isClaimed;
  const isAutoPassed = isPassedButUnclaimed && todayStore.assignment?.passedByUserId === null;

  const activeClipMetadata = useMemo(() => {
    if (!activeClip?.metadata) return null;
    try {
      const meta = parseMediaMetadata(activeClip.metadata);
      if (!meta) return;
      return meta;
    } catch {
      return null;
    }
  }, [activeClip?.metadata]);

  const isPhoto = activeClipMetadata?.mediaType === 'photo' || activeClip?.mediaType === 'photo';

  useEffect(() => {
    setPlaybackReadyClipId(null);
  }, [activeClip?.id]);

  const mediaTypeConfig = useMemo(() => {
    const type = activeClipMetadata?.mediaType || activeClip?.mediaType || "vlog";
    switch (type) {
      case "photo":
        return { label: "PHOTO", icon: Camera };
      case "snippet":
        return { label: "SNIPPET", icon: Zap };
      case "vlog":
      default:
        return { label: "VLOG", icon: Film };
    }
  }, [activeClipMetadata, activeClip]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[DEBUG][TodayPlayback] active-clip', {
      clipId: activeClip?.id || null,
      clipIndex: todayStore.currentClipIndex,
      clipCount: todayStore.clips.length,
      hourIndex: todayStore.currentHourIndex,
      mediaType: activeClipMetadata?.mediaType || activeClip?.mediaType || null,
      isPhoto,
      source: describePlaybackSource(activeClipUrl),
      transcodeStatus: activeClip?.transcodeStatus || null,
      hasHlsUrl: Boolean(activeClip?.hlsUrl),
    });
  }, [
    activeClip?.id,
    activeClip?.hlsUrl,
    activeClip?.mediaType,
    activeClip?.transcodeStatus,
    activeClipMetadata?.mediaType,
    activeClipUrl,
    isPhoto,
    todayStore.clips.length,
    todayStore.currentClipIndex,
    todayStore.currentHourIndex,
  ]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[DEBUG][TodayPlayback] ui-state', {
      clipId: activeClip?.id || null,
      isFocused,
      isPaused: todayStore.isPaused,
      commentsOpen: isCommentsOpen,
      viewsOpen: isViewsOpen,
      photoCaptureOpen: isPhotoCaptureOpen,
      profileOpen: isProfileOpen,
      revealOpen: showRevealModal,
      responseOpen: selectedPhotoResponseIndex !== null,
      guideVisible: todayGuide.visible,
      guideStep: todayGuide.step?.motion || null,
      guideStepIndex: todayGuide.stepIndex,
      playbackReady: Boolean(activeClip?.id && playbackReadyClipId === activeClip.id),
    });
  }, [
    activeClip?.id,
    isFocused,
    todayStore.isPaused,
    isCommentsOpen,
    isViewsOpen,
    isPhotoCaptureOpen,
    isProfileOpen,
    showRevealModal,
    selectedPhotoResponseIndex,
    todayGuide.visible,
    todayGuide.step?.motion,
    todayGuide.stepIndex,
    playbackReadyClipId,
  ]);

  const publishTime = useMemo(() => {
    if (!activeClip?.recordedAt) return '';
    const publishedAt = new Date(activeClip.recordedAt);
    if (!Number.isFinite(publishedAt.getTime())) return '';
    return formatBusinessDate(
      publishedAt,
      todayStore.assignment?.group?.timezone || 'UTC',
      { hour: '2-digit', minute: '2-digit', hour12: false },
    );
  }, [activeClip?.recordedAt, todayStore.assignment?.group?.timezone]);

  const businessClock = getBusinessClock(new Date(), todayStore.assignment?.group?.timezone || "UTC");
  const tzMinutes = businessClock.hour * 60 + businessClock.minute;

  const canPass = isCurrentUserVlogger && !todayStore.assignment?.isPassed && !todayStore.assignment?.isMandatory && tzMinutes < 810 && todayStore.clips.length === 0;

  useEffect(() => {
    const uid = storage.getString('auth_user_id') || "";
    if (todayStore.assignment?.id && todayStore.assignment?.user && !todayStore.isSleepMode && isFocused) {
      const assignmentId = todayStore.assignment.id;

      const revealedRaw = storage.getString('revealed_assignments') || "[]";
      let alreadyRevealed = false;
      try {
        const revealedList = JSON.parse(revealedRaw);
        alreadyRevealed = Array.isArray(revealedList) && revealedList.includes(assignmentId);
      } catch (e) {
        alreadyRevealed = false;
      }

      const legacyKey = `vlogger_revealed_${uid}_${assignmentId}`;
      if (storage.getBoolean(legacyKey)) {
        alreadyRevealed = true;
      }

      if (!alreadyRevealed) {
        setShowRevealModal(true);
      }
    }
  }, [todayStore.assignment, todayStore.isSleepMode, isFocused]);

  const handleCloseRevealModal = () => {
    const uid = storage.getString('auth_user_id') || "";
    if (todayStore.assignment?.id) {
      const assignmentId = todayStore.assignment.id;

      const revealedRaw = storage.getString('revealed_assignments') || "[]";
      try {
        const revealedList = JSON.parse(revealedRaw);
        if (Array.isArray(revealedList) && !revealedList.includes(assignmentId)) {
          revealedList.push(assignmentId);
          storage.set('revealed_assignments', JSON.stringify(revealedList));
        }
      } catch (e) {
        storage.set('revealed_assignments', JSON.stringify([assignmentId]));
      }

      const legacyKey = `vlogger_revealed_${uid}_${assignmentId}`;
      storage.set(legacyKey, true);
    }
    setShowRevealModal(false);
  };

  const photoPlaybackRef = useRef<{ start: number, pausedAt: number }>({ start: 0, pausedAt: 0 });

  useEffect(() => {
    videoProgress.value = 0;
    if (isPhoto) {
      photoPlaybackRef.current = { start: Date.now(), pausedAt: 0 };
    }
  }, [activeClip?.id, isPhoto, videoProgress]);

  useEffect(() => {
    let interval: any;
    if (activeClipUrl && isFocused) {
      if (isPhoto) {
        interval = setInterval(() => {
          if (todayStore.isPaused) {
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
              if (commentsOpenRef.current && activeClip) {
                deferredCommentSheetAdvanceRef.current = activeClip.id;
                videoProgress.value = 0;
                return;
              }
              const isLastClipOverall = activeClip && todayStore.clips.length > 0 && activeClip.id === todayStore.clips[todayStore.clips.length - 1].id;
              if (!isLastClipOverall) {
                if (__DEV__) {
                  console.log('[DEBUG][TodayPlayback] photo-auto-advance', {
                    clipId: activeClip?.id || null,
                    clipIndex: todayStore.currentClipIndex,
                  });
                }
                todayStore.nextSubClip();
              } else {
                videoProgress.value = 0;
              }
            } else {
              videoProgress.value = withTiming((elapsed / 4000) * 100, {
                duration: 70,
                easing: Easing.linear,
              });
            }
          }
        }, 50);
      }
    }
    return () => clearInterval(interval);
  }, [activeClipUrl, todayStore.isPaused, isFocused, activeClip, isPhoto, todayStore, videoProgress]);

  const isActiveClipVisible = Boolean(
    activeClip &&
    activeClipUrl &&
    isFocused &&
    !todayStore.isPaused &&
    (isPhoto || playbackReadyClipId === activeClip.id) &&
    selectedPhotoResponseIndex === null &&
    !isCommentsOpen &&
    !isViewsOpen &&
    !isPhotoCaptureOpen &&
    !isProfileOpen &&
    !showRevealModal
  );

  useEffect(() => {
    const clipId = activeClip?.id || null;
    const exposure = seenExposureRef.current;

    if (exposure.clipId !== clipId) {
      exposure.clipId = clipId;
      exposure.elapsedMs = 0;
      exposure.startedAt = null;
    }

    if (!clipId || !isActiveClipVisible || trackingClipIdsRef.current.has(clipId)) {
      return;
    }

    exposure.startedAt = Date.now();
    const remainingMs = Math.max(0, SEEN_MEDIA_VIEW_THRESHOLD_MS - exposure.elapsedMs);
    const recordSeenClip = () => {
      if (
        seenExposureRef.current.clipId !== clipId ||
        trackingClipIdsRef.current.has(clipId)
      ) return;

      trackingClipIdsRef.current.add(clipId);
      seenExposureRef.current.elapsedMs = SEEN_MEDIA_VIEW_THRESHOLD_MS;
      seenExposureRef.current.startedAt = null;

      void useTodayStore.getState().trackView(clipId).catch(() => {
        // Keep the local seen marker even when the server-side view request fails.
      });
    };
    const timer = setTimeout(recordSeenClip, remainingMs);

    return () => {
      clearTimeout(timer);
      if (exposure.clipId === clipId && exposure.startedAt !== null) {
        exposure.elapsedMs = Math.min(
          SEEN_MEDIA_VIEW_THRESHOLD_MS,
          exposure.elapsedMs + (Date.now() - exposure.startedAt)
        );
        exposure.startedAt = null;
        if (exposure.elapsedMs >= SEEN_MEDIA_VIEW_THRESHOLD_MS) {
          recordSeenClip();
        }
      }
    };
  }, [activeClip?.id, isActiveClipVisible]);

  useEffect(() => {
    if (!activeClip || !isFocused) {
      setFloatingFeed([]);
      return;
    }

    const initialFeed: FloatingFeedItem[] = [];
    let currentDelay = 400;

    const members = todayStore.assignment?.group?.members || [];

    (activeClip.reactions || []).forEach((reaction: any) => {
      const matchedMember = members.find((m: any) => m.userId === reaction.userId)?.user;
      initialFeed.push({
        id: Crypto.randomUUID(),
        sourceId: reaction.id,
        type: 'like',
        userImage: matchedMember?.image || null,
        userName: matchedMember?.name || "Member",
        delay: currentDelay,
      });
      currentDelay += Math.random() * 800 + 600;
    });

    (activeClip.photoResponses || []).forEach((photo: any) => {
      initialFeed.push({
        id: Crypto.randomUUID(),
        sourceId: photo.id,
        type: 'photoResponse',
        userImage: photo.user?.image || null,
        userName: photo.user?.name || "Member",
        imageUrl: photo.imageUrl,
        delay: currentDelay,
      });
      currentDelay += Math.random() * 1000 + 800;
    });

    (activeClip.comments || [])
      .filter((comment: any) => !comment.parentId)
      .forEach((comment: any) => {
        initialFeed.push({
          id: Crypto.randomUUID(),
          sourceId: comment.id,
          type: 'comment',
          userImage: comment.user?.image || null,
          userName: comment.user?.name || comment.user?.handle || "Member",
          text: comment.text,
          delay: currentDelay,
        });
        currentDelay += Math.random() * 1000 + 800;
      });

    setFloatingFeed(initialFeed);
    prevCommentsLengthRef.current = activeClip.comments?.length || 0;
    prevPhotosLengthRef.current = activeClip.photoResponses?.length || 0;
  }, [activeClip?.id, todayStore.assignment, isFocused]);

  useEffect(() => {
    if (activeClip) {
      const currentComments = activeClip.comments || [];
      if (currentComments.length > prevCommentsLengthRef.current) {
        const newTopLevelComments = currentComments
          .slice(prevCommentsLengthRef.current)
          .filter((comment: any) => !comment.parentId);
        if (newTopLevelComments.length > 0) {
          setFloatingFeed(prev => [
            ...prev,
            ...newTopLevelComments.map((newComment: any) => ({
              id: Crypto.randomUUID(),
              sourceId: newComment.id,
              type: 'comment',
              userImage: newComment.user?.image || null,
              userName: newComment.user?.name || newComment.user?.handle || "Member",
              text: newComment.text,
              delay: 0,
            } satisfies FloatingFeedItem)),
          ]);
        }
      }
      prevCommentsLengthRef.current = currentComments.length;
    }
  }, [activeClip?.comments]);

  useEffect(() => {
    if (activeClip) {
      const currentPhotos = activeClip.photoResponses || [];
      if (currentPhotos.length > prevPhotosLengthRef.current) {
        const newPhoto = currentPhotos[currentPhotos.length - 1];
        if (newPhoto) {
          setFloatingFeed(prev => [
            ...prev,
            {
              id: Crypto.randomUUID(),
              sourceId: newPhoto.id,
              type: 'photoResponse',
              userImage: newPhoto.user?.image || null,
              userName: newPhoto.user?.name || "Member",
              imageUrl: newPhoto.imageUrl,
              delay: 0,
            }
          ]);
        }
      }
      prevPhotosLengthRef.current = currentPhotos.length;
    }
  }, [activeClip?.photoResponses]);

  const handleLikePress = () => {
    todayStore.toggleLike();
    if (!todayStore.liked) {
      const activeUser = useProfileStore.getState().user;
      setFloatingFeed(prev => [
        ...prev,
        {
          id: Crypto.randomUUID(),
          type: 'like',
          userImage: activeUser.image || null,
          userName: activeUser.name || "Member",
          delay: 0,
        }
      ]);
    }
  };

  const handleDoubleTapLike = (x: number, y: number) => {
    mediumTap();
    if (!todayStore.liked) {
      handleLikePress();
    } else {
      const activeUser = useProfileStore.getState().user;
      setFloatingFeed(prev => [
        ...prev,
        {
          id: Crypto.randomUUID(),
          type: 'like',
          userImage: activeUser.image || null,
          userName: activeUser.name || "Member",
          delay: 0,
        }
      ]);
    }

    const heartId = Crypto.randomUUID();
    setDoubleTapHearts(prev => [...prev, { id: heartId, x, y }]);
  };

  const removeDoubleTapHeart = (id: string) => {
    setDoubleTapHearts(prev => prev.filter(h => h.id !== id));
  };

  const isHoldingRef = useRef(false);
  const scrubStartTimeRef = useRef(0);
  const holdStartedAtRef = useRef(0);
  const scrubTranslationRef = useRef(0);
  const scrubTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (isCommentsOpen || isViewsOpen || isPhotoCaptureOpen || isProfileOpen || showRevealModal) return;
      if (e.x < SCREEN_WIDTH * 0.25) {
        lightTap();
        leftTapAlpha.value = withSequence(
          withTiming(0.78, { duration: 55 }),
          withTiming(0, { duration: 190, easing: Easing.out(Easing.cubic) }),
        );
        todayStore.prevSubClip();
        todayGuide.completeAction('edges');
      } else if (e.x > SCREEN_WIDTH * 0.75) {
        lightTap();
        rightTapAlpha.value = withSequence(
          withTiming(0.78, { duration: 55 }),
          withTiming(0, { duration: 190, easing: Easing.out(Easing.cubic) }),
        );
        todayStore.nextSubClip();
        todayGuide.completeAction('edges');
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((e) => {
      if (isCommentsOpen || isViewsOpen || isPhotoCaptureOpen || isProfileOpen || showRevealModal) return;
      handleDoubleTapLike(e.x, e.y);
      todayGuide.completeAction('doubleTap');
    });

  const longPressPauseGesture = Gesture.LongPress()
    .minDuration(250)
    .maxDistance(10000)
    .runOnJS(true)
    .onStart(() => {
      if (isPhoto) return;
      isHoldingRef.current = true;
      scrubStartTimeRef.current = currentVideoRef.current?.getCurrentTime?.() ?? 0;
      holdStartedAtRef.current = Date.now();
      scrubTranslationRef.current = 0;
      todayStore.setPaused(true);
      todayGuide.completeAction('hold');
      scrubTimerRef.current = setInterval(() => {
        const diffX = scrubTranslationRef.current;
        if (!isHoldingRef.current || Math.abs(diffX) <= 15) return;
        const newProg = currentVideoRef.current?.scrub(
          scrubStartTimeRef.current,
          diffX,
          Date.now() - holdStartedAtRef.current,
        );
        if (newProg !== null && newProg !== undefined) setSeekProgress(newProg);
      }, 50);
    })
    .onFinalize(() => {
      if (!isHoldingRef.current) return;
      isHoldingRef.current = false;
      if (scrubTimerRef.current) clearInterval(scrubTimerRef.current);
      scrubTimerRef.current = null;
      todayStore.setPaused(false);
      setGestureHUD("none");
      setSeekProgress(null);
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .runOnJS(true)
    .onUpdate((e) => {
      if (!isHoldingRef.current) return;
      const diffX = e.translationX;
      scrubTranslationRef.current = diffX;

      if (Math.abs(diffX) > 15) {
        const direction = diffX > 0 ? 1 : -1;
        const speedMultiplier = Math.min(4, 1 + Math.abs(diffX) / 80);

        if (direction === 1) {
          setGestureHUD("fastforward");
          setScrubIndicatorText(`FF >> ${speedMultiplier.toFixed(1)}x`);
        } else {
          setGestureHUD("rewind");
          setScrubIndicatorText(`RW << ${speedMultiplier.toFixed(1)}x`);
        }

        const elapsedMs = Date.now() - holdStartedAtRef.current;
        const newProg = currentVideoRef.current?.scrub(scrubStartTimeRef.current, diffX, elapsedMs);
        if (newProg !== null && newProg !== undefined) {
           setSeekProgress(newProg);
        }
      } else {
        setGestureHUD("paused");
        setSeekProgress(null);
      }
    })
    ;

  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(longPressPauseGesture, panGesture),
    tapGesture
  );

  const handleGroupSwitch = () => {
    if (groupStore.groups.length <= 1) return;

    if (groupStore.groups.length > 2) {
      lightTap();
      setIsGroupSelectorOpen(true);
      return;
    }

    const currentIdx = groupStore.groups.findIndex(g => g.id === groupStore.activeGroupId);
    groupStore.setActiveGroupId(groupStore.groups[(currentIdx + 1) % groupStore.groups.length].id);
  };

  const activeGroup = groupStore.groups.find(g => g.id === groupStore.activeGroupId);
  const isFrozen = activeGroup?.isFrozen || false;
  const graceEnd = activeGroup?.boostGracePeriodEndsAt;
  const daysLeft = graceEnd ? Math.ceil((new Date(graceEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  const timezone = todayStore.assignment?.group?.timezone;
  const activeSlotClipsList = activeGroup ? getClipsForSlot(todayStore.clips, todayStore.currentHourIndex, timezone) : [];

  const displayViews = activeClip?.views?.filter(
    (v: any) => v.userId !== todayStore.assignment?.userId && v.userId !== activeClip?.userId
  ) || [];

  const headerForegroundColor = isHeaderBackgroundLight ? '#111827' : '#FFFFFF';
  const headerMutedColor = isHeaderBackgroundLight ? 'rgba(17,24,39,0.7)' : 'rgba(255,255,255,0.75)';
  const headerDividerColor = isHeaderBackgroundLight ? 'rgba(17,24,39,0.2)' : 'rgba(255,255,255,0.25)';
  const headerTextStyle = isHeaderBackgroundLight ? styles.compactHeaderTextDark : styles.compactHeaderTextLight;
  const headerTextShadowColor = isHeaderBackgroundLight ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.75)';

  const activeGroupMembers = todayStore.assignment?.group?.members || [];
  const mappedLikes = activeClip ? (activeClip.reactions || []).map((reaction: any) => ({
    id: reaction.id,
    user: activeGroupMembers.find((m: any) => m.userId === reaction.userId)?.user || { id: reaction.userId, name: "Member", handle: "" }
  })) : [];

  const hasPostedInCurrentSlot = todayStore.clips.some(c => getSlotForClip(c.recordedAt, timezone) === todayStore.actualHourIndex);
  const groupMembers = todayStore.assignment?.group?.members?.map((m: any) => m.user) || [];

  const pinnedPrompt = activeClip?.prompt || activeClipMetadata?.prompt || null;

  const activeClipCaption = useMemo(() => {
    if (activeClip?.caption?.trim()) {
      return activeClip.caption.trim();
    }
    if (activeClipMetadata?.caption) {
      return activeClipMetadata.caption;
    }
    const firstComment = activeClip?.comments?.[0];
    if (firstComment && firstComment.userId === todayStore.assignment?.userId) {
      return firstComment.text;
    }
    return null;
  }, [activeClip?.caption, activeClipMetadata, activeClip?.comments, todayStore.assignment?.userId]);

  const userClips = todayStore.clips.filter(c => c.userId === currentUserId);
  const hasOnlyPhotos = userClips.length > 0 && userClips.every(c => {
     return parseMediaMetadata(c.metadata)?.mediaType === "photo";
  });
  const needsVideoToComplete = isCurrentUserVlogger && todayStore.assignment?.status === "active" && hasOnlyPhotos;

  const [displayType, setDisplayType] = useState<'prompt' | 'caption'>('prompt');
  const fadeOpacity = useSharedValue(1);

  const swapDisplayType = () => {
    setDisplayType(prev => prev === 'prompt' ? 'caption' : 'prompt');
    fadeOpacity.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
  };

  useEffect(() => {
    if (pinnedPrompt) {
      setDisplayType('prompt');
      fadeOpacity.value = 1;
    } else if (activeClipCaption) {
      setDisplayType('caption');
      fadeOpacity.value = 1;
    }

    if (pinnedPrompt && activeClipCaption) {
      const interval = setInterval(() => {
        fadeOpacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(swapDisplayType)();
        });
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [pinnedPrompt, activeClipCaption]);

  const fadeAnimStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    transform: [
      { translateY: interpolate(fadeOpacity.value, [0, 1], [6, 0]) },
      { scale: interpolate(fadeOpacity.value, [0, 1], [0.97, 1]) },
    ],
  }));

  const isShowingPrompt = Boolean(pinnedPrompt) && (displayType === 'prompt' || !activeClipCaption);
  const displayedFeedCopy = isShowingPrompt ? pinnedPrompt : activeClipCaption;

  const isBootstrappingToday =
    !groupStore.hasLoaded ||
    (!!groupStore.activeGroupId && todayStore.loadedGroupId !== groupStore.activeGroupId);

  if (isBootstrappingToday) {
    return (
      <View style={styles.startupContainer}>
        <Image source={require('../../assets/logo.png')} style={styles.startupLogo} resizeMode="contain" />
      </View>
    );
  }

  const hasNoGroups = groupStore.groups.length === 0;
  if (hasNoGroups) {
    return <JoinOrCreateGroupWall />;
  }

  if (todayStore.assignmentAvailability?.status === 'waiting_for_members') {
    return (
      <WaitingForMembersView
        groupName={activeGroup?.name}
        inviteCode={activeGroup?.inviteCode}
        memberCount={todayStore.assignmentAvailability.memberCount}
        minimumMemberCount={todayStore.assignmentAvailability.minimumMemberCount}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {needsVideoToComplete && (
         <Animated.View entering={FadeInUp.duration(400)} exiting={FadeOutUp.duration(400)} className="absolute top-28 left-4 right-4 z-50 items-center pointer-events-none">
            <GlassView preset="liquid" style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.6)' }}>
               <Text weight="bold" className="text-white text-[11px] text-center">Grevini tamamlamak için bir Vlog veya Snippet paylaşmalısın.</Text>
            </GlassView>
         </Animated.View>
      )}

      {graceEnd && daysLeft >= 0 && !isFrozen && (
         <Animated.View entering={FadeInUp.duration(350)} className="absolute top-16 left-4 right-4 z-50">
            <GlassView preset="frosted" style={styles.graceBanner}>
               <AlertTriangle size={15} color="#facc15" style={{ marginRight: 8, marginTop: 1 }} />
               <Text style={styles.graceBannerText}>Pro Durumu Yakında Bitiyor! 20 üye kapasitesini ve 1080p HD'yi korumak için {daysLeft} gün içinde 1 boost ekleyin.</Text>
            </GlassView>
         </Animated.View>
      )}

      <View style={StyleSheet.absoluteFill} className="bg-black">
        {isSleepMode && !activeClipUrl ? (
          <SleepModeView
            hasVolunteeredForTomorrow={todayStore.hasVolunteeredForTomorrow}
            canVolunteer={todayStore.canVolunteer}
            volunteerEligibilityReason={todayStore.volunteerEligibilityReason}
            isVolunteering={todayStore.isVolunteering}
            volunteerError={todayStore.volunteerError}
            onToggleVolunteer={todayStore.toggleVolunteer}
            onWatchLastVlog={() => router.push("/(app)/streaks")}
          />
        ) : activeClipUrl ? (
          <GestureDetector gesture={composedGesture}>
            <View style={StyleSheet.absoluteFill}>

              {todayStore.clips.map((clip, index) => {
                const shouldPrefetch = Math.abs(index - todayStore.currentClipIndex) <= 1;
                if (!shouldPrefetch) return null;
                return (
                  <FeedVideoLayer
                    key={clip.id}
                    ref={index === todayStore.currentClipIndex ? currentVideoRef : null}
                    clip={clip}
                    isCurrent={index === todayStore.currentClipIndex}
                    isPaused={todayStore.isPaused}
                    isFocused={isFocused}
                    onProgress={(prog) => {
                      videoProgress.value = withTiming(prog, {
                        duration: 120,
                        easing: Easing.linear,
                      });
                    }}
                    onPlaybackReady={(clipId, signal) => {
                      const currentState = useTodayStore.getState();
                      const currentClip = currentState.clips[currentState.currentClipIndex];
                      if (currentClip?.id !== clipId) return;
                      if (__DEV__) {
                        console.log('[DEBUG][TodayPlayback] playback-ready', {
                          clipId,
                          signal,
                        });
                      }
                      setPlaybackReadyClipId(clipId);
                    }}
                    onPlaybackError={(clipId, message) => {
                      if (__DEV__) {
                        console.log('[DEBUG][TodayPlayback] playback-error', {
                          clipId,
                          message,
                        });
                      }
                      setPlaybackReadyClipId((current) => current === clipId ? null : current);
                    }}
                    onEnd={() => {
                      const currentState = useTodayStore.getState();
                      const currentClip = currentState.clips[currentState.currentClipIndex];
                      if (__DEV__) {
                        console.log('[DEBUG][TodayPlayback] layer-end-request', {
                          emittingClipId: clip.id,
                          activeClipId: currentClip?.id || null,
                          currentClipIndex: currentState.currentClipIndex,
                        });
                      }
                      if (currentClip?.id !== clip.id) {
                        if (__DEV__) {
                          console.log('[DEBUG][TodayPlayback] layer-end-rejected-stale', {
                            emittingClipId: clip.id,
                            activeClipId: currentClip?.id || null,
                          });
                        }
                        return;
                      }
                      if (commentsOpenRef.current) {
                        deferredCommentSheetAdvanceRef.current = clip.id;
                        currentVideoRef.current?.replay();
                        return;
                      }
                      const isLastClipOverall = currentState.clips.length > 0
                        && clip.id === currentState.clips[currentState.clips.length - 1].id;
                      if (!isLastClipOverall) {
                        currentState.nextSubClip();
                      } else {
                        currentVideoRef.current?.replay();
                      }
                    }}
                  />
                );
              })}

              <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} locations={[0, 0.25]} style={styles.topGradient} pointerEvents="none" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} locations={[0.6, 1]} style={styles.bottomGradient} pointerEvents="none" />
            </View>
          </GestureDetector>
        ) : (
          <NoClipView
            isCurrentUserVlogger={isCurrentUserVlogger}
            vloggerName={vloggerName}
            vloggerImage={todayStore.assignment?.user?.image}
            poking={todayStore.poking}
            pokeCooldown={todayStore.pokeCooldown}
            hasPostedInCurrentSlot={hasPostedInCurrentSlot}
            isPassedButUnclaimed={isPassedButUnclaimed}
            isAutoPassed={isAutoPassed}
            canPass={canPass}
            onPoke={todayStore.pokeVlogger}
            onRecord={() => router.push("/(app)/record")}
            isFrozen={isFrozen && todayStore.clips.length === 0}
            selectedPeriodState={todayStore.currentHourIndex < todayStore.actualHourIndex ? 'past' : 'current'}
            onPassTurn={async () => {
              try {
                await todayStore.passTurn();
                notifySuccess();
              } catch (e: any) {
                Alert.alert("Error", e.message);
              }
            }}
            onClaimTurn={async () => {
              try {
                await todayStore.claimTurn();
                notifySuccess();
              } catch (e: any) {
                Alert.alert("Error", e.message);
              }
            }}
          />
        )}
      </View>
      <Animated.View style={[styles.tapIndicatorLeft, leftTapStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.34)', 'transparent']}
          locations={[0, 0.42, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.tapIndicatorRight, rightTapStyle]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {activeClipUrl && floatingFeed.map((item) => (
        <FloatingFeedNode
          key={item.id}
          item={item}
          onComplete={() => setFloatingFeed(prev => prev.filter(f => f.id !== item.id))}
          onOpenComments={handleOpenComments}
          onOpenViews={() => {
            if (item.sourceId) {
              const idx = activeClip.photoResponses?.findIndex((p: any) => p.id === item.sourceId);
              if (idx !== -1 && idx !== undefined && idx !== null) {
                setSelectedPhotoResponseIndex(idx);
              }
            }
          }}
        />
      ))}
      {activeClipUrl && doubleTapHearts.map((heart) => (
        <DoubleTapHeart
          key={heart.id}
          heart={heart}
          onComplete={() => removeDoubleTapHeart(heart.id)}
        />
      ))}
      {activeClipUrl && (
        <PhotoResponsesOverlay
          responses={activeClip.photoResponses || []}
          videoProgress={videoProgress}
          externalExpandedIndex={selectedPhotoResponseIndex}
          onExternalClose={() => setSelectedPhotoResponseIndex(null)}
          onResponseSwipe={() => todayGuide.completeAction('responseBrowse')}
          onResponseDismiss={() => todayGuide.completeAction('responseDismiss')}
          liveGuide={responseGuideVisible ? todayGuide : null}
          hasResponded={hasResponded}
          onRespondClick={() => {
            setIsPhotoCaptureOpen(true);
          }}
        />
      )}
      <View
        style={[
          styles.hud,
          {
            paddingTop: Math.max(insets.top, 12),
            // The Android tab bar already owns the navigation/gesture inset.
            // Do not apply the device-reported bottom inset a second time:
            // some phones report a large value here, which lifts the timeline
            // well above the bottom of the Today screen.
            paddingBottom: Platform.OS === 'android'
              ? 8
              : Math.max(insets.bottom, 72),
          },
        ]}
        pointerEvents="box-none"
      >

        {activeClipUrl && (
          <View style={styles.indicatorsWrapper}>
            <StoryIndicators clips={activeSlotClipsList} currentClipSubIndex={currentClipSubIndexInSlot(activeSlotClipsList, activeClip)} videoProgress={videoProgress} />
          </View>
        )}

        <View style={styles.headerRow} pointerEvents="box-none">
          <GlassView
            preset="frosted"
            style={[
              styles.compactHeaderPill,
              isHeaderBackgroundLight ? styles.compactHeaderPillLight : styles.compactHeaderPillDark,
            ]}
            interactive={true}
          >

            <TouchableOpacity onPress={handleGroupSwitch} style={styles.compactSegment} activeOpacity={0.7} className="flex-row items-center">
              <Users size={12} color={headerForegroundColor} />
              <Text weight="bold" style={[styles.compactHeaderText, headerTextStyle]} numberOfLines={1}>{activeGroup?.name || "Grup"}</Text>
              {groupStore.groups.length > 1 && <Repeat size={10} color={headerMutedColor} />}
            </TouchableOpacity>

            <View style={[styles.compactDivider, { backgroundColor: headerDividerColor }]} />

            <TouchableOpacity onPress={() => setIsViewsOpen(true)} style={styles.compactSegment} activeOpacity={0.7} className="flex-row items-center">
              <Eye size={12} color={headerForegroundColor} />
              <Text weight="bold" style={[styles.compactHeaderText, styles.compactHeaderNumericText, headerTextStyle]}>{displayViews.length}</Text>
            </TouchableOpacity>

            <View style={[styles.compactDivider, { backgroundColor: headerDividerColor }]} />

            <View style={styles.compactSegment} className="flex-row items-center">
              <Clock size={12} color={headerForegroundColor} />
              <CountdownTimer
                timezone={todayStore.assignment?.group?.timezone}
                color={headerForegroundColor}
                shadowColor={headerTextShadowColor}
              />
            </View>

            {isUploadBannerTucked && Object.keys(uploadTasks).length > 0 && (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.springify().damping(18)}
                style={styles.uploadPillSegment}
              >
                <View style={[styles.compactDivider, { backgroundColor: headerDividerColor }]} />
                <TouchableOpacity
                  onPress={() => {
                    lightTap();
                    requestUploadBannerReveal();
                  }}
                  style={styles.compactSegment}
                  activeOpacity={0.7}
                  className="flex-row items-center"
                  accessibilityRole="button"
                  accessibilityLabel={isUploadProcessing ? 'Yükleme işleniyor' : `Yükleme ilerlemesi yüzde ${uploadProgress}`}
                >
                  <Animated.View
                    key={uploadButtonLabel}
                    entering={FadeIn.duration(180)}
                    exiting={FadeOut.duration(120)}
                    layout={LinearTransition.duration(220)}
                    style={styles.uploadPillContent}
                  >
                    <Upload size={12} color={headerForegroundColor} />
                    <Text weight="bold" style={[styles.compactHeaderText, styles.compactHeaderNumericText, headerTextStyle]}>
                      {uploadButtonLabel}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            )}

          </GlassView>
        </View>

        {gestureHUD === "paused" && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.scrubHUDContainer}>
            <GlassView style={styles.scrubHUDCircle} preset="specular">
              <Pause size={22} color="#fff" fill="#fff" style={{ zIndex: 10 }} />
            </GlassView>
          </Animated.View>
        )}

        {(gestureHUD === "fastforward" || gestureHUD === "rewind") && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.scrubHUDContainer}>
            <GlassView style={styles.scrubHUDPill} preset="specular">
              <Text weight="bold" className="text-[10px] tracking-widest text-white uppercase">{scrubIndicatorText}</Text>
              {seekProgress !== null && (
                <View style={styles.miniProgressTrack}>
                  <View style={[styles.miniProgressBar, { width: `${seekProgress}%` }]} />
                </View>
              )}
            </GlassView>
          </Animated.View>
        )}

        <View style={styles.middleArea} pointerEvents="box-none" />

        <View style={styles.bottomArea} pointerEvents="box-none">
          {activeClipUrl && (
            <View style={styles.bottomContent} pointerEvents="box-none">
              <View style={styles.bottomLeft} pointerEvents="box-none">

                {mediaTypeConfig && (
                  <View style={styles.clipMetaRow}>
                    <View style={styles.mediaTypeBadge}>
                      <mediaTypeConfig.icon size={11} color="#000000" strokeWidth={2.5} />
                      <Text weight="bold" style={styles.mediaTypeLabel}>{mediaTypeConfig.label}</Text>
                    </View>
                    {publishTime && (
                      <View style={styles.publishTime}>
                        <Text weight="bold" style={styles.publishTimeText}>{publishTime}</Text>
                      </View>
                    )}
                  </View>
                )}

                {todayStore.assignment?.user && (
                  <TouchableOpacity
                    onPress={() => setIsProfileOpen(true)}
                    style={styles.instagramUserRow}
                    activeOpacity={0.8}
                  >
                    <Avatar src={todayStore.assignment.user.image} name={todayStore.assignment.user.name} size={28} />
                    <View style={styles.userTextMeta}>
                      <Text weight="bold" className="text-white text-sm">
                        @{todayStore.assignment.user.handle || todayStore.assignment.user.name?.toLowerCase().replace(/\s+/g, '')}
                      </Text>
                      {activeClip?.location && (
                        <View style={styles.compactLocationRow}>
                          <Navigation size={8} color="rgba(255,255,255,0.6)" fill="rgba(255,255,255,0.6)" />
                          <Text className="text-white/60 text-[9px] font-medium ml-1">
                            {activeClip.location}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}

                {displayedFeedCopy && (
                  <Animated.View
                    entering={FadeInUp.duration(350).easing(Easing.out(Easing.cubic))}
                    exiting={FadeOutUp.duration(250).easing(Easing.in(Easing.cubic))}
                    layout={LinearTransition.duration(400).easing(Easing.bezier(0.25, 1, 0.5, 1))}
                    style={styles.promptDescriptionContainer}
                    pointerEvents="none"
                  >
                    <GlassView
                      preset="liquid"
                      style={styles.promptDescriptionGlass}
                    >
                      <Animated.View style={[styles.promptDescriptionContent, fadeAnimStyle]}>
                        {isShowingPrompt ? (
                          <Image source={require('../../assets/icons/star.png')} style={styles.promptDescriptionIcon} />
                        ) : (
                          <MessageCircle size={18} color="#fff" strokeWidth={2.2} />
                        )}
                        <Text weight="medium" style={styles.notificationPromptText} numberOfLines={3}>
                          {displayedFeedCopy}
                        </Text>
                      </Animated.View>
                    </GlassView>
                  </Animated.View>
                )}
              </View>

              <View style={styles.bottomRight} pointerEvents="box-none">
                <VideoActionBar
                  liked={todayStore.liked}
                  likeCount={todayStore.likeCount}
                  commentCount={activeClip.comments?.length || 0}
                  photoCount={activeClip.photoResponses?.length || 0}
                  onLike={handleLikePress}
                  onOpenComments={handleOpenComments}
                  onPhotoResponseClick={() => {
                    if (activeClip.photoResponses && activeClip.photoResponses.length > 0) {
                      setSelectedPhotoResponseIndex(0);
                      todayGuide.completeAction('responseOpen');
                    }
                  }}
                  onPhotoResponseLongPress={() => {
                    if (!hasResponded) {
                      todayGuide.completeAction('photoResponse');
                      setIsPhotoCaptureOpen(true);
                    } else {
                      Alert.alert("Bilgi", "Bu klipe zaten yanıt verdiniz.");
                    }
                  }}
                />
              </View>
            </View>
          )}

          {(!isSleepMode || (todayStore.assignment?.clips && todayStore.assignment.clips.length > 0)) && (
            <View style={styles.timelineWrapper}>
              <TimelineTracker
                currentHourIndex={todayStore.currentHourIndex}
                actualHourIndex={todayStore.actualHourIndex}
                onHourChange={(idx: number) => {
                  todayStore.setCurrentHourIndex(idx);
                  todayGuide.completeAction('timeline');
                }}
                uploadedSlots={uploadedSlots}
              />
            </View>
          )}
        </View>

      </View>
      <VloggerProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        assignment={todayStore.assignment}
        poking={todayStore.poking}
        pokeCooldown={todayStore.pokeCooldown}
        onPoke={todayStore.pokeVlogger}
      />
      <CommentsSheet isOpen={isCommentsOpen} onClose={handleCloseComments} commentList={activeClip?.comments || []} groupMembers={groupMembers} onAddComment={todayStore.addComment} onToggleCommentLike={todayStore.toggleCommentLike} onDeleteComment={todayStore.deleteComment} currentUserId={currentUserId} highlightedCommentId={highlightedCommentId} />
      <ViewsSheet isOpen={isViewsOpen} onClose={() => { setIsViewsOpen(false); setHighlightedReactionUserId(null); }} views={displayViews} likes={mappedLikes} groupMembers={groupMembers} highlightedUserId={highlightedReactionUserId} />
      <PhotoCaptureModal isOpen={isPhotoCaptureOpen} onClose={() => setIsPhotoCaptureOpen(false)} onUpload={todayStore.uploadPhotoResponse} uploading={todayStore.uploadingPhoto} />
      <GroupSelectorSheet
        isOpen={isGroupSelectorOpen}
        onClose={() => setIsGroupSelectorOpen(false)}
      />
      {todayStore.assignment?.user && showRevealModal && (
        <VloggerRevealModal
          isOpen={showRevealModal}
          onClose={handleCloseRevealModal}
          user={todayStore.assignment.user}
        />
      )}
      {!responseGuideVisible
        && !isCommentsOpen
        && !isViewsOpen
        && !isPhotoCaptureOpen
        && !isProfileOpen
        && !isGroupSelectorOpen
        && !showRevealModal
        && (
          <LiveGuideCoachmark
            visible={todayGuide.visible}
            step={todayGuide.step}
            stepIndex={todayGuide.stepIndex}
            totalSteps={todayGuide.totalSteps}
            stepComplete={todayGuide.stepComplete}
            onBack={todayGuide.goBack}
            onSkipStep={todayGuide.skipStep}
            onClose={todayGuide.skipTour}
            placement="top"
            topOffset={96}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  startupContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  startupLogo: { width: 112, height: 112 },
  topGradient: { ...StyleSheet.absoluteFill, height: 160 },
  bottomGradient: { ...StyleSheet.absoluteFill, top: undefined, bottom: 0, height: 320 },
  hud: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    zIndex: 48,
  },
  indicatorsWrapper: { paddingHorizontal: 16, marginBottom: 12 },

  notificationPromptText: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#fff', marginLeft: 8, flexShrink: 1, lineHeight: 18 },
  promptDescriptionContainer: {
    alignSelf: 'flex-start',
    maxWidth: 290,
    marginTop: 1,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  promptDescriptionGlass: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 5, 7, 0.42)',
  },
  promptDescriptionContent: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  promptDescriptionIcon: {
    width: 18,
    height: 18,
  },

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
  graceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1.2,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    padding: 12,
    borderRadius: 16,
  },
  graceBannerText: {
    flex: 1,
    color: '#facc15',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Satoshi-Medium',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignItems: 'flex-start'
  },
  compactHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  compactHeaderPillLight: {
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  compactHeaderPillDark: {
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  compactSegment: {
    paddingHorizontal: 8,
  },
  uploadPillSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactDivider: {
    width: 1,
    height: 14,
  },
  compactHeaderText: {
    fontSize: 11,
    marginLeft: 6,
    marginRight: 4,
    fontFamily: 'Satoshi-Bold',
    maxWidth: 80,
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  compactHeaderTextDark: {
    color: '#111827',
    textShadowColor: 'rgba(255,255,255,0.7)',
  },
  compactHeaderTextLight: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.75)',
  },
  compactHeaderNumericText: {
    marginLeft: 6,
    marginRight: 0,
    fontFamily: 'Satoshi-Bold',
  },
  instagramUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  userTextMeta: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  compactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  scrubHUDContainer: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubHUDCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubHUDPill: { height: 32, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16 },
  miniProgressTrack: { width: 32, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  miniProgressBar: { height: '100%', backgroundColor: '#fff' },
  middleArea: { flex: 1 },
  bottomArea: { paddingHorizontal: 16, paddingBottom: 16 },
  bottomContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  bottomLeft: { flex: 1, paddingRight: 16, paddingBottom: 4 },
  bottomRight: { alignItems: 'center' },
  timelineWrapper: { width: '100%' },
  tapIndicatorLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH * 0.29,
    zIndex: 45,
  },
  tapIndicatorRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SCREEN_WIDTH * 0.29,
    zIndex: 45,
  },
  floatingFeedNode: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 35,
  },
  commentPillGlassCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarLikeWrapper: {
    width: 36,
    height: 36,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBadgeCompact: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#000',
  },
  bubbleImgContainer: {
    width: 54,
    height: 72,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: '#111',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  bubbleImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  bubbleAvatarWrapper: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  doubleTapHeart: {
    position: 'absolute',
    zIndex: 48,
  },
  doubleTapHeartWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
  },
  mediaTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4.5,
  },
  clipMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  publishTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  publishTimeText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9.5,
    fontFamily: 'Satoshi-Bold',
    includeFontPadding: false,
  },
  mediaTypeLabel: {
    color: '#000000',
    fontSize: 9.5,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  fullscreenMedia: {
    ...StyleSheet.absoluteFill,
  },
});
