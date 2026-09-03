import { useEffect } from 'react';
import { useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';

/**
 * Migration to Reanimated Shared Values:
 * Solves React Native's NativeDriver unmounting bugs where elements start invisible.
 * Returns shared values directly so you can compose them with specific inline transforms (e.g., rotation).
 */
export function useSlideItemAnimation(index: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(
      index * 60, 
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      index * 60, 
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) })
    );
  }, [index, opacity, translateY]);

  return { opacity, translateY };
}

/**
 * One-shot mount animation for static screens like auth forms.
 */
export function useMountAnimation(index: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withDelay(
      index * 60, 
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      index * 60, 
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) })
    );
  }, [index, opacity, translateY]);

  return { opacity, translateY };
}