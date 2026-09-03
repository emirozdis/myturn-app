// ./src/components/streaks/InteractiveDayCard.tsx
"use client";

import React from 'react';
import { View, StyleSheet, Image, Dimensions, TouchableWithoutFeedback, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';
import { Play, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../ui/Avatar';
import { Text } from '../ui/Text';
import { lightTap } from '../../lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const DAY_CARD_WIDTH = SCREEN_WIDTH * 0.74;
export const DAY_CARD_GAP = 16;
export const DAY_ITEM_INTERVAL = DAY_CARD_WIDTH + DAY_CARD_GAP;
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface InteractiveDayCardProps {
  item: any;
  index: number;
  isActive: boolean;
  onPress: () => void;
  isLocked?: boolean;
}

export function InteractiveDayCard({ item, index, isActive, onPress, isLocked = false }: InteractiveDayCardProps) {
  const scale = useSharedValue(1);
  const dateObj = new Date(item.assignment!.date);
  const weekdayLabel = dateObj.toLocaleDateString("tr-TR", { weekday: 'long', timeZone: 'UTC' });
  const monthDayLabel = dateObj.toLocaleDateString("tr-TR", { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const yearLabel = dateObj.getUTCFullYear();

  const participants = item.assignment?.clips?.map((c: any) => ({
    id: c.userId,
    name: item.assignment!.user.name,
    image: item.assignment!.user.image
  })).filter((v: any, i: number, a: any[]) => a.findIndex(t => t.id === v.id) === i) || [];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value }
    ],
  }));

  const handlePressIn = () => {
    lightTap();
    scale.value = withSpring(0.96, { damping: 24, stiffness: 180 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 24, stiffness: 180 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <View
          style={[
            styles.dayHeroCard,
            isActive ? styles.dayHeroCardActive : styles.dayHeroCardInactive,
          ]}
        >
          <Image 
            source={{ uri: item.assignment!.clips[0]?.thumbnailUrl }} 
            style={StyleSheet.absoluteFill} 
            resizeMode="cover"
            blurRadius={isLocked ? 15 : 0}
          />
          <LinearGradientWrapper />

          <View style={styles.cardHeaderRow}>
            <View style={styles.dayBadge}>
              <Text weight="bold" style={{ color: '#000000' }} className="text-[10px] tracking-wider uppercase">
                {index === 0 ? 'BUGÜN' : index === 1 ? 'DÜN' : 'ARŞİV'}
              </Text>
            </View>
            <View style={styles.miniPlayCircle}>
              {isLocked ? (
                <Lock size={10} color="#fff" />
              ) : (
                <Play size={11} color="#fff" fill="#fff" style={{ marginLeft: 1 }} />
              )}
            </View>
          </View>

          <View style={styles.cardFooterBlock}>
            <Text style={[styles.serifVlogTitle, { fontFamily: serifFont }]}>
              {item.assignment!.user.name}'ın Günü
            </Text>
            <Text className="text-white/60 text-[11px] mt-1 font-medium">
              {weekdayLabel}, {monthDayLabel} {yearLabel}
            </Text>

            <View style={styles.participantsContainer}>
              <View style={styles.avatarOverlapContainer}>
                {participants.slice(0, 3).map((p: any, idx: number) => (
                  <View 
                    key={p.id + idx} 
                    style={[
                      styles.overlapAvatarWrapper, 
                      { marginLeft: idx > 0 ? -12 : 0, zIndex: 10 - idx }
                    ]}
                  >
                    <Avatar src={p.image} name={p.name} size={22} />
                  </View>
                ))}
              </View>
              <Text className="text-white/40 text-[9px] font-bold ml-2 uppercase tracking-wide">
                {item.assignment!.clips.length} Kısım
              </Text>
            </View>
          </View>

          {isLocked && (
            <View style={styles.lockOverlay}>
              <View style={styles.lockBadgeIcon}>
                <Lock size={16} color="#fff" />
              </View>
              <Text weight="bold" style={styles.lockText}>PRO ARŞİV</Text>
            </View>
          )}

          <View style={styles.cardProgressTrack}>
            <View style={[styles.cardProgressFill, { width: isActive ? '100%' : '35%' }]} />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

function LinearGradientWrapper() {
  return (
    <LinearGradient 
      colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.85)']} 
      locations={[0, 0.4, 1]} 
      style={StyleSheet.absoluteFill} 
    />
  );
}

const styles = StyleSheet.create({
  dayHeroCard: {
    width: DAY_CARD_WIDTH,
    height: 220,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#161617',
    position: 'relative',
  },
  dayHeroCardActive: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dayHeroCardInactive: {
    borderColor: 'rgba(255, 255, 255, 0.04)',
    opacity: 0.45,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    zIndex: 10,
  },
  dayBadge: {
    backgroundColor: '#FAF9F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniPlayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterBlock: {
    position: 'absolute',
    bottom: 20,
    left: 18,
    right: 18,
    zIndex: 10,
  },
  serifVlogTitle: {
    fontSize: 21,
    color: '#FAF9F6',
    letterSpacing: -0.3,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  avatarOverlapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlapAvatarWrapper: {
    borderWidth: 1.5,
    borderColor: '#161617',
    borderRadius: 11,
    overflow: 'hidden',
  },
  cardProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cardProgressFill: {
    height: '100%',
    backgroundColor: '#e07c30',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  lockBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockText: {
    color: '#fff',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
