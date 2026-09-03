import { useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

type HoldToSeekOptions = {
  enabled?: boolean;
  onHoldStart: () => void;
  onSeek: (translationX: number, elapsedMs: number) => void;
  onHoldEnd: () => void;
};

/**
 * Shared video interaction: hold to pause, then drag horizontally to seek.
 * A positive translation seeks forward; a negative translation seeks backward.
 */
export function useHoldToSeekGesture({
  enabled = true,
  onHoldStart,
  onSeek,
  onHoldEnd,
}: HoldToSeekOptions) {
  const holdingRef = useRef(false);
  const translationXRef = useRef(0);
  const startedAtRef = useRef(0);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSeeking = () => {
    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    repeatTimerRef.current = null;
  };

  const longPress = Gesture.LongPress()
    .enabled(enabled)
    .minDuration(250)
    // Allow the accompanying pan to move after the hold has activated.
    .maxDistance(10000)
    .runOnJS(true)
    .onStart(() => {
      if (!enabled) return;
      holdingRef.current = true;
      translationXRef.current = 0;
      startedAtRef.current = Date.now();
      onHoldStart();
      repeatTimerRef.current = setInterval(() => {
        if (holdingRef.current) {
          onSeek(translationXRef.current, Date.now() - startedAtRef.current);
        }
      }, 50);
    })
    .onFinalize(() => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      stopSeeking();
      onHoldEnd();
    });

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .runOnJS(true)
    .onUpdate((event) => {
      if (enabled && holdingRef.current) {
        translationXRef.current = event.translationX;
        onSeek(event.translationX, Date.now() - startedAtRef.current);
      }
    });

  return Gesture.Simultaneous(longPress, pan);
}
