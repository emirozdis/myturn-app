import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Zap, ZapOff, RefreshCw, X, Star, Pause, Play, Check } from 'lucide-react-native';
import Animated, { 
  FadeIn, FadeOut, ZoomIn, ZoomOut, FadeInUp, FadeOutUp,
  useAnimatedStyle, useSharedValue, withTiming, withRepeat, withSequence, Easing, withDelay, withSpring
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';

import { ACCENT } from '../../lib/theme';
import { Text } from '../ui/Text';
import { GlassView } from '../ui/GlassView';
import { PromptSheet } from './PromptSheet';
import { heavyTap, mediumTap, lightTap, selectionTick } from '../../lib/haptics';
import { useTodayStore } from '../../store/useTodayStore';
import { RecordingFacing, RecordingSegment, RecordingSpeed } from './types';
import { LiveGuideCoachmark } from '../guides/LiveGuideCoachmark';
import { getGuideDefinition } from '../guides/guideContent';
import { useLiveGuide } from '../guides/useLiveGuide';
import { useTranslation } from '../../lib/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SMOOTH_TIMING_CFG = { duration: 200, easing: Easing.out(Easing.cubic) };
const MAX_RECORDING_SEGMENTS = 64;
const RECORDING_KEEP_AWAKE_TAG = 'myturn-video-recording';

const REAR_ZOOMS = [
  { label: '0.5x', val: 0 },
  { label: '1x', val: 0.05 },
  { label: '2x', val: 0.1 },
  { label: '3x', val: 0.15 }
];

const FRONT_ZOOMS = [
  { label: '1x', val: 0 },
  { label: '1.5x', val: 0.025 },
  { label: '2x', val: 0.05 }
];

const MODES = [
  { key: 'photo', label: 'Fotoğraf' },
  { key: 'snippet', label: 'Snippet' },
  { key: 'vlog', label: 'Vlog' }
] as const;

async function waitForStableFile(uri: string, { requiredStableChecks = 1, intervalMs = 75, maxAttempts = 20 } = {}) {
  let lastSize = -1;
  let stableCount = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      
      if (info.exists && typeof info.size === 'number') {
        if (info.size > 0 && info.size === lastSize) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            return true;
          }
        } else {
          stableCount = 0;
          lastSize = info.size;
        }
      }
    } catch (e) {
      console.warn(`[CameraStep] Error fetching file info:`, e);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

function ToolItem({ icon, label, onPress, disabled, style, active }: any) {
  return (
    <TouchableOpacity 
      style={[styles.toolItem, style, disabled && { opacity: 0.4 }]} 
      onPress={onPress} 
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.toolIconCircle, active && { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.4)' }]}>
         {icon}
      </View>
      {label && <Text style={styles.toolLabel}>{label}</Text>}
    </TouchableOpacity>
  );
}

function RecordingKeepAwake() {
  useKeepAwake(RECORDING_KEEP_AWAKE_TAG, { suppressDeactivateWarnings: true });
  return null;
}

export function CameraStep({ 
  captureMode,
  setCaptureMode,
  onClose,
  onDraftChange,
  onRecordingComplete,
  onTransitionToPreview,
  resetToken,
}: { 
  captureMode: 'photo'|'snippet'|'vlog';
  setCaptureMode: (val: 'photo'|'snippet'|'vlog') => void;
  onClose: () => void;
  onDraftChange: (hasDraft: boolean) => void;
  onRecordingComplete: (segments: RecordingSegment[], prompt: string | null) => void;
  onTransitionToPreview?: () => void;
  resetToken: number;
}) {
  const insets = useSafeAreaInsets();
  const todayStore = useTodayStore();
  const { locale } = useTranslation();
  const cameraRef = useRef<any>(null);

  const [facingMode, setFacingMode] = useState<RecordingFacing>("front");
  const [cameraSessionGeneration, setCameraSessionGeneration] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<RecordingSpeed>(1);

  const [zoomVal, setZoomVal] = useState(0); // Defaults to 0 to prevent the front camera from starting excessively zoomed in
  const [isZoomExpanded, setIsZoomExpanded] = useState(false);

  const [acceptedPrompt, setAcceptedPrompt] = useState<string | null>(null);
  const [showPromptSheet, setShowPromptSheet] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const activePromptFromDB = todayStore.assignment?.activePrompt || "";
  const skipsLeft = Math.max(0, 3 - (todayStore.assignment?.promptSkips || 0));

  type CaptureState = 'idle' | 'recording' | 'stopping' | 'paused' | 'switching' | 'finalizing';
  type StopIntent = 'pause' | 'finish' | 'switch' | 'limit';

  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [recordTimeMs, setRecordTimeMs] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [segments, setSegments] = useState<RecordingSegment[]>([]);
  const captureStateRef = useRef<CaptureState>('idle');
  const segmentsRef = useRef<RecordingSegment[]>([]);
  const activeSegmentRef = useRef<{
    startedAt: number;
    speed: RecordingSpeed;
    facing: RecordingFacing;
  } | null>(null);
  const stopIntentRef = useRef<StopIntent | null>(null);
  const pendingAutoResumeRef = useRef<{
    facing: RecordingFacing;
    speed: RecordingSpeed;
    cameraReady: boolean;
    sourceReady: boolean;
  } | null>(null);
  const [switchReadinessTick, setSwitchReadinessTick] = useState(0);
  const isMountedRef = useRef(true);
  const recordingGenerationRef = useRef(0);

  const isRecording = captureState === 'recording';
  const isBusy = ['stopping', 'switching', 'finalizing'].includes(captureState);
  const canAdjustSettings = captureState === 'idle' || captureState === 'paused';
  const recordGuideSteps = useMemo(() => getGuideDefinition('record', locale).steps, [locale]);
  const recordGuide = useLiveGuide({
    guideId: 'record',
    steps: recordGuideSteps,
    enabled: true,
    delay: 850,
    isStepAvailable: (step) => {
      if (step.motion === 'record') return captureMode === 'vlog';
      if (step.motion === 'tools') return captureMode !== 'photo';
      if (step.motion === 'publish') return segments.length > 0 || captureState !== 'idle';
      return true;
    },
  });

  useEffect(() => {
    onDraftChange(
      isCapturingPhoto
      || captureState !== 'idle'
      || segments.length > 0,
    );
  }, [captureState, isCapturingPhoto, onDraftChange, segments.length]);

  const activeZooms = facingMode === 'back' ? REAR_ZOOMS : FRONT_ZOOMS;
  const activeZoomItem = activeZooms.find(z => z.val === zoomVal) || activeZooms[0];

  useEffect(() => {
    setZoomVal(0);
    setIsZoomExpanded(false);
  }, [facingMode, captureMode]);

  // Reanimated Hooks Setup
  const sliderHighlightX = useSharedValue(MODES.findIndex(m => m.key === captureMode) * 70);
  const modeSelectorY = useSharedValue(100); 
  const modeSelectorOpacity = useSharedValue(0);

  // Smooth Mode Selector Entry Animation
  useEffect(() => {
    modeSelectorY.value = withDelay(400, withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }));
    modeSelectorOpacity.value = withDelay(400, withTiming(1, { duration: 350 }));
  }, []);

  const modeSelectorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modeSelectorY.value }],
    opacity: modeSelectorOpacity.value,
  }));

  useEffect(() => {
    sliderHighlightX.value = withTiming(MODES.findIndex(m => m.key === captureMode) * 70, SMOOTH_TIMING_CFG);
  }, [captureMode]);

  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sliderHighlightX.value }] }));

  useEffect(() => { if (isRecording) setIsZoomExpanded(false); }, [isRecording]);

  const transitionTo = useCallback((next: CaptureState) => {
    captureStateRef.current = next;
    if (isMountedRef.current) setCaptureState(next);
  }, []);

  const replaceSegments = useCallback((next: RecordingSegment[]) => {
    segmentsRef.current = next;
    if (isMountedRef.current) setSegments(next);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      recordingGenerationRef.current += 1;
      if (captureStateRef.current === 'recording') {
        try { cameraRef.current?.stopRecording(); } catch {}
      }
      segmentsRef.current.forEach((segment) => {
        FileSystem.deleteAsync(segment.uri, { idempotent: true }).catch(() => {});
      });
    };
  }, []);

  useEffect(() => {
    recordingGenerationRef.current += 1;
    const oldSegments = segmentsRef.current;
    if (captureStateRef.current === 'recording') {
      stopIntentRef.current = 'pause';
      try { cameraRef.current?.stopRecording(); } catch {}
    }
    pendingAutoResumeRef.current = null;
    activeSegmentRef.current = null;
    replaceSegments([]);
    setAcceptedPrompt(null);
    setShowPromptSheet(false);
    setRecordTimeMs(0);
    transitionTo('idle');
    oldSegments.forEach((segment) => {
      FileSystem.deleteAsync(segment.uri, { idempotent: true }).catch(() => {});
    });
  }, [resetToken, replaceSegments, transitionTo]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        const completedMs = segmentsRef.current.reduce((sum, segment) => sum + segment.durationMs, 0);
        const activeMs = activeSegmentRef.current
          ? Math.max(0, Date.now() - activeSegmentRef.current.startedAt)
          : 0;
        setRecordTimeMs(completedMs + activeMs);
      }, 100);
    } else {
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      setRecordTimeMs(segmentsRef.current.reduce((sum, segment) => sum + segment.durationMs, 0));
    }
    return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    const limitMs = (captureMode === 'snippet' ? 4 : 120) * 1000;
    if (recordTimeMs >= limitMs && captureStateRef.current === 'recording') {
      stopIntentRef.current = 'limit';
      transitionTo('finalizing');
      cameraRef.current?.stopRecording();
    }
  }, [recordTimeMs, captureMode, transitionTo]);

  const completeSession = useCallback((completedSegments: RecordingSegment[]) => {
    if (!completedSegments.length) {
      transitionTo('idle');
      return;
    }
    const sourceDurationMs = completedSegments.reduce((sum, segment) => sum + segment.durationMs, 0);
    const minimumDurationMs = captureMode === 'snippet' ? 2_000 : 5_000;
    if (captureMode !== 'photo' && sourceDurationMs < minimumDurationMs) {
      transitionTo('paused');
      Alert.alert(
        'Kayıt çok kısa',
        captureMode === 'snippet'
          ? 'Snippet en az 2 saniye olmalı.'
          : 'Vlog en az 5 saniye olmalı.',
      );
      return;
    }
    onRecordingComplete(completedSegments, acceptedPrompt);
    onTransitionToPreview?.();
  }, [acceptedPrompt, captureMode, onRecordingComplete, onTransitionToPreview, transitionTo]);

  const startVideoSegment = useCallback(async (
    settings: { speed: RecordingSpeed; facing: RecordingFacing } = {
      speed: currentSpeed,
      facing: facingMode,
    },
  ) => {
    if (!cameraRef.current || isCapturingPhoto || captureStateRef.current === 'recording') return;

    const limitMs = (captureMode === 'snippet' ? 4 : 120) * 1000;
    const completedMs = segmentsRef.current.reduce((sum, segment) => sum + segment.durationMs, 0);
    if (completedMs >= limitMs || segmentsRef.current.length >= MAX_RECORDING_SEGMENTS) {
      completeSession(segmentsRef.current);
      return;
    }

    stopIntentRef.current = null;
    const recordingGeneration = recordingGenerationRef.current;
    activeSegmentRef.current = { ...settings, startedAt: Date.now() };
    transitionTo('recording');
    heavyTap();

    let producedVideoUri: string | null = null;
    try {
      const remainingSeconds = Math.max(1, Math.ceil((limitMs - completedMs) / 1000));
      const video = await cameraRef.current.recordAsync({ maxDuration: remainingSeconds, codec: 'avc1' });
      producedVideoUri = video?.uri || null;
      const segmentStoppedAt = Date.now();
      if (recordingGeneration !== recordingGenerationRef.current) {
        if (video?.uri) FileSystem.deleteAsync(video.uri, { idempotent: true }).catch(() => {});
        return;
      }
      const activeSegment = activeSegmentRef.current;
      activeSegmentRef.current = null;
      const stopIntent = (stopIntentRef.current as StopIntent | null) || 'limit';
      stopIntentRef.current = null;

      if (!video?.uri || !activeSegment) {
        throw new Error('Camera returned no video URI');
      }

      // Reconfigure the camera as soon as the native recorder has stopped.
      // File finalization can safely happen in parallel, which removes most of
      // the dead time that was previously visible during an in-recording flip.
      if (stopIntent === 'switch') {
        const pending = pendingAutoResumeRef.current;
        if (!pending) {
          transitionTo('paused');
          return;
        }
        pending.cameraReady = false;
        pending.sourceReady = false;
        transitionTo('switching');
        setFacingMode(pending.facing);
        setZoomVal(0);
        setIsZoomExpanded(false);
      }

      const stable = await waitForStableFile(video.uri);
      if (!stable) throw new Error('Recorded segment did not finish writing in time');
      if (recordingGeneration !== recordingGenerationRef.current) {
        FileSystem.deleteAsync(video.uri, { idempotent: true }).catch(() => {});
        return;
      }
      const info = await FileSystem.getInfoAsync(video.uri);
      if (!info.exists || typeof info.size !== 'number' || info.size <= 0) {
        throw new Error('Recorded segment was not written to disk');
      }

      const durationMs = Math.max(1, segmentStoppedAt - activeSegment.startedAt);
      const completedSegment: RecordingSegment = {
        id: `${activeSegment.startedAt}-${segmentsRef.current.length}`,
        uri: video.uri,
        byteLength: info.size,
        durationMs,
        speed: activeSegment.speed,
        facing: activeSegment.facing,
      };
      const nextSegments = [...segmentsRef.current, completedSegment];
      replaceSegments(nextSegments);

      if (stopIntent === 'switch') {
        const pending = pendingAutoResumeRef.current;
        if (!pending) {
          transitionTo('paused');
          return;
        }
        pending.sourceReady = true;
        setSwitchReadinessTick((value) => value + 1);
        return;
      }

      if (stopIntent === 'finish' || stopIntent === 'limit') {
        transitionTo('finalizing');
        completeSession(nextSegments);
        return;
      }

      transitionTo('paused');
    } catch (e) {
      console.error("[CameraStep] Native recording process failed:", e);
      if (producedVideoUri) {
        FileSystem.deleteAsync(producedVideoUri, { idempotent: true }).catch(() => {});
      }
      activeSegmentRef.current = null;
      stopIntentRef.current = null;
      pendingAutoResumeRef.current = null;
      transitionTo(segmentsRef.current.length ? 'paused' : 'idle');
      Alert.alert('Kayıt hatası', 'Video segmenti kaydedilemedi. Lütfen tekrar deneyin.');
    }
  }, [captureMode, completeSession, currentSpeed, facingMode, isCapturingPhoto, replaceSegments, transitionTo]);

  const handleStartRecording = async () => {
    if (!cameraRef.current || isBusy || isCapturingPhoto) return;
    
    if (captureMode === 'photo') {
      setIsCapturingPhoto(true);
      const photoGeneration = recordingGenerationRef.current;
      heavyTap();
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (!photo?.uri) {
          throw new Error('Camera returned no photo URI');
        }
        if (photoGeneration !== recordingGenerationRef.current) {
          FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
          return;
        }

        // Photo capture does not go through stopRecording(), so it must
        // explicitly advance the parent from CAMERA to PREVIEW after the
        // captured URI has been handed off.
        const info = await FileSystem.getInfoAsync(photo.uri);
        if (!info.exists || typeof info.size !== 'number') {
          throw new Error('Captured photo was not written to disk');
        }
        const photoSegment: RecordingSegment = {
          id: `${Date.now()}-photo`,
          uri: photo.uri,
          byteLength: info.size,
          durationMs: 0,
          speed: 1,
          facing: facingMode,
        };
        replaceSegments([photoSegment]);
        onRecordingComplete([photoSegment], null);
        onTransitionToPreview?.();
      } catch (err) {
        console.error("[CameraStep] Photo capture failed:", err);
      } finally {
        if (isMountedRef.current) setIsCapturingPhoto(false);
      }
      return;
    }

    if (captureStateRef.current === 'paused') {
      pendingAutoResumeRef.current = {
        facing: facingMode,
        speed: currentSpeed,
        cameraReady: false,
        sourceReady: true,
      };
      transitionTo('switching');
      setCameraSessionGeneration((generation) => generation + 1);
      return;
    }

    await startVideoSegment();
  };

  const stopCurrentSegment = (intent: StopIntent) => {
    if (!cameraRef.current || captureStateRef.current !== 'recording') return;
    stopIntentRef.current = intent;
    transitionTo(intent === 'finish' || intent === 'limit' ? 'finalizing' : 'stopping');
    cameraRef.current.stopRecording();
    mediumTap();
  };

  const handlePauseRecording = () => {
    if (captureMode === 'vlog' && recordTimeMs >= 5_000) {
      recordGuide.completeAction('record');
    }
    stopCurrentSegment('pause');
  };

  const handleFinishRecording = async () => {
    if (captureStateRef.current === 'recording') {
      if (captureMode === 'vlog' && recordTimeMs >= 5_000) {
        recordGuide.completeAction('publish');
      }
      stopCurrentSegment('finish');
      return;
    }

    const state = captureStateRef.current;
    if (!segmentsRef.current.length || ['stopping', 'switching', 'finalizing'].includes(state)) return;

    const recordingGeneration = recordingGenerationRef.current;
    const completedSegments = [...segmentsRef.current];
    const sourceDurationMs = completedSegments.reduce((sum, segment) => sum + segment.durationMs, 0);
    if (captureMode === 'vlog' && sourceDurationMs >= 5_000) {
      recordGuide.completeAction('publish');
    }
    transitionTo('finalizing');
    mediumTap();

    // Let the finalizing overlay render before the parent swaps to preview.
    // This also absorbs a rapid second tap without making finalization re-entrant.
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (
      recordingGeneration === recordingGenerationRef.current
      && captureStateRef.current === 'finalizing'
      && isMountedRef.current
    ) {
      completeSession(completedSegments);
    }
  };

  const handleFlipCamera = () => {
    if (isBusy) return;
    recordGuide.completeAction('tools');
    const nextFacing: RecordingFacing = facingMode === 'front' ? 'back' : 'front';
    lightTap();
    if (captureStateRef.current === 'recording') {
      pendingAutoResumeRef.current = {
        facing: nextFacing,
        speed: currentSpeed,
        cameraReady: false,
        sourceReady: false,
      };
      stopCurrentSegment('switch');
      return;
    }
    setFacingMode(nextFacing);
    setZoomVal(0);
    setIsZoomExpanded(false);
  };

  const handleCameraReady = () => {
    const pending = pendingAutoResumeRef.current;
    if (!pending || captureStateRef.current !== 'switching') return;
    pending.cameraReady = true;
    setSwitchReadinessTick((value) => value + 1);
  };

  useEffect(() => {
    if (captureState !== 'switching') return;
    const pending = pendingAutoResumeRef.current;
    if (!pending?.cameraReady || !pending.sourceReady) return;

    pendingAutoResumeRef.current = null;
    const timer = setTimeout(() => {
      if (captureStateRef.current === 'switching') {
        void startVideoSegment({ facing: pending.facing, speed: pending.speed });
      }
    // Give the freshly mounted native capture session one short frame budget
    // after onCameraReady before starting AVFoundation/CameraX recording.
    }, 150);
    return () => clearTimeout(timer);
  }, [captureState, startVideoSegment, switchReadinessTick]);

  const handleSkipPrompt = async () => {
    if (skipsLeft <= 0) return;
    setIsSkipping(true);
    try {
      await todayStore.skipPrompt();
      mediumTap();
    } catch (e: any) {
      Alert.alert("Hata", e.message || "Konu değiştirilemedi.");
    } finally {
      setIsSkipping(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const renderTimerText = () => {
    const recordTime = Math.floor(recordTimeMs / 1000);
    if (captureMode === 'snippet') {
      const remaining = Math.max(0, 4 - recordTime);
      return captureState === 'paused' ? `DURAKLATILDI • ${remaining}s KALDI` : `${remaining}s KALDI`;
    }
    const prefix = captureState === 'paused' ? 'DURAKLATILDI' : 'KAYIT';
    return `${prefix} • ${formatTime(recordTime)}`;
  };

  const displayedRecordSeconds = Math.floor(recordTimeMs / 1000);
  const isWarning = captureMode === 'vlog' && isRecording && (120 - displayedRecordSeconds <= 10);
  const timerBgStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(
        isWarning ? (displayedRecordSeconds % 2 === 0 ? '#ef4444' : 'rgba(0,0,0,0.65)') : 'rgba(0,0,0,0.65)',
        { duration: 200 }
      )
    };
  }, [isWarning, displayedRecordSeconds]);

  const shutterInnerStyle = useAnimatedStyle(() => {
    const isPhoto = captureMode === 'photo';
    return {
      width: withTiming(isRecording ? 24 : 56, SMOOTH_TIMING_CFG),
      height: withTiming(isRecording ? 24 : 56, SMOOTH_TIMING_CFG),
      borderRadius: withTiming(isRecording ? 6 : 28, SMOOTH_TIMING_CFG),
      backgroundColor: withTiming(isPhoto ? '#fff' : '#ef4444', SMOOTH_TIMING_CFG),
    };
  }, [isRecording, captureMode]);

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.viewportWrapper}>
      {isRecording && <RecordingKeepAwake />}
      <CameraView 
        key={`camera-${facingMode}-${cameraSessionGeneration}`}
        ref={cameraRef} 
        style={StyleSheet.absoluteFill} 
        facing={facingMode} 
        mode={captureMode === 'photo' ? 'picture' : 'video'} 
        zoom={zoomVal} 
        enableTorch={flashActive} 
        videoStabilizationMode="auto" 
        onCameraReady={handleCameraReady}
      />
      <View style={styles.shutterOverlay} pointerEvents="none" />

      {(captureState === 'switching' || (captureState === 'stopping' && pendingAutoResumeRef.current !== null)) && (
        <Animated.View
          entering={FadeIn.duration(60)}
          exiting={FadeOut.duration(140)}
          style={styles.cameraSwitchOverlay}
          pointerEvents="none"
        >
          <RefreshCw size={26} color="rgba(255,255,255,0.85)" />
        </Animated.View>
      )}

      {captureState === 'finalizing' && (
        <Animated.View
          entering={FadeIn.duration(80)}
          exiting={FadeOut.duration(140)}
          style={[styles.cameraSwitchOverlay, styles.finalizingOverlay]}
          pointerEvents="auto"
        >
          <ActivityIndicator size="small" color="#fff" />
          <Text weight="bold" style={styles.finalizingText}>Video hazırlanıyor</Text>
        </Animated.View>
      )}
      
      {/* Top Left Return Button */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.centeredTimerContainer, { top: Math.max(insets.top, 16) }]} pointerEvents="none">
        {(isRecording || captureState === 'paused') && (
          <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(200)}>
            <Animated.View style={[styles.timerPill, timerBgStyle]}>
              {captureMode === 'vlog' && isRecording && <View style={styles.pulseDot} />}
              <Text weight="bold" style={styles.timerText}>{renderTimerText()}</Text>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {captureMode === 'vlog' && acceptedPrompt && canAdjustSettings && !recordGuide.visible && (
        <Animated.View entering={FadeInUp.duration(300)} exiting={FadeOutUp.duration(300)} style={styles.cameraPromptContainer} pointerEvents="auto">
          <GlassView preset="specular" style={styles.notificationPromptPill}>
            <Image source={require('../../../assets/icons/star.png')} style={{ width: 16, height: 16 }} />
            <Text weight="medium" style={styles.notificationPromptText} numberOfLines={3}>{acceptedPrompt}</Text>
            <TouchableOpacity onPress={() => { lightTap(); setAcceptedPrompt(null); }} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}} style={{ marginLeft: 10 }}>
              <X size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </GlassView>
        </Animated.View>
      )}

      {/* Right Vertical Tools */}
      <View style={[styles.rightTools, { top: Math.max(insets.top, 56) }]} pointerEvents={isBusy ? "none" : "auto"}>
        {captureMode !== 'photo' && (
           <ToolItem 
             icon={<Text weight="bold" style={[styles.speedText, currentSpeed === 2 && { color: '#facc15' }]}>{currentSpeed}x</Text>} 
             label="Speed" 
             onPress={() => {
               selectionTick();
               setCurrentSpeed(prev => prev===1 ? 2 : 1);
               recordGuide.completeAction('tools');
             }}
             disabled={!canAdjustSettings}
           />
        )}
        <ToolItem 
          icon={<RefreshCw size={20} color="#fff" />} 
          label="Flip" 
          onPress={handleFlipCamera}
          disabled={isBusy}
        />
      </View>

      {/* Bottom Controls Area */}
      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
        
        {/* Zoom Control explicitly supports both front and back facing modes */}
        {canAdjustSettings && (
          <View style={styles.zoomSection}>
            {isZoomExpanded ? (
              <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(200)} style={styles.zoomRowExpanded}>
                {activeZooms.map((z) => (
                  <TouchableOpacity
                    key={z.label}
                    onPress={() => {
                      selectionTick();
                      setZoomVal(z.val);
                      setIsZoomExpanded(false);
                      recordGuide.completeAction('tools');
                    }}
                    style={[styles.zoomPill, zoomVal === z.val && styles.zoomPillActive]}
                  >
                    <Text weight="bold" style={[styles.zoomPillText, zoomVal === z.val && { color: '#000' }]}>{z.label}</Text>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            ) : (
              <TouchableOpacity onPress={() => setIsZoomExpanded(true)} style={[styles.zoomPill, styles.zoomPillActive, { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Text weight="bold" style={[styles.zoomPillText, { color: ACCENT, fontSize: 13 }]}>{activeZoomItem.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Row: Flash | Shutter | Prompt */}
        <View style={styles.actionRow}>
           <View style={styles.sideAction}>
             <ToolItem 
               icon={flashActive ? <Zap size={22} color="#facc15" fill="#facc15" /> : <ZapOff size={22} color="#fff" />} 
               label="Flash" 
               onPress={() => {
                 setFlashActive(!flashActive);
                 recordGuide.completeAction('tools');
               }}
               active={flashActive}
             />
           </View>

           <View style={styles.centerAction}>
              <TouchableOpacity
                onPress={isRecording ? handlePauseRecording : handleStartRecording}
                disabled={isBusy}
                activeOpacity={0.9}
                style={[styles.liquidGlassShutterOuter, isBusy && { opacity: 0.6 }]}
              >
                <View style={styles.shutterClipView}><GlassView preset="liquid" style={StyleSheet.absoluteFill} /></View>
                <Animated.View style={[styles.shutterInner, shutterInnerStyle]} />
                {isRecording && <Pause size={15} color="#fff" fill="#fff" style={styles.shutterGlyph} />}
                {captureState === 'paused' && <Play size={22} color="#fff" fill="#fff" style={styles.shutterGlyph} />}
              </TouchableOpacity>
           </View>

           <View style={styles.sideAction}>
             {captureMode !== 'photo' && (segments.length > 0 || isRecording) ? (
                <ToolItem
                  icon={<Check size={24} color="#fff" />}
                  label="Done"
                  onPress={handleFinishRecording}
                  disabled={isBusy}
                />
             ) : captureMode === 'vlog' && canAdjustSettings ? (
                <ToolItem 
                  icon={<Star size={24} color={acceptedPrompt ? "#facc15" : "#fff"} fill={acceptedPrompt ? "#facc15" : "transparent"} />} 
                  label="Prompt"
                  onPress={() => {
                    lightTap();
                    recordGuide.completeAction('tools');
                    setShowPromptSheet(true);
                  }}
                />
             ) : null}
           </View>
        </View>

        {/* Smooth Rising Mode Selector */}
        {captureState === 'idle' && (
          <Animated.View style={[styles.modeSelectorWrapper, modeSelectorAnimatedStyle]}>
            <View style={styles.sliderBg}>
              <Animated.View style={[styles.sliderHighlight, highlightStyle]} />
              <View style={styles.sliderLabelsRow}>
                {MODES.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => {
                      selectionTick();
                      setCaptureMode(m.key);
                      if (m.key === 'vlog') recordGuide.completeAction('modes');
                    }}
                    style={styles.sliderBtn}
                    activeOpacity={0.9}
                  >
                    <Text weight={captureMode === m.key ? "bold" : "medium"} style={[styles.sliderText, { color: captureMode === m.key ? '#000' : '#fff' }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

      </View>

      <PromptSheet 
        isOpen={showPromptSheet} 
        onClose={() => setShowPromptSheet(false)} 
        activePrompt={activePromptFromDB}
        skipsLeft={skipsLeft}
        isSkipping={isSkipping}
        onSkip={handleSkipPrompt}
        onAccept={setAcceptedPrompt}
      />
      <LiveGuideCoachmark
        visible={recordGuide.visible && !showPromptSheet}
        step={recordGuide.step}
        stepIndex={recordGuide.stepIndex}
        totalSteps={recordGuide.totalSteps}
        stepComplete={recordGuide.stepComplete}
        onBack={recordGuide.goBack}
        onSkipStep={recordGuide.skipStep}
        onClose={recordGuide.skipTour}
        placement={recordGuide.step?.motion === 'tools' ? 'bottom' : 'top'}
        topOffset={175}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewportWrapper: { flex: 1, backgroundColor: '#000', position: 'relative' },
  shutterOverlay: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cameraSwitchOverlay: { ...StyleSheet.absoluteFill, zIndex: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.92)' },
  finalizingOverlay: { zIndex: 60, gap: 12 },
  finalizingText: { color: '#fff', fontSize: 12, letterSpacing: 0.4 },
  
  topBar: { position: 'absolute', top: 0, left: 16, zIndex: 40 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 22 },
  
  centeredTimerContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 35 },
  timerPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  timerText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 1, color: '#fff' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 },
  
  cameraPromptContainer: { position: 'absolute', top: 100, alignSelf: 'center', maxWidth: SCREEN_WIDTH * 0.85, zIndex: 40 },
  notificationPromptPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  notificationPromptText: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#fff', marginLeft: 8, flexShrink: 1, lineHeight: 18 },

  rightTools: { position: 'absolute', right: 16, alignItems: 'center', gap: 20, zIndex: 35 },
  toolItem: { width: 78, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  toolLabel: { fontSize: 11, color: '#fff', fontFamily: 'Satoshi-Medium', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, textAlign: 'center', minHeight: 14 },
  speedText: { fontSize: 13, color: '#fff' },

  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', zIndex: 35 },

  zoomSection: { marginBottom: 24, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomRowExpanded: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 22, padding: 4, gap: 4 },
  zoomPill: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  zoomPillActive: { backgroundColor: ACCENT },
  zoomPillText: { color: '#fff', fontSize: 12 },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 32 },
  sideAction: { width: 82, minHeight: 88, alignItems: 'center', justifyContent: 'center' },
  centerAction: { width: 120, minHeight: 88, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  
  liquidGlassShutterOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  shutterClipView: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 42, overflow: 'hidden' },
  shutterInner: { alignSelf: 'center', zIndex: 10 },
  shutterGlyph: { position: 'absolute', zIndex: 11 },

  modeSelectorWrapper: { alignItems: 'center', justifyContent: 'center' },
  sliderBg: { flexDirection: 'row', borderRadius: 24, padding: 4, backgroundColor: 'rgba(0,0,0,0.6)' },
  sliderHighlight: { position: 'absolute', top: 4, bottom: 4, left: 4, width: 70, backgroundColor: '#fff', borderRadius: 20, zIndex: 0 },
  sliderLabelsRow: { flexDirection: 'row', zIndex: 10 },
  sliderBtn: { width: 70, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  sliderText: { fontSize: 12 },
});
