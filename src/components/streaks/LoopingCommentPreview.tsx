// ./src/components/streaks/LoopingCommentPreview.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MessageCircle } from 'lucide-react-native';

import { Avatar } from '../ui/Avatar';
import { Text } from '../ui/Text';
import { GlassView } from '../ui/GlassView';
import { ACCENT } from '../../lib/theme';

interface LoopingCommentPreviewProps {
  comments: any[];
  commentCount: number;
  onPress: () => void;
}

const DISPLAY_DURATION = 4000;
const FADE_OUT_DURATION = 250;
const FADE_IN_DURATION = 300;

export function LoopingCommentPreview({
  comments,
  commentCount,
  onPress,
}: LoopingCommentPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  const transitionTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Reset the preview when the comment collection changes.
   *
   * This also prevents currentIndex from pointing beyond the new array
   * after comments are removed or replaced.
   */
  useEffect(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    cancelAnimation(opacity);
    cancelAnimation(translateY);

    setCurrentIndex(0);

    opacity.value = 1;
    translateY.value = 0;
  }, [comments, opacity, translateY]);

  /*
   * Run all React state updates on the normal React Native runtime.
   *
   * There is intentionally no withTiming completion callback here.
   * A withTiming callback executes on the UI Worklet runtime, where calling
   * setCurrentIndex or accessing a normal React ref would trigger:
   *
   * "[Worklets] Tried to synchronously call a Remote Function"
   */
  useEffect(() => {
    if (comments.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      cancelAnimation(opacity);
      cancelAnimation(translateY);

      opacity.value = withTiming(0, {
        duration: FADE_OUT_DURATION,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      });

      translateY.value = withTiming(5, {
        duration: FADE_OUT_DURATION,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      });

      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      /*
       * setTimeout runs on the React Native JS runtime, so calling
       * setCurrentIndex here is safe.
       */
      transitionTimerRef.current = setTimeout(() => {
        setCurrentIndex((previousIndex) => {
          return (previousIndex + 1) % comments.length;
        });

        /*
         * Keep the new comment hidden and slightly lowered for this render,
         * then animate it into place on the next frame.
         */
        opacity.value = 0;
        translateY.value = 5;

        requestAnimationFrame(() => {
          opacity.value = withTiming(1, {
            duration: FADE_IN_DURATION,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });

          translateY.value = withTiming(0, {
            duration: FADE_IN_DURATION,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
        });

        transitionTimerRef.current = null;
      }, FADE_OUT_DURATION);
    }, DISPLAY_DURATION);

    return () => {
      clearInterval(interval);

      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      cancelAnimation(opacity);
      cancelAnimation(translateY);
    };
  }, [comments.length, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        {
          translateY: translateY.value,
        },
      ],
    };
  });

  /*
   * Modulo protects the render during the short period between a comments
   * array update and the reset effect running.
   */
  const activeComment =
    comments.length > 0
      ? comments[currentIndex % comments.length]
      : undefined;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
    >
      <GlassView
        preset="frosted"
        style={styles.liquidGlassCommentsBox}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-1.5">
            <MessageCircle
              size={13}
              color="rgba(255,255,255,0.6)"
            />

            <Text
              weight="bold"
              className="text-white/75 text-xs"
            >
              Yorumlar ({commentCount})
            </Text>
          </View>

          <Text
            weight="bold"
            style={{ color: ACCENT }}
            className="text-[10px] uppercase tracking-wider"
          >
            Hepsini Gör
          </Text>
        </View>

        <Animated.View style={animatedStyle}>
          {activeComment ? (
            <View className="flex-row items-start gap-2.5 py-0.5">
              <Avatar
                src={activeComment.user?.image}
                name={activeComment.user?.name}
                size={18}
              />

              <View className="flex-1 flex-row flex-wrap items-baseline gap-1">
                <Text
                  weight="bold"
                  className="text-white text-[11px]"
                >
                  @{activeComment.user?.handle || 'friend'}
                </Text>

                <Text className="text-white/80 text-[11px] leading-relaxed">
                  {activeComment.text}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="text-white/35 text-[11px] py-1">
              İlk yorumu yazmak için dokunun...
            </Text>
          )}
        </Animated.View>
      </GlassView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  liquidGlassCommentsBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
});