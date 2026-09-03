// ./src/components/streaks/InteractiveAlbumCard.tsx
"use client";

import React from 'react';
import { View, StyleSheet, Image, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  FadeInUp
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { lightTap } from '../../lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_CARD_WIDTH = (SCREEN_WIDTH - 48) / 4;
const ALBUM_CARD_HEIGHT = ALBUM_CARD_WIDTH * 1.35;
const ROTATION_PATTERNS = [-2.8, 2.2, -1.5, 3];

interface InteractiveAlbumCardProps {
  clip: any;
  clipIdx: number;
  rowIdx: number;
  totalCount: number;
  onPlay: (c: any) => void;
  isLocked?: boolean;
}

export function InteractiveAlbumCard({ clip, clipIdx, rowIdx, totalCount, onPlay, isLocked = false }: InteractiveAlbumCardProps) {
  const scale = useSharedValue(1);
  const rotation = ROTATION_PATTERNS[clipIdx % ROTATION_PATTERNS.length];
  const isFourthAndMore = clipIdx === 3 && totalCount > 4;

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation}deg` },
      { scale: scale.value }
    ],
  }));

  const handlePressIn = () => {
    lightTap();
    scale.value = withSpring(0.94, { damping: 20, stiffness: 180 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 180 });
  };

  return (
    <Animated.View 
      entering={FadeInUp.delay((rowIdx * 80) + (clipIdx * 40)).springify().damping(18).stiffness(150).mass(0.9)}
    >
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPlay(clip)}
      >
        <Animated.View style={[styles.albumCard, tiltStyle]}>
          <Image 
            source={{ uri: clip.image }} 
            style={StyleSheet.absoluteFill} 
            resizeMode="cover"
            blurRadius={isLocked ? 15 : (isFourthAndMore ? 12 : 0)}
          />
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.4)']} 
            style={StyleSheet.absoluteFill} 
          />

          {isLocked ? (
            <View style={styles.albumCardOverlay} className="bg-black/30">
              <Lock size={12} color="rgba(255,255,255,0.7)" />
            </View>
          ) : isFourthAndMore ? (
            <View style={styles.albumCardOverlay} className="bg-black/40">
              <Text weight="bold" className="text-white text-base">
                + {totalCount - 3}
              </Text>
            </View>
          ) : (
            <View style={styles.miniTimeLabel}>
              <Text weight="bold" className="text-white text-[8px] font-mono">{clip.timeLabel}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  albumCard: {
    width: ALBUM_CARD_WIDTH,
    height: ALBUM_CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    position: 'relative',
  },
  albumCardOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  miniTimeLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
});