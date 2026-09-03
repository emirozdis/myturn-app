import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Hand,
  Heart,
  Images,
  MoveDown,
  MoveHorizontal,
  Send,
  Sparkles,
  Users,
  UserCheck,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ACCENT } from '../../lib/theme';
import { completeGuide, type GuideId } from '../../lib/guides';
import { useTranslation } from '../../lib/i18n';
import { useBlockingOverlay } from '../../lib/blockingOverlay';
import { lightTap, notifySuccess, selectionTick } from '../../lib/haptics';
import { Text } from '../ui/Text';
import { getGuideDefinition, type GuideMotion } from './guideContent';

type GuideTourProps = {
  guideId: GuideId;
  visible: boolean;
  onClose: () => void;
  replay?: boolean;
};

function MotionPreview({ motion }: { motion: GuideMotion }) {
  const { locale } = useTranslation();
  const progress = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!reduceMotion) {
      progress.value = withRepeat(
        withSequence(
          withDelay(220, withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) })),
          withDelay(280, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })),
        ),
        -1,
      );
    }
    return () => cancelAnimation(progress);
  }, [motion, progress, reduceMotion]);

  const horizontalStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 0.5) * 88 }],
  }));
  const verticalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * 42 }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + progress.value * 0.55,
    transform: [{ scale: 0.82 + progress.value * 0.18 }],
  }));

  if (motion === 'edges') {
    return (
      <View style={styles.phonePreview}>
        <View style={styles.edgeZone} />
        <View style={[styles.edgeZone, styles.edgeZoneRight]} />
        <Animated.View style={[styles.motionPointer, horizontalStyle]}><Hand size={27} color="#fff" /></Animated.View>
      </View>
    );
  }

  if (motion === 'passTurn') {
    return (
      <View style={styles.turnFlowPreview}>
        <View style={styles.turnFlowNode}>
          <Camera size={28} color="#fff" />
          <Text weight="bold" style={styles.turnFlowNodeText}>{locale === 'tr' ? 'SIRA SENDE' : 'YOUR TURN'}</Text>
        </View>
        <ArrowRight size={28} color="rgba(255,255,255,0.46)" />
        <View style={styles.turnFlowNode}>
          <Users size={30} color="#fff" />
          <Text weight="bold" style={styles.turnFlowNodeText}>{locale === 'tr' ? 'GRUBA AÇIK' : 'OPEN TO GROUP'}</Text>
        </View>
      </View>
    );
  }

  if (motion === 'mandatoryTurn') {
    return (
      <View style={styles.mandatoryPreview}>
        <View style={styles.dayLabel}><Text weight="bold" style={styles.dayLabelText}>{locale === 'tr' ? 'BUGÜN' : 'TODAY'}</Text></View>
        <View style={styles.passPill}><Text weight="bold" style={styles.passPillText}>{locale === 'tr' ? 'PAS GEÇ' : 'PASS'}</Text></View>
        <ArrowRight size={24} color="rgba(255,255,255,0.42)" />
        <View style={[styles.dayLabel, styles.dayLabelActive]}><Text weight="bold" style={[styles.dayLabelText, styles.dayLabelTextActive]}>{locale === 'tr' ? 'YARIN' : 'TOMORROW'}</Text></View>
        <View style={styles.mandatoryCamera}><Camera size={25} color="#fff" /><Text weight="bold" style={styles.mandatoryText}>{locale === 'tr' ? 'ZORUNLU SIRA' : 'MANDATORY TURN'}</Text></View>
      </View>
    );
  }

  if (motion === 'claimTurn') {
    return (
      <View style={styles.claimPreview}>
        <View style={styles.claimCamera}><Camera size={42} color="#fff" /></View>
        <View style={styles.claimMembers}>
          {[0, 1, 2].map((member) => (
            <Animated.View key={member} style={[styles.claimMember, member === 1 && styles.claimMemberActive, member === 1 && pulseStyle]}>
              {member === 1 ? <UserCheck size={24} color="#000" /> : <Users size={21} color="rgba(255,255,255,0.62)" />}
            </Animated.View>
          ))}
        </View>
        <Text weight="bold" style={styles.claimText}>{locale === 'tr' ? 'İLK ALAN GÜNÜN VLOGGER’I OLUR' : 'FIRST CLAIM BECOMES TODAY’S VLOGGER'}</Text>
      </View>
    );
  }

  if (motion === 'doubleTap') {
    return (
      <View style={styles.previewCenter}>
        <Animated.View style={pulseStyle}><Heart size={58} color="#fff" fill="rgba(255,255,255,0.14)" /></Animated.View>
        <View style={styles.tapMarks}><Circle size={11} color={ACCENT} fill={ACCENT} /><Circle size={11} color={ACCENT} fill={ACCENT} /></View>
      </View>
    );
  }

  if (motion === 'hold') {
    return (
      <View style={styles.previewCenter}>
        <MoveHorizontal size={72} color="rgba(255,255,255,0.32)" />
        <Animated.View style={[styles.motionPointer, horizontalStyle]}><Hand size={28} color="#fff" /></Animated.View>
      </View>
    );
  }

  if (motion === 'photoResponse') {
    const actions = locale === 'tr'
      ? [
          { label: 'DOKUN', detail: 'YANITLARI GÖR', hold: false },
          { label: 'BASILI TUT', detail: 'YANIT EKLE', hold: true },
        ]
      : [
          { label: 'TAP', detail: 'VIEW RESPONSES', hold: false },
          { label: 'PRESS AND HOLD', detail: 'ADD A RESPONSE', hold: true },
        ];
    return (
      <View style={styles.responseGesturePreview}>
        {actions.map((action) => (
          <View key={action.label} style={styles.responseGestureAction}>
            <Text weight="bold" style={styles.responseGestureLabel}>{action.label}</Text>
            <View style={styles.responseCameraButton}>
              {action.hold && <Animated.View style={[styles.responseHoldRing, pulseStyle]} />}
              <Camera size={29} color="#fff" fill="rgba(255,255,255,0.16)" />
              {action.hold && <Animated.View style={[styles.responseHand, pulseStyle]}><Hand size={24} color="#fff" /></Animated.View>}
            </View>
            <Text weight="bold" style={styles.responseGestureDetail}>{action.detail}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (motion === 'responseBrowse') {
    return (
      <View style={styles.responseBrowsePreview}>
        <MoveHorizontal size={54} color="rgba(255,255,255,0.34)" />
        <Animated.View style={[styles.responseBrowseCard, horizontalStyle]}>
          <Images size={34} color="#fff" />
        </Animated.View>
      </View>
    );
  }

  if (motion === 'responseDismiss') {
    return (
      <View style={styles.responseBrowsePreview}>
        <Animated.View style={[styles.responseBrowseCard, verticalStyle]}>
          <Images size={34} color="#fff" />
        </Animated.View>
        <View style={styles.responseDownHint}>
          <MoveDown size={22} color="#fff" />
          <Text weight="bold" style={styles.responseDownText}>{locale === 'tr' ? 'KAPATMAK İÇİN AŞAĞI ÇEK' : 'PULL DOWN TO CLOSE'}</Text>
        </View>
      </View>
    );
  }

  if (motion === 'timeline') {
    return (
      <View style={styles.timelinePreview}>
        <View style={styles.timelineLine} />
        {[0, 1, 2, 3, 4].map((item) => <View key={item} style={[styles.timelineDot, item === 2 && styles.timelineDotActive]} />)}
        <Clock3 size={26} color="#fff" />
      </View>
    );
  }

  if (motion === 'modes') {
    const modeLabels = locale === 'tr' ? ['FOTOĞRAF', 'SNIPPET', 'VLOG'] : ['PHOTO', 'SNIPPET', 'VLOG'];
    return (
      <View style={styles.modePreview}>
        {modeLabels.map((label, index) => (
          <View key={label} style={[styles.modePill, index === 1 && styles.modePillActive]}>
            <Text weight="bold" style={[styles.modeText, index === 1 && styles.modeTextActive]}>{label}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (motion === 'record') {
    return (
      <View style={styles.previewCenter}>
        <View style={styles.shutterOuter}><Animated.View style={[styles.shutterInner, pulseStyle]} /></View>
        <View style={styles.doneHint}><Check size={15} color="#000" /><Text weight="bold" style={styles.doneHintText}>{locale === 'tr' ? 'BİTİR' : 'DONE'}</Text></View>
      </View>
    );
  }

  if (motion === 'tools') {
    return (
      <View style={styles.toolsPreview}>
        <View style={styles.toolCircle}><Text weight="bold" style={styles.toolText}>2x</Text></View>
        <View style={styles.toolCircle}><Camera size={23} color="#fff" /></View>
        <View style={styles.toolCircle}><Sparkles size={23} color="#fff" /></View>
      </View>
    );
  }

  if (motion === 'publish') {
    return (
      <View style={styles.previewCenter}>
        <View style={styles.publishCard}><Images size={35} color="#fff" /><View style={styles.publishLines}><View style={styles.publishLine} /><View style={[styles.publishLine, { width: '64%' }]} /></View></View>
        <View style={styles.sendCircle}><Send size={22} color="#000" /></View>
      </View>
    );
  }

  if (motion === 'days') {
    return (
      <Animated.View style={[styles.daysPreview, horizontalStyle]}>
        {[0, 1, 2].map((item) => <View key={item} style={[styles.dayCard, item === 1 && styles.dayCardActive]} />)}
      </Animated.View>
    );
  }

  if (motion === 'albums') {
    return (
      <View style={styles.albumPreview}>
        {[0, 1, 2, 3].map((item) => <View key={item} style={[styles.albumCard, { transform: [{ rotate: `${item % 2 ? 3 : -3}deg` }] }]}><BookOpen size={18} color="rgba(255,255,255,0.72)" /></View>)}
      </View>
    );
  }

  if (motion === 'dismiss') {
    return (
      <View style={styles.previewCenter}>
        <Animated.View style={[styles.dismissCard, verticalStyle]}><MoveDown size={28} color="#fff" /></Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.previewCenter}>
      <Users size={56} color="#fff" />
      <View style={styles.groupAvatars}><View style={styles.avatarDot} /><View style={styles.avatarDot} /><View style={styles.avatarDot} /></View>
    </View>
  );
}

function PracticeSurface({ motion, onComplete, children }: {
  motion: GuideMotion;
  onComplete: () => void;
  children: React.ReactNode;
}) {
  const tapCountRef = useRef(0);

  useEffect(() => {
    tapCountRef.current = 0;
  }, [motion]);

  const handleTap = () => {
    selectionTick();
    if (motion === 'record') {
      tapCountRef.current += 1;
      if (tapCountRef.current < 2) return;
    }
    onComplete();
  };

  const gesture = useMemo(() => {
    if (motion === 'doubleTap') {
      return Gesture.Tap().numberOfTaps(2).maxDuration(320).runOnJS(true).onEnd((_, success) => {
        if (success) handleTap();
      });
    }

    if (motion === 'hold' || motion === 'photoResponse') {
      return Gesture.LongPress()
        .minDuration(motion === 'photoResponse' ? 500 : 420)
        .runOnJS(true)
        .onStart(onComplete);
    }

    if (motion === 'days' || motion === 'responseBrowse') {
      return Gesture.Pan().runOnJS(true).onEnd((event) => {
        if (Math.abs(event.translationX) >= 44 && Math.abs(event.translationX) > Math.abs(event.translationY)) {
          onComplete();
        }
      });
    }

    if (motion === 'dismiss' || motion === 'responseDismiss') {
      return Gesture.Pan().runOnJS(true).onEnd((event) => {
        if (event.translationY >= 52 && event.translationY > Math.abs(event.translationX)) {
          onComplete();
        }
      });
    }

    if (motion === 'edges') {
      return Gesture.Tap().runOnJS(true).onEnd((event, success) => {
        if (!success) return;
        const practiceWidth = Math.max(240, Dimensions.get('window').width - 44);
        if (event.x <= practiceWidth * 0.3 || event.x >= practiceWidth * 0.7) handleTap();
      });
    }

    return Gesture.Tap().runOnJS(true).onEnd((_, success) => {
      if (success) handleTap();
    });
  }, [motion, onComplete]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.practiceSurface} collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

export function GuideTour({ guideId, visible, onClose, replay = false }: GuideTourProps) {
  const insets = useSafeAreaInsets();
  const { locale } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const practiceCompleteRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const definition = getGuideDefinition(guideId, locale);
  const step = definition.steps[stepIndex];
  useBlockingOverlay(visible);

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [guideId, visible]);

  useEffect(() => {
    practiceCompleteRef.current = false;
    setPracticeComplete(false);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [stepIndex, visible]);

  if (!visible) return null;

  const isLast = stepIndex === definition.steps.length - 1;
  const isInteractiveStep = Boolean(step.practicePrompt);
  const copy = locale === 'tr'
    ? { skip: replay ? 'Kapat' : 'Atla', back: 'Geri', next: 'Devam', done: 'Anladım' }
    : { skip: replay ? 'Close' : 'Skip', back: 'Back', next: 'Next', done: 'Done' };

  const finish = () => {
    completeGuide(guideId);
    lightTap();
    onClose();
  };

  const advance = () => {
    if (isLast) finish();
    else {
      selectionTick();
      setStepIndex((value) => value + 1);
    }
  };

  const handlePracticeComplete = () => {
    if (practiceCompleteRef.current) return;
    practiceCompleteRef.current = true;
    setPracticeComplete(true);
    notifySuccess();
    advanceTimerRef.current = setTimeout(advance, 520);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={[styles.overlay, { paddingTop: Math.max(insets.top + 14, 46), paddingBottom: Math.max(insets.bottom + 14, 24) }]}
      accessibilityViewIsModal
    >
      <View style={styles.topRow}>
        <View
          style={styles.progressRow}
          accessibilityLabel={locale === 'tr' ? `${definition.steps.length} adımın ${stepIndex + 1}. adımı` : `Step ${stepIndex + 1} of ${definition.steps.length}`}
        >
          {definition.steps.map((_, index) => <View key={index} style={[styles.progressSegment, index <= stepIndex && styles.progressSegmentActive]} />)}
        </View>
        <TouchableOpacity onPress={finish} style={styles.skipButton} accessibilityRole="button">
          <Text weight="bold" style={styles.skipText}>{copy.skip}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Animated.View key={`${guideId}-${stepIndex}`} entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(180)} style={styles.stepContent}>
          <View style={[styles.previewFrame, isInteractiveStep && styles.previewFrameInteractive]}>
            {isInteractiveStep ? (
              <PracticeSurface motion={step.motion} onComplete={handlePracticeComplete}>
                <MotionPreview motion={step.motion} />
              </PracticeSurface>
            ) : (
              <MotionPreview motion={step.motion} />
            )}
          </View>
          <Text weight="bold" style={styles.eyebrow}>{step.eyebrow}</Text>
          <Text weight="bold" style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepBody}>{step.body}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => { selectionTick(); setStepIndex((value) => Math.max(0, value - 1)); }}
          disabled={stepIndex === 0}
          style={[styles.backButton, stepIndex === 0 && styles.buttonDisabled]}
          accessibilityRole="button"
        >
          <ChevronLeft size={18} color="#fff" />
          <Text weight="bold" style={styles.backText}>{copy.back}</Text>
        </TouchableOpacity>
        {isInteractiveStep ? (
          <View style={styles.practiceFooterAction}>
            <View style={[styles.practicePromptRow, practiceComplete && styles.practicePromptRowComplete]}>
              {practiceComplete ? <Check size={15} color="#000" /> : <Hand size={15} color="#fff" />}
              <Text weight="bold" style={[styles.practicePromptText, practiceComplete && styles.practicePromptTextComplete]} numberOfLines={2}>
                {practiceComplete ? (locale === 'tr' ? 'Tamamlandı' : 'Completed') : step.practicePrompt}
              </Text>
            </View>
            {!practiceComplete && (
              <TouchableOpacity onPress={advance} activeOpacity={0.7} accessibilityRole="button">
                <Text weight="bold" style={styles.skipStepText}>{locale === 'tr' ? 'Bu adımı geç' : 'Skip this step'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={advance}
            style={styles.nextButton}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityState={{ disabled: false }}
          >
            <Text weight="bold" style={styles.nextText}>{isLast ? copy.done : copy.next}</Text>
            {isLast ? <Check size={18} color="#000" /> : <ChevronRight size={18} color="#000" />}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, elevation: 1000, backgroundColor: 'rgba(7,7,8,0.96)', paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  progressRow: { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.13)' },
  progressSegmentActive: { backgroundColor: '#fff' },
  skipButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  skipText: { color: 'rgba(255,255,255,0.62)', fontSize: 12 },
  content: { flex: 1, justifyContent: 'center' },
  stepContent: { alignItems: 'center' },
  previewFrame: { width: '100%', height: 196, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 20 },
  previewFrameInteractive: { borderColor: 'rgba(255,255,255,0.2)' },
  practiceSurface: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: ACCENT, fontSize: 9, letterSpacing: 1.5, marginBottom: 7 },
  stepTitle: { color: '#fff', fontSize: 23, lineHeight: 27, textAlign: 'center', letterSpacing: -0.4 },
  stepBody: { color: 'rgba(255,255,255,0.58)', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { height: 48, minWidth: 94, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#151517', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  buttonDisabled: { opacity: 0.25 },
  backText: { color: '#fff', fontSize: 13 },
  nextButton: { flex: 1, height: 48, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fff', opacity: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  nextText: { color: '#000', fontSize: 14, opacity: 1 },
  practiceFooterAction: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 5 },
  practicePromptRow: { width: '100%', minHeight: 34, borderRadius: 13, backgroundColor: '#171719', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  practicePromptRowComplete: { backgroundColor: '#fff', borderColor: '#fff' },
  practicePromptText: { flexShrink: 1, color: '#fff', fontSize: 9.5, lineHeight: 12, textAlign: 'center' },
  practicePromptTextComplete: { color: '#000' },
  skipStepText: { color: 'rgba(255,255,255,0.42)', fontSize: 9 },
  phonePreview: { width: 150, height: 180, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.26)', backgroundColor: '#080809', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  turnFlowPreview: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  turnFlowNode: { width: 112, height: 104, borderRadius: 22, backgroundColor: '#080809', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  turnFlowNodeText: { color: 'rgba(255,255,255,0.68)', fontSize: 8, letterSpacing: 0.8, textAlign: 'center' },
  mandatoryPreview: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 },
  dayLabel: { borderRadius: 12, backgroundColor: '#222225', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6 },
  dayLabelActive: { backgroundColor: '#fff', borderColor: '#fff' },
  dayLabelText: { color: 'rgba(255,255,255,0.65)', fontSize: 9, letterSpacing: 1 },
  dayLabelTextActive: { color: '#000' },
  passPill: { borderRadius: 17, backgroundColor: '#111113', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 18, paddingVertical: 9 },
  passPillText: { color: '#fff', fontSize: 10, letterSpacing: 0.7 },
  mandatoryCamera: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mandatoryText: { color: '#fff', fontSize: 9, letterSpacing: 0.8 },
  claimPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  claimCamera: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#080809', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  claimMembers: { flexDirection: 'row', gap: 10 },
  claimMember: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#242427', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  claimMemberActive: { backgroundColor: '#fff', borderColor: '#fff' },
  claimText: { color: ACCENT, fontSize: 8, letterSpacing: 0.75, marginTop: 15, textAlign: 'center' },
  edgeZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 34, backgroundColor: 'rgba(255,255,255,0.1)' },
  edgeZoneRight: { left: undefined, right: 0 },
  motionPointer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  previewCenter: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  tapMarks: { position: 'absolute', bottom: 56, flexDirection: 'row', gap: 8 },
  responseGesturePreview: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  responseGestureAction: { width: 126, alignItems: 'center' },
  responseGestureLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 9, letterSpacing: 1.1, marginBottom: 14, textAlign: 'center' },
  responseCameraButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#080809', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  responseHoldRing: { position: 'absolute', width: 82, height: 82, borderRadius: 41, borderWidth: 3, borderColor: '#fff' },
  responseHand: { position: 'absolute', right: -15, bottom: -17 },
  responseGestureDetail: { color: ACCENT, fontSize: 8, letterSpacing: 0.7, marginTop: 17, textAlign: 'center' },
  responseBrowsePreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  responseBrowseCard: { width: 116, height: 146, borderRadius: 22, backgroundColor: '#242427', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  responseDownHint: { position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 7 },
  responseDownText: { color: 'rgba(255,255,255,0.62)', fontSize: 8, letterSpacing: 0.8 },
  timelinePreview: { width: '78%', height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineLine: { position: 'absolute', left: 8, right: 8, height: 2, backgroundColor: 'rgba(255,255,255,0.24)' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#454548', borderWidth: 1, borderColor: '#777' },
  timelineDotActive: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', borderColor: '#fff' },
  modePreview: { flexDirection: 'row', padding: 5, backgroundColor: '#050506', borderRadius: 24 },
  modePill: { paddingHorizontal: 13, paddingVertical: 12, borderRadius: 19 },
  modePillActive: { backgroundColor: '#fff' },
  modeText: { fontSize: 9, color: 'rgba(255,255,255,0.55)' },
  modeTextActive: { color: '#000' },
  shutterOuter: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  doneHint: { position: 'absolute', right: 45, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff' },
  doneHintText: { color: '#000', fontSize: 9 },
  toolsPreview: { flexDirection: 'row', gap: 18 },
  toolCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#080809', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  toolText: { color: '#fff', fontSize: 15 },
  publishCard: { width: 220, height: 112, borderRadius: 20, backgroundColor: '#080809', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16 },
  publishLines: { flex: 1, gap: 10 },
  publishLine: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)', width: '90%' },
  sendCircle: { position: 'absolute', right: 54, bottom: 38, width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  daysPreview: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 12 },
  dayCard: { width: 105, height: 140, borderRadius: 20, backgroundColor: '#202023', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', opacity: 0.45 },
  dayCardActive: { backgroundColor: '#333337', opacity: 1, borderColor: 'rgba(255,255,255,0.28)' },
  albumPreview: { flexDirection: 'row', gap: 8 },
  albumCard: { width: 55, height: 78, borderRadius: 13, backgroundColor: '#242427', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  dismissCard: { width: 180, height: 130, borderRadius: 24, backgroundColor: '#242427', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  groupAvatars: { position: 'absolute', bottom: 48, flexDirection: 'row' },
  avatarDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#38383c', borderWidth: 2, borderColor: '#111113', marginLeft: -5 },
});
