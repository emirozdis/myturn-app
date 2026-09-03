// ./src/components/achievements/AchievementOverlay.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Modal,
  TouchableOpacity,
  Share,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { X, Share2, Sparkles, Flame, Check } from 'lucide-react-native';

import { useAchievementStore } from '../../store/useAchievementStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { getLocalizedAchievements, ACHIEVEMENT_ICONS } from './achievementData';
import { ParticleEffect } from './ParticleEffect';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';
import { notifySuccess, mediumTap } from '../../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;

const SPRING_CFG = { damping: 26, stiffness: 200, mass: 0.9 };

// --- SUB-WIDGET MODULES (PREMIUM STYLING) ---

function ModuleWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.moduleCard}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

function CalendarModule({ days }: { days: boolean[] }) {
  const { t } = useTranslation();
  const dayLabels = ["PZT", "SAL", "ÇAR", "PER", "CUM", "CMT", "PAZ"];
  
  return (
    <View className="w-full p-4 flex-col gap-3">
      <Text weight="bold" className="text-white/40 text-[9px] uppercase tracking-widest mb-1">
        {t("streaks.memoryCalendar", "Hafıza Takvimi")}
      </Text>
      <View className="flex-row justify-between items-center">
        {days.slice(0, 7).map((achieved, i) => (
          <View key={i} className="items-center gap-1.5">
            <Text weight="bold" className="text-[9px] text-white/30">{dayLabels[i]}</Text>
            <View
              style={[
                styles.calendarDayDot,
                achieved && { backgroundColor: ACCENT, borderColor: ACCENT }
              ]}
            >
              {achieved && <Check size={12} color="#000" strokeWidth={4} />}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatsModule({ items }: { items: any[] }) {
  return (
    <View className="w-full gap-3 p-4">
      {items.map((item, i) => (
        <View key={i} className="flex-row items-center justify-between py-1">
          <Text className="text-white/50 text-xs font-medium">{item.label}</Text>
          <Text weight="bold" className="text-white text-sm font-mono">{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ProgressBarModule({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  return (
    <View className="w-full p-4 gap-2">
      <View className="flex-row justify-between items-baseline mb-0.5">
        <Text weight="bold" className="text-white text-xs">{label}</Text>
        <Text weight="bold" style={{ color: ACCENT }} className="text-[11px] font-mono">
          {current} <Text className="text-white/40">/ {max}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fillBar, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

// --- MAIN CELEBRATION SHEET ---

export function AchievementOverlay() {
  const store = useAchievementStore();
  const { locale } = useLanguageStore();

  const [visible, setVisible] = useState(false);
  const task = store.activeTask;
  const dismissalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (task) {
      if (dismissalTimerRef.current) {
        clearTimeout(dismissalTimerRef.current);
        dismissalTimerRef.current = null;
      }
      isDismissingRef.current = false;
      setVisible(true);
      notifySuccess();
      translateY.value = withSpring(0, SPRING_CFG);
      backdropOpacity.value = withTiming(0.65, { duration: 250 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
      dismissalTimerRef.current = setTimeout(() => {
        setVisible(false);
        dismissalTimerRef.current = null;
      }, 240);
    }

    return () => {
      if (dismissalTimerRef.current) {
        clearTimeout(dismissalTimerRef.current);
        dismissalTimerRef.current = null;
      }
    };
  }, [task]);

  const handleDismiss = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    mediumTap();
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 220 });
    backdropOpacity.value = withTiming(0, { duration: 220 });

    if (dismissalTimerRef.current) clearTimeout(dismissalTimerRef.current);
    dismissalTimerRef.current = setTimeout(() => {
      dismissalTimerRef.current = null;
      isDismissingRef.current = false;
      store.dequeue();

      if (!useAchievementStore.getState().activeTask) {
        setVisible(false);
      }
    }, 240);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      } else {
        translateY.value = e.translationY * 0.15;
      }
    })
    .onEnd((e) => {
      if (e.translationY > SHEET_HEIGHT * 0.25 || e.velocityY > 450) {
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0, SPRING_CFG);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const config = useMemo(() => {
    if (!task) return null;

    if (task.type === 'achievement') {
      const registry = getLocalizedAchievements(locale);
      return registry[task.id] || null;
    }

    if (task.type === 'levelUp') {
      const isTr = locale === 'tr';
      const c = task.config;
      const isIndiv = c.type === 'individual';

      return {
        id: 'levelup',
        particles: 'confetti' as const,
        image: {
          src: isIndiv ? 'crown' : 'fire',
          value: String(c.to),
        },
        title: isTr 
          ? (isIndiv ? 'Yeni Kademe Açıldı! 👑' : 'Grup Seviye Atladı! 🌟')
          : (isIndiv ? 'New Tier Unlocked! 👑' : 'Group Level Up! 🌟'),
        highlight: isTr 
          ? (isIndiv ? 'Açıldı!' : 'Seviye') 
          : (isIndiv ? 'Unlocked!' : 'Level'),
        subtitle: isTr 
          ? (isIndiv ? 'Rütbe Atlandı' : `Grup: ${c.name || 'Grup'}`)
          : (isIndiv ? 'Rank Promoted' : `Group: ${c.name || 'Group'}`),
        description: isTr
          ? (isIndiv 
              ? `Grup bağlamında rütbeniz yükseldi! Yeni rütbeniz: ${c.to}.` 
              : `Grup XP puanlarınız arttı ve grubunuz ${c.to}. Seviyeye ulaştı!`)
          : (isIndiv 
              ? `You ascended to a higher rank in your group! New rank: ${c.to}.` 
              : `Your group experience points increased, reaching Level ${c.to}!`),
        primaryAction: isTr ? 'Övgüyü Kabul Et' : 'Claim Glory',
        secondaryAction: isTr ? 'Paylaş' : 'Share',
      };
    }

    return null;
  }, [task, locale]);

  const handleShare = async () => {
    if (!config) return;
    try {
      await Share.share({
        message: `${config.title} - ${config.subtitle}: ${config.description} #MyTurn`,
      });
    } catch {}
  };

  if (!visible || !config) return null;

  const resolvedIconAsset = ACHIEVEMENT_ICONS[config.image.src] || ACHIEVEMENT_ICONS['trophy'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.root}>
        {/* Backdrop glass */}
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} pointerEvents="auto" />

        {/* Dynamic canvas particles */}
        <ParticleEffect type={config.particles} />

        {/* Friction-panning bottom sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, animatedSheetStyle]}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.grabberContainer}>
              <View style={styles.grabber} />
            </View>

            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} activeOpacity={0.75}>
              <X size={15} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.content}>
              {/* Header Title Row */}
              <View className="items-center px-6 mt-1">
                <View className="px-3 py-1 bg-[#e07c30]/10 border border-[#e07c30]/20 rounded-full flex-row items-center gap-1.5 mb-3.5">
                  <Sparkles size={11} color={ACCENT} />
                  <Text weight="bold" style={{ color: ACCENT }} className="text-[10px] uppercase tracking-widest leading-none">
                    {locale === 'tr' ? 'Ödül Kazanımı' : 'Unlocked Achievement'}
                  </Text>
                </View>
                <Text weight="bold" style={styles.titleText} className="text-white text-3xl text-center tracking-tight leading-none">
                  {config.title}
                </Text>
                <Text weight="bold" style={{ color: ACCENT }} className="text-xs uppercase tracking-widest mt-2">
                  {config.subtitle}
                </Text>
              </View>

              {/* Clean, Large, Floating PNG Artwork (No bounding concentric circles) */}
              <View style={styles.badgeContainer}>
                <View style={styles.iconImageContainer}>
                  <Image 
                    source={resolvedIconAsset} 
                    style={styles.iconImage}
                    resizeMode="contain"
                  />
                  {config.image.value ? (
                    <View style={styles.stampBox}>
                      {/* Background Extruded Shadow Text */}
                      <Text weight="bold" style={styles.stampShadow} className="absolute">
                        {config.image.value}
                      </Text>
                      {/* Front High Contrast Text */}
                      <Text weight="bold" style={styles.stampFront}>
                        {config.image.value}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Dynamic Information Modules (Stats, Calendars, Progress) */}
              <View style={styles.modulesContainer}>
                {config.id === 'levelup' ? (
                  <ModuleWrapper>
                    <ProgressBarModule current={100} max={100} label={locale === 'tr' ? 'Seviye İlerlemesi' : 'Rank Progression'} />
                  </ModuleWrapper>
                ) : config.id === 'on-duty' || config.id === 'the-guardian' ? (
                  <ModuleWrapper>
                    <CalendarModule days={[true, true, true, true, true, false, false]} />
                  </ModuleWrapper>
                ) : (
                  <ModuleWrapper>
                    <StatsModule 
                      items={[
                        { label: locale === 'tr' ? 'Puan Türü' : 'Metric category', value: 'Co-op Streak' },
                        { label: locale === 'tr' ? 'Kazanılan XP' : 'Unlocked XP value', value: '+150 XP' }
                      ]} 
                    />
                  </ModuleWrapper>
                )}
              </View>

              {/* Description Body */}
              <View className="items-center px-8 mb-6">
                <Text style={styles.descriptionText} className="text-white/60 text-sm text-center leading-relaxed">
                  {config.description}
                </Text>
              </View>

              {/* High Contrast Actions */}
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  onPress={handleDismiss}
                  style={styles.primaryButton}
                  activeOpacity={0.8}
                >
                  <Text weight="bold" className="text-black text-[15px] font-black">
                    {config.primaryAction}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShare}
                  style={styles.secondaryButton}
                  activeOpacity={0.75}
                >
                  <View className="flex-row items-center gap-1.5">
                    <Share2 size={13} color={ACCENT} />
                    <Text weight="bold" style={{ color: ACCENT }} className="text-xs">
                      {config.secondaryAction}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// Lightweight localized helper mapping fallback words inside compiled components
function useTranslation() {
  const { locale } = useLanguageStore();
  const isTr = locale === 'tr';
  return {
    t: (key: string, fallback: string) => {
      if (key === "streaks.memoryCalendar") return isTr ? "Hafıza Takvimi" : "Memory Calendar";
      return fallback;
    }
  };
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
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 0,
    overflow: 'hidden',
    paddingBottom: 32,
  },
  grabberContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  content: {
    flex: 1,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 28,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.5,
  },
  badgeContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImageContainer: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  iconImage: {
    width: '100%',
    height: '100%',
    opacity: 0.95,
  },
  stampBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    bottom: -6,
  },
  stampShadow: {
    fontSize: 48,
    color: '#3f3f46',
    top: 2,
    left: 2,
    zIndex: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 6,
    fontFamily: 'Satoshi-Bold',
  },
  stampFront: {
    fontSize: 48,
    color: '#ffffff',
    zIndex: 2,
    fontFamily: 'Satoshi-Bold',
  },
  modulesContainer: {
    width: '100%',
    paddingHorizontal: 24,
  },
  moduleCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  calendarDayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 3,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  descriptionText: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 13,
  },
  actionContainer: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#9c5218',
  },
  secondaryButton: {
    width: '100%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
