// ./src/components/ui/BottomSheet.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Keyboard,
  KeyboardAvoidingView,
  Modal, 
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  runOnJS,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { useBlockingOverlay } from '../../lib/blockingOverlay';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  heightPercent?: number; // E.g., 0.75 for 75% height
  children: React.ReactNode;
}

type BottomSheetModalProps = {
  activeHeight: number;
  children: React.ReactNode;
  onClose: () => void;
  panGesture: React.ComponentProps<typeof GestureDetector>['gesture'];
  translateY: ReturnType<typeof useSharedValue<number>>;
};

function BottomSheetModal({
  activeHeight,
  children,
  onClose,
  panGesture,
  translateY,
}: BottomSheetModalProps) {
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, activeHeight],
      [0.6, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior="padding"
        enabled={Platform.OS === 'ios'}
      >
        <GestureHandlerRootView style={styles.root}>
          <TouchableWithoutFeedback onPress={onClose}>
            <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.sheet,
              { height: activeHeight },
              sheetAnimatedStyle,
            ]}
          >
            {/*
              Keep the pan recognizer off interactive sheet content. On Android,
              activating a parent gesture cancels the native child's touch
              stream, which can prevent TextInput from requesting the keyboard.
            */}
            <GestureDetector gesture={panGesture}>
              <View style={styles.grabberContainer}>
                <View style={styles.grabber} />
              </View>
            </GestureDetector>

            <View style={styles.innerContent}>{children}</View>
          </Animated.View>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function BottomSheet({
  isOpen,
  onClose,
  heightPercent = 0.75,
  children
}: BottomSheetProps) {
  const [showModal, setShowModal] = useState(isOpen);
  const activeHeight = SCREEN_HEIGHT * heightPercent;
  const translateY = useSharedValue(SCREEN_HEIGHT);
  useBlockingOverlay(showModal);

  useEffect(() => {
    let dismissalFallback: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setShowModal(true);
      translateY.value = withSpring(0, {
        damping: 24,
        stiffness: 180,
        mass: 0.8,
      });
    } else {
      translateY.value = withTiming(activeHeight, { duration: 240 });
      // Finalize native Modal visibility on the React Native thread. Calling a
      // React state setter from an animation-frame completion worklet can race
      // with native Modal teardown on iOS.
      dismissalFallback = setTimeout(() => setShowModal(false), 300);
    }

    return () => {
      if (dismissalFallback) clearTimeout(dismissalFallback);
    };
  }, [isOpen, activeHeight, translateY]);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      } else {
        // Apply resistance if dragging upwards past original boundary
        translateY.value = event.translationY * 0.15;
      }
    })
    .onEnd((event) => {
      if (event.translationY > activeHeight * 0.25 || event.velocityY > 450) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, {
          damping: 22,
          stiffness: 180,
          mass: 0.8,
        });
      }
    });

  if (!showModal) return null;

  return (
    <BottomSheetModal
      activeHeight={activeHeight}
      onClose={handleClose}
      panGesture={panGesture}
      translateY={translateY}
    >
      {children}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabberContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerContent: {
    flex: 1,
  },
});
