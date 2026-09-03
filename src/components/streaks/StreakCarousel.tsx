// ./src/components/streaks/StreakCarousel.tsx
"use client";

import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Carousel, { TAnimationStyle } from 'react-native-reanimated-carousel';
import { interpolate } from 'react-native-reanimated';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';

const THUMB_WIDTH = 110;
const THUMB_HEIGHT = 146;
const SNAP_WIDTH = 120;

interface StreakCarouselProps {
  clips: any[];
  clipIndex: number;
  setClipIndex: (idx: number) => void;
  isProgrammaticChangeRef: React.MutableRefObject<boolean>;
  SCREEN_WIDTH: number;
}

export function StreakCarousel({
  clips,
  clipIndex,
  setClipIndex,
  isProgrammaticChangeRef,
  SCREEN_WIDTH,
}: StreakCarouselProps) {
  const carouselRef = useRef<any>(null);

  // Sync scroll positioning on active programmatic clipIndex changes
  useEffect(() => {
    if (isProgrammaticChangeRef.current) {
      carouselRef.current?.scrollTo({ index: clipIndex, animated: true });
    }
  }, [clipIndex]);

  // Carousel fanning style worklet featuring wide circular orbiting curve
  const animationStyle: TAnimationStyle = React.useCallback((value: number) => {
    "worklet";

    const zIndex = interpolate(value, [-1, 0, 1], [10, 20, 10]);
    
    // Wider fanning rotation angle
    const rotateZ = `${interpolate(value, [-1, 0, 1], [-14, 0, 14])}deg`;
    
    // Wider horizontal translation fanning
    const translateX = interpolate(
      value,
      [-1, 0, 1],
      [-94, 0, 94]
    );

    // Quadratic circular fanning orbit dip
    const translateY = interpolate(
      value,
      [-2, -1, 0, 1, 2],
      [52, 16, 0, 16, 52]
    );

    const scale = interpolate(
      value,
      [-1, 0, 1],
      [0.85, 1, 0.85]
    );

    return {
      transform: [
        { translateX },
        { translateY },
        { rotateZ },
        { scale }
      ],
      zIndex,
    };
  }, []);

  return (
    <View style={{ width: SCREEN_WIDTH, height: 180, justifyContent: 'center', alignItems: 'center', overflow: 'visible' }} pointerEvents="box-none">
      <Carousel
        ref={carouselRef}
        loop={false}
        width={SNAP_WIDTH}
        height={180}
        style={{
          width: SCREEN_WIDTH,
          height: 180,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'visible',
        }}
        data={clips}
        defaultIndex={clipIndex}
        scrollAnimationDuration={350}
        onSnapToItem={(index) => {
          setClipIndex(index);
          isProgrammaticChangeRef.current = false;
        }}
        onProgressChange={(_, absoluteProgress) => {
          const nearestIndex = Math.round(absoluteProgress);
          const safeIndex = Math.max(0, Math.min(clips.length - 1, nearestIndex));
          if (safeIndex !== clipIndex && !isProgrammaticChangeRef.current) {
            setClipIndex(safeIndex);
          }
        }}
        customAnimation={animationStyle}
        renderItem={({ item, index: idx }) => {
          const itemClip = item as any; // Explicit typecast resolves TS18046 warnings
          const isSelected = idx === clipIndex;
          const timeLabel = new Date(itemClip.recordedAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });

          return (
            <View style={{ width: SNAP_WIDTH, height: 180, justifyContent: 'center', alignItems: 'center', overflow: 'visible' }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  isProgrammaticChangeRef.current = true;
                  setClipIndex(idx);
                }}
                style={[
                  styles.carouselThumbCard,
                  { width: THUMB_WIDTH, height: THUMB_HEIGHT },
                  isSelected && { borderColor: ACCENT, borderWidth: 2 }
                ]}
              >
                <Image source={{ uri: itemClip.thumbnailUrl }} style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                {!isSelected && <View style={styles.carouselThumbCardDimmer} />}

                <View style={styles.carouselThumbTime}>
                  <Text weight="bold" className="text-white text-[9px] font-mono">{timeLabel}</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  carouselThumbCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  carouselThumbCardDimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  carouselThumbTime: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
});
