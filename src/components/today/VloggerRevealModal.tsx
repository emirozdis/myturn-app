// ./src/components/today/VloggerRevealModal.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Platform,
  Text as RNText,
} from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';

import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import { useGroupStore } from '../../store/useGroupStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { GlassView } from '../ui/GlassView';
import { selectionTick, notifySuccess, heavyTap } from '../../lib/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const numeralFont = Platform.OS === 'ios' ? 'Georgia-Bold' : 'serif';
const statFont = Platform.select({ ios: 'SF Pro Rounded', android: 'sans-serif-medium', default: 'System' });

// Critically damped, non-bouncing spring for the sheet slide + drag-to-dismiss
const SHEET_SPRING_CONFIG = {
  damping: 34,
  stiffness: 280,
  mass: 0.9,
  overshootClamping: true,
};

// Slightly softer spring for internal step crossfades (still no overshoot)
const APPLE_SPRING_CONFIG = {
  damping: 30,
  stiffness: 200,
  mass: 1,
  overshootClamping: true,
};

const SMOOTH_EASE = Easing.bezier(0.25, 1, 0.5, 1);
const EXIT_EASE = Easing.bezier(0.22, 1, 0.36, 1); // Butter-smooth premium deceleration curve for exit

type RevealState = 'unrevealed' | 'counting' | 'revealed';

type CycleMember = {
  id: string;
  name: string;
  handle?: string;
  image: string;
};

const AVATAR_CYCLE_INTERVAL_MS = 95;
const AVATAR_WARMUP_MS = 900;

function isNativeImageUri(value: string): boolean {
  return /^(https?|file|content):\/\//i.test(value);
}

interface VloggerRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    handle: string;
    image: string | null;
    bio?: string;
    vlogCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
}

function LiquidGlassNumber({ value }: { value: number | string }) {
  const font = Platform.OS === 'ios' ? 'HelveticaNeue-CondensedBold' : 'sans-serif-condensed';
  return (
    <View style={styles.glassNumberContainer}>
      {/* 1. Ground drop shadow */}
      <RNText
        style={[
          styles.glassNumberBase,
          {
            fontFamily: font,
            color: 'transparent',
            textShadowColor: 'rgba(0, 0, 0, 0.4)',
            textShadowOffset: { width: 2, height: 4 },
            textShadowRadius: 6,
          }
        ]}
      >
        {value}
      </RNText>

      {/* 2. Bottom-right dark etched bevel */}
      <RNText
        style={[
          styles.glassNumberBase,
          StyleSheet.absoluteFill,
          {
            fontFamily: font,
            color: 'transparent',
            textShadowColor: 'rgba(0, 0, 0, 0.22)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 0.5,
          }
        ]}
      >
        {value}
      </RNText>

      {/* 3. Top-left glossy white highlight bevel */}
      <RNText
        style={[
          styles.glassNumberBase,
          StyleSheet.absoluteFill,
          {
            fontFamily: font,
            color: 'transparent',
            textShadowColor: 'rgba(255, 255, 255, 0.85)',
            textShadowOffset: { width: -1.2, height: -1.2 },
            textShadowRadius: 1,
          }
        ]}
      >
        {value}
      </RNText>

      {/* 4. Semi-translucent blue-white glass refraction body fill */}
      <RNText
        style={[
          styles.glassNumberBase,
          StyleSheet.absoluteFill,
          {
            fontFamily: font,
            color: 'rgba(224, 236, 255, 0.26)',
          }
        ]}
      >
        {value}
      </RNText>
    </View>
  );
}

