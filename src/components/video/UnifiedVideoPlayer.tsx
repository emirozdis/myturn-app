import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, { FadeOut } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useHoldToSeekGesture } from './useHoldToSeekGesture';

interface UnifiedVideoPlayerProps {
  sourceUrl: string;
  thumbnailUrl?: string;
  isPaused: boolean;
  onNext: () => void;
  onPrev: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  onProgress?: (progress: number) => void;
}

export function UnifiedVideoPlayer({
  sourceUrl,
  thumbnailUrl,
  isPaused,
  onNext,
  onPrev,
  onLongPressStart,
  onLongPressEnd,
  onProgress
}: UnifiedVideoPlayerProps) {
  const [isLoaded, setIsVideoLoaded] = useState(false);
  const seekStartTimeRef = useRef(0);
  
  // FIX: Initialize with null, then replace synchronously
  const player = useVideoPlayer(null, (p) => {
    p.loop = false; // Set loop false to allow playToEnd detection
  });

  // Automatically advance to the next clip mirroring PWA behavior
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      onNext();
    });
    return () => {
      subscription.remove();
    };
  }, [player, onNext]);

  useEffect(() => {
    if (isPaused) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPaused, player]);

  useEffect(() => {
    if (sourceUrl) {
      setIsVideoLoaded(false);
      try {
        player.replace(sourceUrl);
        if (!isPaused) {
          player.play();
        }
      } catch (err) {
        console.warn("[UnifiedVideoPlayer] Sync replace failed:", err);
      }
    }
  }, [sourceUrl, player, isPaused]);

  useEffect(() => {
    let interval: any;
    if (!isPaused) {
      interval = setInterval(() => {
        if (player.duration) {
          const progressVal = (player.currentTime / player.duration) * 100;
          onProgress?.(progressVal);
          if (player.currentTime > 0.05) {
            setIsVideoLoaded(true);
          }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [player, isPaused, onProgress]);

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const width = Dimensions.get('window').width;
      if (e.x > width * 0.75) {
        onNext();
      } else if (e.x < width * 0.25) {
        onPrev();
      }
    });

  const holdToSeekGesture = useHoldToSeekGesture({
    onHoldStart: () => {
      seekStartTimeRef.current = player.currentTime ?? 0;
      player.pause();
      onLongPressStart?.();
    },
    onSeek: (translationX, elapsedMs) => {
      if (!player.duration) return;
      const speed = Math.min(8, 0.75 + Math.abs(translationX) / 75);
      const nextTime = Math.max(
        0,
        Math.min(player.duration, seekStartTimeRef.current + Math.sign(translationX) * speed * (elapsedMs / 1000)),
      );
      player.currentTime = nextTime;
      onProgress?.((nextTime / player.duration) * 100);
    },
    onHoldEnd: () => {
      if (!isPaused) player.play();
      onLongPressEnd?.();
    },
  });

  const composedGesture = Gesture.Exclusive(holdToSeekGesture, tapGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { opacity: isLoaded ? 1 : 0 }]}
          contentFit="cover"
          nativeControls={false}
        />

        {!isLoaded && thumbnailUrl && (
          <Animated.Image
            exiting={FadeOut.duration(300)}
            source={{ uri: thumbnailUrl }}
            style={[StyleSheet.absoluteFill, styles.blurPlaceholder]}
            blurRadius={20}
          />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  blurPlaceholder: {
    opacity: 1,
  },
});
