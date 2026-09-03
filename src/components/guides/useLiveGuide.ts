import { useCallback, useEffect, useRef, useState } from 'react';

import type { GuideStep, GuideMotion } from './guideContent';
import {
  clearGuideReplayRequest,
  completeGuide,
  isGuideComplete,
  isGuideReplayRequested,
  type GuideId,
} from '../../lib/guides';
import { notifySuccess, selectionTick } from '../../lib/haptics';

type Options = {
  guideId: GuideId;
  steps: GuideStep[];
  enabled: boolean;
  delay?: number;
  isStepAvailable?: (step: GuideStep) => boolean;
};

export function useLiveGuide({ guideId, steps, enabled, delay = 850, isStepAvailable }: Options) {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepCompleteRef = useRef(false);

  const finish = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    completeGuide(guideId);
    clearGuideReplayRequest(guideId);
    setVisible(false);
    setStepIndex(0);
    setStepComplete(false);
    stepCompleteRef.current = false;
  }, [guideId]);

  const advance = useCallback(() => {
    setStepComplete(false);
    stepCompleteRef.current = false;
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex((current) => current + 1);
  }, [finish, stepIndex, steps.length]);

  useEffect(() => {
    if (!enabled || visible) return;
    if (steps.length === 0) return;
    const replayRequested = isGuideReplayRequested(guideId);
    if (!replayRequested && isGuideComplete(guideId)) return;
    const timer = setTimeout(() => {
      setStepIndex(0);
      setVisible(true);
    }, replayRequested ? 300 : delay);
    return () => clearTimeout(timer);
  }, [delay, enabled, guideId, visible]);

  // Media and camera state can change while a guide is open (for example when
  // the user advances from a video to a photo). Never leave an impossible
  // action on screen; move to the next applicable lesson immediately.
  useEffect(() => {
    if (!visible || !isStepAvailable) return;
    const currentStep = steps[stepIndex];
    if (!currentStep) {
      finish();
      return;
    }
    if (isStepAvailable(currentStep)) return;
    if (stepIndex >= steps.length - 1) finish();
    else advance();
  }, [advance, finish, isStepAvailable, stepIndex, steps, visible]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const completeAction = useCallback((motion: GuideMotion) => {
    if (!visible || stepCompleteRef.current || steps[stepIndex]?.motion !== motion) return false;
    stepCompleteRef.current = true;
    setStepComplete(true);
    notifySuccess();
    timerRef.current = setTimeout(advance, 480);
    return true;
  }, [advance, stepIndex, steps, visible]);

  const skipStep = useCallback(() => {
    selectionTick();
    if (stepIndex >= steps.length - 1) finish();
    else advance();
  }, [advance, finish, stepIndex, steps.length]);

  const goBack = useCallback(() => {
    if (stepIndex === 0) return;
    selectionTick();
    if (timerRef.current) clearTimeout(timerRef.current);
    stepCompleteRef.current = false;
    setStepComplete(false);
    setStepIndex((current) => Math.max(0, current - 1));
  }, [stepIndex]);

  return {
    visible: visible && Boolean(steps[stepIndex]) && (!isStepAvailable || isStepAvailable(steps[stepIndex])),
    step: steps[stepIndex],
    stepIndex,
    totalSteps: steps.length,
    stepComplete,
    completeAction,
    skipStep,
    skipTour: finish,
    goBack,
  };
}
