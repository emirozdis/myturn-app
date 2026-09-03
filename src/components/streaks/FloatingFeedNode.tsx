"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { Text } from '../ui/Text';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface FloatingFeedItem {
  id: string;
  type: 'like' | 'photoResponse' | 'comment';
  userImage: string | null;
  userName: string;
  text?: string;
  imageUrl?: string;
  delay: number;
}

interface FloatingFeedNodeProps {
  item: FloatingFeedItem;
  cardHeight: number;
  onComplete: (itemId: string) => void;
}

function normalizeImageUri(value?: string | null): string | null {
  const uri = value?.trim();

  if (!uri) return null;

  // Never send a bare storage key or malformed URI to the native image loader.
  if (!/^(https?|file|content):\/\//i.test(uri)) return null;

  return uri;
}

export function FloatingFeedNode({
  item,
  cardHeight,
  onComplete,
}: FloatingFeedNodeProps) {
  const resolvedHeight = cardHeight || SCREEN_HEIGHT * 0.5;
  const imageUri = useMemo(
    () => normalizeImageUri(item.imageUrl),
    [item.imageUrl],
  );

  // Delaying only the animation still mounts and decodes every image at once.
  // Keep the entire native node unmounted until its scheduled start time.
  const [hasStarted, setHasStarted] = useState(false);

  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const finalRemovalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const floatY = useSharedValue(resolvedHeight - 60);
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const driftX = useSharedValue(32);
  const rotation = useSharedValue(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cancelAllAnimations = () => {
    cancelAnimation(floatY);
    cancelAnimation(scale);
    cancelAnimation(opacity);
    cancelAnimation(driftX);
    cancelAnimation(rotation);
  };

  const completeFromJS = () => {
    if (completedRef.current) return;

    completedRef.current = true;
    cancelAllAnimations();

    if (finalRemovalTimerRef.current) {
      clearTimeout(finalRemovalTimerRef.current);
    }

    // Give native/Reanimated one frame to observe the cancelled animations
    // before React removes the animated view from the hierarchy.
    finalRemovalTimerRef.current = setTimeout(() => {
      finalRemovalTimerRef.current = null;
      onCompleteRef.current(item.id);
    }, 32);
  };

  useEffect(() => {
    completedRef.current = false;
    setHasStarted(false);

    if (item.type === 'photoResponse' && !imageUri) {
      const invalidImageTimer = setTimeout(() => {
        completeFromJS();
      }, 0);

      return () => {
        clearTimeout(invalidImageTimer);
        if (finalRemovalTimerRef.current) {
          clearTimeout(finalRemovalTimerRef.current);
          finalRemovalTimerRef.current = null;
        }
        cancelAllAnimations();
      };
    }

    let animationFrame: number | null = null;

    const startTimer = setTimeout(() => {
      setHasStarted(true);

      // Wait until React has committed the native view before assigning the
      // animations. No worklet completion callback is used anywhere here.
      animationFrame = requestAnimationFrame(() => {
        floatY.value = resolvedHeight - 60;
        scale.value = 0.3;
        opacity.value = 0;
        driftX.value = 32;
        rotation.value = 0;

        scale.value = withTiming(1, { duration: 400 });

        opacity.value = withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(1800, withTiming(0, { duration: 1000 })),
        );

        floatY.value = withTiming(resolvedHeight * 0.3, {
          duration: 4200,
        });

        driftX.value = withTiming(
          32 + (Math.random() * 40 - 20),
          { duration: 4200 },
        );

        rotation.value = withTiming(
          Math.random() * 24 - 12,
          { duration: 4200 },
        );
      });
    }, Math.max(0, item.delay));

    // Cleanup stays entirely on the JavaScript thread. This avoids passing a
    // React state-changing callback through runOnJS while the same native view
    // is being removed.
    const completionTimer = setTimeout(() => {
      completeFromJS();
    }, Math.max(0, item.delay) + 4300);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(completionTimer);

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      if (finalRemovalTimerRef.current) {
        clearTimeout(finalRemovalTimerRef.current);
        finalRemovalTimerRef.current = null;
      }

      cancelAllAnimations();
    };
  }, [item.id, item.type, item.delay, imageUri, resolvedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: floatY.value },
      { translateX: driftX.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  if (!hasStarted) return null;

  if (item.type === 'like') {
    return (
      <Animated.View
        style={[styles.floatingFeedNode, animatedStyle]}
        pointerEvents="none"
      >
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
    if (!imageUri) return null;

    return (
      <Animated.View
        style={[styles.floatingFeedNode, animatedStyle]}
        pointerEvents="none"
      >
        <View style={styles.bubbleImgContainer}>
          <View style={styles.imageClip}>
            <Image
              source={{ uri: imageUri }}
              style={styles.bubbleImg}
              resizeMode="cover"
              resizeMethod="resize"
              onError={completeFromJS}
            />
          </View>

          <View style={styles.bubbleAvatarWrapper}>
            <Avatar src={item.userImage} name={item.userName} size={18} />
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.floatingFeedNode, animatedStyle]}
      pointerEvents="none"
    >
      <View style={styles.commentPillGlassCompact}>
        <Avatar src={item.userImage} name={item.userName} size={20} />
        <Text weight="bold" className="text-white text-[11px] font-semibold">
          @{item.userName.toLowerCase().replace(/\s+/g, '')}:
        </Text>
        <Text
          className="text-white/90 text-[11px] truncate max-w-[120px]"
          numberOfLines={1}
        >
          {item.text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingFeedNode: {
    position: 'absolute',
    left: 12,
    zIndex: 35,
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
    position: 'relative',
  },
  imageClip: {
    width: 54,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: '#111',
  },
  bubbleImg: {
    width: '100%',
    height: '100%',
  },
  bubbleAvatarWrapper: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000',
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
});