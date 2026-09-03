import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, Hand, X } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../lib/i18n';
import { useBlockingOverlay } from '../../lib/blockingOverlay';
import { Text } from '../ui/Text';
import type { GuideMotion, GuideStep } from './guideContent';

type Props = {
  visible: boolean;
  step?: GuideStep;
  stepIndex: number;
  totalSteps: number;
  stepComplete: boolean;
  onBack: () => void;
  onSkipStep: () => void;
  onClose: () => void;
  placement?: 'top' | 'bottom';
  topOffset?: number;
};

const HORIZONTAL_MOTIONS: GuideMotion[] = ['edges', 'responseBrowse', 'days'];
const DOWN_MOTIONS: GuideMotion[] = ['responseDismiss', 'dismiss'];
const HOLD_MOTIONS: GuideMotion[] = ['hold', 'photoResponse'];

function AnimatedGestureHand({ motion, complete }: { motion: GuideMotion; complete: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (complete) return;

    if (HORIZONTAL_MOTIONS.includes(motion)) {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 650, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 650, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
      );
    } else if (DOWN_MOTIONS.includes(motion)) {
      progress.value = withRepeat(
        withSequence(
          withDelay(180, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) })),
          withTiming(0, { duration: 260 }),
        ),
        -1,
      );
    } else if (motion === 'doubleTap') {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 110 }),
          withTiming(0, { duration: 110 }),
          withTiming(1, { duration: 110 }),
          withTiming(0, { duration: 520 }),
        ),
        -1,
      );
    } else if (HOLD_MOTIONS.includes(motion)) {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
          withDelay(620, withTiming(0, { duration: 240 })),
        ),
        -1,
      );
    } else {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
          withDelay(340, withTiming(0, { duration: 220 })),
        ),
        -1,
      );
    }

    return () => cancelAnimation(progress);
  }, [complete, motion, progress]);

  const handStyle = useAnimatedStyle(() => {
    const horizontal = HORIZONTAL_MOTIONS.includes(motion);
    const downward = DOWN_MOTIONS.includes(motion);
    const pressing = HOLD_MOTIONS.includes(motion) || motion === 'doubleTap' || (!horizontal && !downward);
    return {
      transform: [
        { translateX: horizontal ? interpolate(progress.value, [0, 1], [-22, 22]) : 0 },
        { translateY: downward ? interpolate(progress.value, [0, 1], [-7, 23]) : 0 },
        { scale: pressing ? interpolate(progress.value, [0, 1], [1, 0.78]) : 1 },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: complete ? 0 : interpolate(progress.value, [0, 0.45, 1], [0.15, 0.7, 0.05]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1.35]) }],
  }));

  if (complete) {
    return (
      <Animated.View entering={FadeIn.duration(120)} style={styles.completeIcon}>
        <Check size={26} color="#fff" strokeWidth={3} />
      </Animated.View>
    );
  }

  return (
    <View style={styles.handStage} pointerEvents="none">
      {!HORIZONTAL_MOTIONS.includes(motion) && !DOWN_MOTIONS.includes(motion) && (
        <Animated.View style={[styles.pressRing, ringStyle]} />
      )}
      <Animated.View style={[styles.hand, handStyle]}>
        <Hand size={31} color="#fff" strokeWidth={2.3} />
      </Animated.View>
    </View>
  );
}

export function LiveGuideCoachmark({
  visible,
  step,
  stepIndex,
  totalSteps,
  stepComplete,
  onSkipStep,
  onClose,
  topOffset = 56,
}: Props) {
  useBlockingOverlay(visible);
  const insets = useSafeAreaInsets();
  const { locale } = useTranslation();
  if (!visible || !step) return null;

  const isTr = locale === 'tr';
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Animated.View
        key={`${step.motion}-${stepIndex}`}
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={[styles.hint, { top: insets.top + topOffset }]}
        pointerEvents="box-none"
      >
        <View style={styles.topRow} pointerEvents="box-none">
          <Text weight="bold" style={styles.stepCount}>{stepIndex + 1}/{totalSteps}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button">
            <X size={17} color="#fff" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <AnimatedGestureHand motion={step.motion} complete={stepComplete} />

        {stepComplete ? (
          <Text weight="bold" style={styles.prompt} pointerEvents="none">
            {isTr ? 'Tamamlandı' : 'Completed'}
          </Text>
        ) : (
          <View style={styles.copy} pointerEvents="none">
            <Text weight="bold" style={styles.prompt}>{step.title}</Text>
            <Text style={styles.explanation}>{step.body}</Text>
          </View>
        )}

        {!stepComplete && (
          <TouchableOpacity onPress={onSkipStep} style={styles.skipButton} accessibilityRole="button">
            <Text weight="bold" style={styles.skipText}>{isTr ? 'Geç' : 'Skip'}</Text>
          </TouchableOpacity>
        )}

      </Animated.View>
    </View>
  );
}

const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.95)',
  textShadowOffset: { width: 0, height: 1 } as const,
  textShadowRadius: 5,
};

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 950, elevation: 950 },
  hint: { position: 'absolute', left: 12, right: 12, minHeight: 124, alignItems: 'center', justifyContent: 'flex-start' },
  topRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 30, alignItems: 'center', justifyContent: 'center' },
  stepCount: { color: '#fff', fontSize: 10, letterSpacing: 0.6, ...textShadow },
  closeButton: { position: 'absolute', right: 4, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  handStage: { width: 84, height: 46, marginTop: 28, alignItems: 'center', justifyContent: 'center' },
  hand: { zIndex: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.85, shadowRadius: 4 },
  pressRing: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff' },
  completeIcon: { width: 84, height: 46, marginTop: 28, alignItems: 'center', justifyContent: 'center' },
  copy: { maxWidth: 290, alignItems: 'center' },
  prompt: { maxWidth: 280, color: '#fff', fontSize: 12, lineHeight: 15, textAlign: 'center', ...textShadow },
  explanation: { maxWidth: 290, color: 'rgba(255,255,255,0.78)', fontSize: 10.5, lineHeight: 14, textAlign: 'center', marginTop: 3, ...textShadow },
  skipButton: { minWidth: 44, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  skipText: { color: 'rgba(255,255,255,0.68)', fontSize: 9, ...textShadow },
});
