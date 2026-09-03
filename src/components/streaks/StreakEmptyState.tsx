
// ./src/components/streaks/StreakEmptyState.tsx
"use client";

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Dimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Text } from '../ui/Text';
import { lightTap } from '../../lib/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

interface StreakEmptyStateProps {
  insetsBottom: number;
}

export function StreakEmptyState({ insetsBottom }: StreakEmptyStateProps) {
  const router = useRouter();

  const handleExploreToday = () => {
    lightTap();
    router.push('/(app)/today');
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(insetsBottom, 24) + 80 }
      ]}
    >
      {/* Main Empty State Card */}
      <Animated.View entering={FadeInUp.duration(400).springify().damping(24)} style={styles.mainCard}>
        <View style={styles.illustrationWrapper}>
          <Image
            source={require('../../../assets/images/empty_states/streak.png')}
            style={styles.illustrationImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.serifTitle, { fontFamily: serifFont }]}>
          Henüz bir vlog{"\n"}parçası yok.
        </Text>

        <Text style={styles.descriptionText}>
          Çektiğin vlog parçaları ve arşiv burada toplanır.{"\n"}Her gün bir parça kaydet, zamanla anılar birikir.
        </Text>

        <TouchableOpacity
          onPress={handleExploreToday}
          activeOpacity={0.85}
          style={styles.exploreButton}
        >
          <Text weight="bold" style={styles.exploreButtonText}>
            Bugünkü akışı keşfet
          </Text>
          <ChevronRight size={18} color="#000000" strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Informational Banner */}
      <Animated.View entering={FadeInUp.delay(100).duration(400).springify().damping(24)}>
        <TouchableOpacity
          onPress={handleExploreToday}
          activeOpacity={0.85}
          style={styles.tipCard}
        >
          <View style={styles.tipIconWrapper}>
            <Image
              source={require('../../../assets/icons/star.png')}
              style={styles.tipStarIcon}
              resizeMode="contain"
            />
          </View>

          <View style={styles.tipTextBlock}>
            <Text weight="bold" style={styles.tipTitle}>
              Rastgele vlogger seçilir, yalnızca sen görürsün.
            </Text>
            <Text style={styles.tipSubtitle}>
              Güvenli, özel ve sadece senin hikayen.
            </Text>
          </View>

          <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  mainCard: {
    width: '100%',
    backgroundColor: '#161617',
    borderRadius: 32,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
  },
  
  illustrationWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationImage: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    maxHeight: 500,
    marginBottom: -70,
    marginTop: -30,
  },
  serifTitle: {
    fontSize: 28,
    color: '#FAF9F6',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  descriptionText: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  exploreButton: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    width: '100%',
    maxWidth: 300,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  },
  tipCard: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#161617',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tipIconWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipStarIcon: {
    width: 24,
    height: 24,
  },
  tipTextBlock: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  tipTitle: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 3,
  },
  tipSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
  },
});