export function VloggerRevealModal({ isOpen, onClose, user }: VloggerRevealModalProps) {
  const { locale } = useLanguageStore();
  const groupStore = useGroupStore();

  const [revealState, setRevealState] = useState<RevealState>('unrevealed');
  const [countdown, setCountdown] = useState<number>(3);
  const [cycleIndex, setCycleIndex] = useState<number>(0);
  const [visible, setVisible] = useState(isOpen);
  const [isPreparingAvatars, setIsPreparingAvatars] = useState(false);

  const avatarWarmupPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // Sheet transform: translateY drives the slide-from-bottom / slide-to-bottom motion.
  // Also doubles as the drag-to-dismiss offset once settled at rest (0).
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const scale = useSharedValue(0.96);
  const backdropOpacity = useSharedValue(0);

  // Separate Step Opacities to enable pure cinematic crossfading transitions
  const unrevealedOpacity = useSharedValue(1);
  const countingOpacity = useSharedValue(0);
  const revealedOpacity = useSharedValue(0);

  // Expansion progress for bio/stats card morphing
  const expansionProgress = useSharedValue(0);

  // Countdown Scale
  const numberScale = useSharedValue(1.4);

  const activeGroup = groupStore.groups.find(g => g.id === groupStore.activeGroupId);
  const groupName = activeGroup?.name || "";

  // Use only members of the currently active group. Each Avatar remains
  // mounted before counting begins, allowing Avatar's signed-URL resolver and
  // native image cache to finish before the rapid cycle starts.
  const cycleMembers = useMemo<CycleMember[]>(() => {
    const members = Array.isArray(activeGroup?.members)
      ? activeGroup.members
      : [];

    const uniqueMembers = new Map<string, CycleMember>();

    members.forEach((membership: any, index: number) => {
      const member = membership?.user ?? membership;
      const image =
        member?.image ??
        member?.avatar ??
        membership?.image ??
        membership?.avatar ??
        null;

      // Do not cycle fallback silhouettes/colors. Only members with an actual
      // profile picture participate in the high-speed image sequence.
      if (!image || typeof image !== 'string') return;

      const id = String(
        member?.id ??
        membership?.userId ??
        membership?.id ??
        `${image}_${index}`,
      );

      uniqueMembers.set(id, {
        id,
        name: member?.name ?? membership?.name ?? 'Member',
        handle: member?.handle ?? membership?.handle,
        image,
      });
    });

    // Ensure the selected vlogger is cached as well, even if the group payload
    // omitted them from the members relation.
    if (user?.image && !uniqueMembers.has(String(user.id))) {
      uniqueMembers.set(String(user.id), {
        id: String(user.id),
        name: user.name || 'Member',
        handle: user.handle,
        image: user.image,
      });
    }

    return Array.from(uniqueMembers.values());
  }, [
    activeGroup?.members,
    user.id,
    user.name,
    user.handle,
    user.image,
  ]);

  const listLength = cycleMembers.length;
  const cycleMembersCacheKey = useMemo(
    () => cycleMembers.map(member => `${member.id}:${member.image}`).join('|'),
    [cycleMembers],
  );

  const isTr = locale === 'tr';
  const strings = {
    title: isTr ? "Bugünün Vlogger'ı" : "Today's Vlogger",
    subtitleUnrevealed: isTr ? "Topluluğumuzun en yaratıcı anlarını seninle paylaşıyoruz." : "Sharing the most creative moments of our community with you.",
    subtitleRevealed: isTr ? "Topluluğumuzun en yaratıcı, samimi ve ilham verici vloglarını öne çıkarıyoruz." : "Highlighting the most creative, authentic and inspiring vlogs.",
    subtitleCounting: isTr ? "Günün vlogger'ı seçiliyor..." : "Selecting the vlogger for today...",
    unrevealedFooter: isTr ? "Kimin seçildiğini görmek için hemen açıkla." : "Reveal now to see who has been selected.",
    countingFooter: isTr ? "Geri sayım tamamlandığında yeni vlogger ortaya çıkacak." : "Wait for the countdown to meet today's storyteller.",
    buttonAction: isTr ? "Açıkla" : "Reveal",
    buttonPreparing: isTr ? "Görseller hazırlanıyor..." : "Preparing images...",
    buttonCounting: isTr ? "Açıklanıyor..." : "Revealing...",
    buttonWatch: isTr ? "Bugünkü Akışı Keşfet" : "Explore Today's Feed",
    quote: isTr ? "“Anılarını özgünlüğünle paylaşıyor, topluluğumuza ilham veriyorsun.”" : "“Sharing memories with authenticity, you inspire our community.”",
  };

  const vloggerQuote = user?.bio || strings.quote;

  // Warm the native cache as soon as the modal opens. Absolute URLs can be
  // prefetched directly. Relative storage keys are resolved by the hidden,
  // permanently mounted Avatar instances in the render tree below.
  useEffect(() => {
    if (!isOpen) {
      avatarWarmupPromiseRef.current = Promise.resolve();
      setIsPreparingAvatars(false);
      return;
    }

    let cancelled = false;

    const absoluteUrls = cycleMembers
      .map(member => member.image)
      .filter(isNativeImageUri);

    const nativePrefetchPromise = Promise.allSettled(
      absoluteUrls.map(uri => Image.prefetch(uri)),
    ).then(() => undefined);

    const minimumWarmupPromise = new Promise<void>(resolve => {
      setTimeout(resolve, cycleMembers.length > 0 ? AVATAR_WARMUP_MS : 0);
    });

    const warmupPromise = Promise.all([
      nativePrefetchPromise,
      minimumWarmupPromise,
    ]).then(() => undefined);

    avatarWarmupPromiseRef.current = warmupPromise;

    warmupPromise.finally(() => {
      if (!cancelled) {
        setIsPreparingAvatars(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, cycleMembersCacheKey]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setRevealState('unrevealed');
      setCountdown(3);
      setCycleIndex(0);
      setIsPreparingAvatars(false);
      expansionProgress.value = 0;

      unrevealedOpacity.value = 1;
      countingOpacity.value = 0;
      revealedOpacity.value = 0;

      translateY.value = SCREEN_HEIGHT;
      scale.value = 0.96;
      backdropOpacity.value = 0;

      backdropOpacity.value = withTiming(1, { duration: 260, easing: SMOOTH_EASE });
      translateY.value = withSpring(0, SHEET_SPRING_CONFIG);
      scale.value = withSpring(1, SHEET_SPRING_CONFIG);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 320, easing: EXIT_EASE });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 420, easing: EXIT_EASE }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (revealState === 'counting') {
      numberScale.value = 1.3;
      numberScale.value = withSpring(1, APPLE_SPRING_CONFIG);

      timer = setTimeout(() => {
        if (countdown > 1) {
          selectionTick();
          setCountdown(prev => prev - 1);
        } else {
          notifySuccess();

          // Simultaneous high-fidelity crossfade:
          countingOpacity.value = withTiming(0, { duration: 350, easing: SMOOTH_EASE });
          setRevealState('revealed');
          revealedOpacity.value = withTiming(1, { duration: 550, easing: SMOOTH_EASE });
        }
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [revealState, countdown]);

  useEffect(() => {
    if (revealState !== 'counting' || listLength === 0) {
      return;
    }

    setCycleIndex(0);

    const cycleInterval = setInterval(() => {
      setCycleIndex(previous => (previous + 1) % listLength);
    }, AVATAR_CYCLE_INTERVAL_MS);

    return () => clearInterval(cycleInterval);
  }, [revealState, listLength]);

  // Handle the delayed morph/expansion of quote & stats card once the user is revealed
  useEffect(() => {
    let expansionTimer: any;
    if (revealState === 'revealed') {
      expansionTimer = setTimeout(() => {
        expansionProgress.value = withSpring(1, {
          damping: 24,
          stiffness: 140,
          mass: 1,
          overshootClamping: false,
        });
      }, 1000);
    }
    return () => clearTimeout(expansionTimer);
  }, [revealState]);

  const handleStartReveal = async () => {
    if (revealState !== 'unrevealed' || isPreparingAvatars) return;

    setIsPreparingAvatars(true);

    // If the user taps immediately after opening the modal, wait for the
    // already-mounted Avatar instances and native URL prefetches to warm up.
    await avatarWarmupPromiseRef.current;

    if (!isOpenRef.current) {
      setIsPreparingAvatars(false);
      return;
    }

    heavyTap();
    setCycleIndex(0);

    // Crossfade instantly and simultaneously on UI thread for a buttery-smooth button transition.
    unrevealedOpacity.value = withTiming(0, { duration: 280, easing: SMOOTH_EASE });
    countingOpacity.value = withTiming(1, { duration: 280, easing: SMOOTH_EASE });

    setRevealState('counting');
    setIsPreparingAvatars(false);
  };

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 320, easing: EXIT_EASE });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 420, easing: EXIT_EASE }, (finished) => {
      if (finished) {
        runOnJS(setVisible)(false);
        runOnJS(onClose)();
      }
    });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, SHEET_SPRING_CONFIG);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedNumberStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numberScale.value }],
    opacity: countingOpacity.value,
  }));

  const unrevealedStepStyle = useAnimatedStyle(() => ({
    opacity: unrevealedOpacity.value,
    transform: [{ scale: interpolate(unrevealedOpacity.value, [0, 1], [0.96, 1]) }],
  }));

  const countingStepStyle = useAnimatedStyle(() => ({
    opacity: countingOpacity.value,
    transform: [{ scale: interpolate(countingOpacity.value, [0, 1], [0.96, 1]) }],
  }));

  const revealedStepStyle = useAnimatedStyle(() => ({
    opacity: revealedOpacity.value,
    transform: [{ scale: interpolate(revealedOpacity.value, [0, 1], [0.96, 1]) }],
  }));

  // Highly smooth morph height, scale, translate, and opacity of the stats + bio deck
  const animatedCollapseStyle = useAnimatedStyle(() => ({
    height: interpolate(expansionProgress.value, [0, 1], [0, 116]),
    opacity: expansionProgress.value,
    transform: [
      { translateY: interpolate(expansionProgress.value, [0, 1], [10, 0]) },
      { scale: interpolate(expansionProgress.value, [0, 1], [0.96, 1]) },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedBackdropStyle]} />
        </TouchableWithoutFeedback>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.cardWrapper, animatedCardStyle]}>
            {/* Native liquid glass material — custom darkened and less opacity parameters */}
            <GlassView 
              preset="specular" 
              alpha={0.04} 
              borderAlpha={0.1} 
              style={[styles.glassCard, { backgroundColor: 'rgba(10, 10, 12, 0.55)' }]} 
              interactive={true}
            >

              <View style={styles.grabberContainer}>
                <View style={styles.grabber} />
              </View>

              <View style={styles.topNavigationRow}>
                <View style={styles.navigationLeftGroup}>
                  {groupName ? <Text weight="bold" style={styles.groupNameText}>{groupName}</Text> : null}
                </View>
              </View>

              <View style={styles.contentBody}>
                <Text style={[styles.titleText, { fontFamily: serifFont }]}>{strings.title}</Text>

                <View style={styles.subtitleCrossfadeDeck}>
                  {revealState === 'unrevealed' && (
                    <Animated.View style={[styles.subtitleContainer, unrevealedStepStyle]}>
                      <Text style={styles.subtitleText}>{strings.subtitleUnrevealed}</Text>
                    </Animated.View>
                  )}
                  {revealState === 'counting' && (
                    <Animated.View style={[styles.subtitleContainer, countingStepStyle]}>
                      <Text style={styles.subtitleText}>{strings.subtitleCounting}</Text>
                    </Animated.View>
                  )}
                  {revealState === 'revealed' && (
                    <Animated.View style={[styles.subtitleContainer, revealedStepStyle]}>
                      <Text style={styles.subtitleText}>{strings.subtitleRevealed}</Text>
                    </Animated.View>
                  )}
                </View>

                <View style={styles.centralOrbitContainer}>
                  <View style={styles.avatarOutlineRing}>

                    {revealState === 'unrevealed' && (
                      <Animated.View style={[StyleSheet.absoluteFill, unrevealedStepStyle, styles.placeholderSilhouetteContainer]}>
                        <View style={styles.silhouetteHead} />
                        <View style={styles.silhouetteShoulders} />
                      </Animated.View>
                    )}

                    {/*
                      Keep every active-group Avatar mounted from the moment the
                      modal opens. Avatar resolves relative storage keys and the
                      native image remains cached; cycling only changes wrapper
                      opacity, so no image request occurs during the countdown.
                    */}
                    <Animated.View
                      style={[
                        StyleSheet.absoluteFill,
                        countingStepStyle,
                        styles.highSpeedCycleContainer,
                      ]}
                      pointerEvents="none"
                    >
                      {listLength > 0 ? (
                        cycleMembers.map((member, index) => (
                          <View
                            key={member.id}
                            style={[
                              styles.cycleAvatarLayer,
                              {
                                opacity: index === cycleIndex ? 1 : 0,
                              },
                            ]}
                            pointerEvents="none"
                          >
                            <Avatar
                              src={member.image}
                              name={member.name}
                              size={176}
                            />
                          </View>
                        ))
                      ) : (
                        <View style={styles.placeholderSilhouetteContainer}>
                          <View style={styles.silhouetteHead} />
                          <View style={styles.silhouetteShoulders} />
                        </View>
                      )}

                      <View style={styles.cycleFaceImageDarkener} />
                    </Animated.View>

                    {revealState === 'revealed' && (
                      <Animated.View style={[StyleSheet.absoluteFill, revealedStepStyle, styles.revealedAvatarContainer]}>
                        <Avatar src={user?.image} name={user?.name} size={176} />
                      </Animated.View>
                    )}

                  </View>

                  {/*
                    Countdown numeral — styled with multi-layered text shadows to simulate
                    high-fidelity, glossy liquid glass material directly on the custom font glyph.
                    Remained mounted through 'revealed' transition so it can fade out smoothly.
                  */}
                  {revealState !== 'unrevealed' && (
                    <Animated.View style={[StyleSheet.absoluteFill, styles.countdownNumberOverlay, animatedNumberStyle]} pointerEvents="none">
                      <LiquidGlassNumber key={countdown} value={countdown} />
                    </Animated.View>
                  )}
                </View>

                {/* 
                  Consistent-dimension Deck container:
                  Guarantees that both instruction footers (unrevealed/counting) and immediately-revealed
                  Vlogger Name & Handle occupy EXACTLY same dimensions before the 1s delay expansion.
                */}
                <View style={styles.infoDeck}>
                  {revealState !== 'revealed' ? (
                    <View style={styles.instructionCentered}>
                      {revealState === 'unrevealed' ? (
                        <Animated.View style={unrevealedStepStyle}>
                          <Text style={styles.indicatorInstructionLabel}>{strings.unrevealedFooter}</Text>
                        </Animated.View>
                      ) : (
                        <Animated.View style={countingStepStyle}>
                          <Text style={styles.indicatorInstructionLabel}>{strings.countingFooter}</Text>
                        </Animated.View>
                      )}
                    </View>
                  ) : (
                    <Animated.View style={[styles.nameHandleCentered, revealedStepStyle]}>
                      <Text style={[styles.vloggerName, { fontFamily: serifFont }]} numberOfLines={1}>
                        {user?.name || "Member"}
                      </Text>
                      <Text weight="medium" style={styles.vloggerHandle}>
                        @{user?.handle || "vlogger"}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* 
                  Perfectly timed collapsible container that expands quote + stats.
                  Zero gap between stats and bottom buttons track is maintained.
                */}
                {revealState === 'revealed' && (
                  <Animated.View style={[styles.collapsibleContainer, animatedCollapseStyle]}>
                    <View style={styles.collapsibleContent}>
                      <Text style={styles.vloggerQuote} numberOfLines={2}>
                        {vloggerQuote}
                      </Text>

                      <View style={styles.statsCardContainer}>
                        <View style={styles.statColumn}>
                          <Text weight="bold" style={styles.statValueText}>{user?.vlogCount ?? 0}</Text>
                          <Text style={styles.statLabelText}>{isTr ? "Vlog" : "Vlogs"}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statColumn}>
                          <Text weight="bold" style={styles.statValueText}>
                            {user?.likeCount ? (user.likeCount >= 1000 ? `${(user.likeCount / 1000).toFixed(1)}K` : user.likeCount) : "0"}
                          </Text>
                          <Text style={styles.statLabelText}>{isTr ? "Beğeni" : "Likes"}</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statColumn}>
                          <Text weight="bold" style={styles.statValueText}>{user?.commentCount ?? 0}</Text>
                          <Text style={styles.statLabelText}>{isTr ? "Yorum" : "Comments"}</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                <View style={styles.buttonsTrack}>
                  {/* Unrevealed Button - Constantly mounted to support a clean, flicker-free crossfade */}
                  <Animated.View 
                    style={[StyleSheet.absoluteFill, unrevealedStepStyle]}
                    pointerEvents={revealState === 'unrevealed' ? 'auto' : 'none'}
                  >
                    <TouchableOpacity
                      onPress={handleStartReveal}
                      activeOpacity={0.85}
                      style={styles.buttonTouchable}
                      disabled={isPreparingAvatars}
                    >
                      <GlassView preset="deep" style={styles.darkGlassButton} interactive={!isPreparingAvatars}>
                        <Text weight="bold" style={styles.darkGlassButtonText}>
                          {isPreparingAvatars
                            ? strings.buttonPreparing
                            : strings.buttonAction}
                        </Text>
                      </GlassView>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Counting Button - Constantly mounted to support a clean, flicker-free crossfade */}
                  <Animated.View 
                    style={[StyleSheet.absoluteFill, countingStepStyle]} 
                    pointerEvents="none"
                  >
                    <GlassView preset="deep" style={styles.darkGlassButton} interactive={false}>
                      <Text weight="bold" style={[styles.darkGlassButtonText, { color: 'rgba(255, 255, 255, 0.4)' }]}>
                        {strings.buttonCounting}
                      </Text>
                    </GlassView>
                  </Animated.View>

                  {/* Watch Button */}
                  {revealState === 'revealed' && (
                    <Animated.View style={[StyleSheet.absoluteFill, revealedStepStyle]}>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={styles.solidWhiteButton}
                        activeOpacity={0.9}
                      >
                        <Text weight="bold" style={styles.solidWhiteButtonText}>{strings.buttonWatch}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>

              </View>
            </GlassView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  cardWrapper: {
    width: '90%',
    maxWidth: 356,
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 12,
  },
  glassCard: {
    width: '100%',
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  topNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
    marginTop: 4,
  },
  navigationLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circularGroupAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 14,
  },
  groupNameText: {
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  contentBody: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitleCrossfadeDeck: {
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  subtitleContainer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontFamily: 'Satoshi-Medium',
  },
  centralOrbitContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  avatarOutlineRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderSilhouetteContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b1b1d',
  },
  silhouetteHead: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#353538',
    marginBottom: 6,
  },
  silhouetteShoulders: {
    width: 104,
    height: 64,
    borderTopLeftRadius: 52,
    borderTopRightRadius: 52,
    backgroundColor: '#353538',
  },
  highSpeedCycleContainer: {
    ...StyleSheet.absoluteFill,
  },
  cycleAvatarLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleFaceImageDarkener: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  revealedAvatarContainer: {
    ...StyleSheet.absoluteFill,
  },
  countdownNumberOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  countdownGlassChip: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  countdownNumberText: {
    fontSize: 90,
    fontFamily: numeralFont,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    includeFontPadding: false,
  },
  infoDeck: {
    width: '100%',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionCentered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameHandleCentered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vloggerName: {
    fontSize: 21,
    color: '#ffffff',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  vloggerHandle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: -0.1,
    marginTop: 2,
    textAlign: 'center',
  },
  collapsibleContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  collapsibleContent: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 12,
  },
  vloggerQuote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
    marginBottom: 12,
    fontFamily: 'Satoshi-Medium',
  },
  statsCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueText: {
    fontSize: 14,
    fontFamily: statFont,
    color: '#ffffff',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  statLabelText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  statDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  indicatorInstructionDeck: {
    height: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  indicatorInstructionLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    fontFamily: 'Satoshi-Medium',
    lineHeight: 16,
  },
  buttonsTrack: {
    width: '100%',
    height: 48,
    position: 'relative',
  },
  buttonTouchable: {
    width: '100%',
    height: 48,
  },
  darkGlassButton: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  darkGlassButtonText: {
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  solidWhiteButton: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  solidWhiteButtonText: {
    fontSize: 13,
    color: '#000000',
    letterSpacing: 0.3,
  },
  glassNumberContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glassNumberBase: {
    fontSize: 120,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});