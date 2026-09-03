import React, { useState, useEffect, useRef } from "react";
import { View, Image, StyleSheet, TouchableOpacity, Dimensions, Modal } from "react-native";
import { X, Camera } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "../ui/Avatar";
import { GlassView } from "../ui/GlassView";
import { Text } from "../ui/Text";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  SharedValue
} from "react-native-reanimated";
import { apiClient } from "../../lib/apiClient";
import { LiveGuideCoachmark } from "../guides/LiveGuideCoachmark";
import type { GuideStep, GuideMotion } from "../guides/guideContent";

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CARD_WIDTH = width * 0.82;
const GAP = 16;
const STAGE_WIDTH = CARD_WIDTH + GAP;

type PhotoResponse = {
  id: string;
  imageUrl: string;
  mediaType?: string;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type LiveGuideControls = {
  visible: boolean;
  step?: GuideStep;
  stepIndex: number;
  totalSteps: number;
  stepComplete: boolean;
  completeAction: (motion: GuideMotion) => boolean;
  skipStep: () => void;
  skipTour: () => void;
  goBack: () => void;
};

function resolveResponseUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `${apiClient.getBaseUrl()}${value}`;
  return `${apiClient.getBaseUrl()}/api/media/vlogs/${value}`;
}

function PhotoResponseCard({
  res,
  index,
  scrollX,
  translateY
}: {
  res: PhotoResponse;
  index: number;
  scrollX: SharedValue<number>;
  translateY: SharedValue<number>;
}) {
  // NOTE: hooks below must run unconditionally, so we compute this first
  // but only guard the *render* on it, not the hook calls.
  const resolvedUrl = resolveResponseUrl(res.imageUrl);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const offset = scrollX.value + index * STAGE_WIDTH;
    const absOffset = Math.abs(offset);

    const scale = interpolate(absOffset, [0, STAGE_WIDTH], [1, 0.82], Extrapolation.CLAMP);
    const opacity = interpolate(absOffset, [0, STAGE_WIDTH], [1, 0.35], Extrapolation.CLAMP);
    const rotate = interpolate(offset, [-STAGE_WIDTH, 0, STAGE_WIDTH], [-4, 0, 4], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: offset },
        { translateY: translateY.value },
        { scale },
        { rotate: `${rotate}deg` }
      ],
      opacity,
    };
  });

  const badgeAnimatedStyle = useAnimatedStyle(() => {
    const offset = scrollX.value + index * STAGE_WIDTH;
    const absOffset = Math.abs(offset);
    const opacity = interpolate(absOffset, [0, STAGE_WIDTH * 0.22], [1, 0], Extrapolation.CLAMP);
    const translateYOffset = interpolate(absOffset, [0, STAGE_WIDTH * 0.22], [0, 12], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateY: translateYOffset }],
    };
  });

  // Guard here, after all hooks have been called, so hook order stays
  // consistent across renders even when a response has no usable image.
  if (!resolvedUrl) return null;

  return (
    <Animated.View style={[styles.cardContainer, cardAnimatedStyle]}>
      <View style={styles.slideImageWrapper}>
        <Image source={{ uri: resolvedUrl }} style={styles.fullImage} />

        <LinearGradient colors={['transparent', 'rgba(0, 0, 0, 0.72)']} style={styles.cardBottomVignette} />

        <Animated.View style={[styles.authorBadgeWrapper, badgeAnimatedStyle]}>
          <GlassView style={styles.authorBadge} preset="frosted" interactive={true}>
            <Avatar src={res.user?.image} name={res.user?.name} size={36} />
            <View>
              <Text weight="bold" style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2.5 }} className="text-sm leading-none mb-0.5">{res.user?.name}</Text>
              <Text weight="medium" style={{ color: 'rgba(255,255,255,0.7)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2.5 }} className="text-[10px]">Fotoğraf Yanıtı</Text>
            </View>
          </GlassView>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function PhotoResponsesOverlay({
  responses = [],
  externalExpandedIndex = null,
  onExternalClose,
  onResponseSwipe,
  onResponseDismiss,
  liveGuide,
  hasResponded = false,
  onRespondClick
}: {
  responses?: PhotoResponse[];
  videoProgress?: SharedValue<number>;
  externalExpandedIndex?: number | null;
  onExternalClose?: () => void;
  onResponseSwipe?: () => void;
  onResponseDismiss?: () => void;
  liveGuide?: LiveGuideControls | null;
  hasResponded?: boolean;
  onRespondClick?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const photoResponses = responses.filter((response) => !response.mediaType || response.mediaType === 'photo');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [localExpandedIndex, setLocalExpandedIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScrollX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  const isDraggingVertical = useSharedValue(false);
  const isDraggingHorizontal = useSharedValue(false);
  const modalProgress = useSharedValue(0);
  const dismissalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportResponseSwipe = () => onResponseSwipe?.();
  const closeResponses = () => {
    if (expandedIndex === null) return;
    setExpandedIndex(null);
    onResponseDismiss?.();
  };

  useEffect(() => {
    if (externalExpandedIndex !== null && photoResponses.length > 0) {
      setExpandedIndex(Math.min(externalExpandedIndex, photoResponses.length - 1));
    }
    else setExpandedIndex(null);
  }, [externalExpandedIndex, photoResponses.length]);

  useEffect(() => {
    if (expandedIndex === null && onExternalClose) onExternalClose();
  }, [expandedIndex]);

  useEffect(() => {
    if (dismissalTimerRef.current) {
      clearTimeout(dismissalTimerRef.current);
      dismissalTimerRef.current = null;
    }

    if (expandedIndex !== null) {
      if (localExpandedIndex === null) {
        scrollX.value = -expandedIndex * STAGE_WIDTH;
      }
      translateY.value = 0;
      modalProgress.value = withSpring(1, { damping: 24, stiffness: 140, mass: 0.85 });
      setLocalExpandedIndex(expandedIndex);
      setActiveIndex(expandedIndex);
    } else {
      modalProgress.value = withTiming(0, { duration: 220 });
      if (localExpandedIndex !== null) {
        // Keep React state transitions on the JS thread. Passing a React state
        // setter through runOnJS crashes react-native-worklets 0.10 during
        // native Modal teardown (JSI Value::getObject assertion).
        dismissalTimerRef.current = setTimeout(() => {
          setLocalExpandedIndex(null);
          dismissalTimerRef.current = null;
        }, 240);
      }
    }
  }, [expandedIndex]);

  useEffect(() => () => {
    if (dismissalTimerRef.current) clearTimeout(dismissalTimerRef.current);
  }, []);

  const modalPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      startScrollX.value = scrollX.value;
      startTranslateY.value = translateY.value;
      isDraggingVertical.value = false;
      isDraggingHorizontal.value = false;
    })
    .onUpdate((e) => {
      if (!isDraggingVertical.value && !isDraggingHorizontal.value) {
        if (Math.abs(e.translationY) > Math.abs(e.translationX) * 1.4) isDraggingVertical.value = true;
        else isDraggingHorizontal.value = true;
      }

      if (isDraggingHorizontal.value) {
        let nextScroll = startScrollX.value + e.translationX;
        const maxScroll = 0;
        const minScroll = -(photoResponses.length - 1) * STAGE_WIDTH;
        if (nextScroll > maxScroll) nextScroll = maxScroll + (nextScroll - maxScroll) * 0.35;
        else if (nextScroll < minScroll) nextScroll = minScroll + (nextScroll - minScroll) * 0.35;
        scrollX.value = nextScroll;
      } else if (isDraggingVertical.value) {
        if (e.translationY > 0) translateY.value = e.translationY;
        else translateY.value = e.translationY * 0.15;
      }
    })
    .onEnd((e) => {
      if (isDraggingHorizontal.value) {
        const rawIndex = -scrollX.value / STAGE_WIDTH;
        let targetIndex = Math.round(rawIndex);
        if (e.velocityX > 450) targetIndex = Math.floor(rawIndex);
        else if (e.velocityX < -450) targetIndex = Math.ceil(rawIndex);
        targetIndex = Math.max(0, Math.min(photoResponses.length - 1, targetIndex));
        scrollX.value = withSpring(-targetIndex * STAGE_WIDTH, { damping: 24, stiffness: 150, mass: 0.8 });
        setExpandedIndex(targetIndex);
        setActiveIndex(targetIndex);
        reportResponseSwipe();
      } else if (isDraggingVertical.value) {
        if (e.translationY > 120 || e.velocityY > 500) {
          translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 });
          closeResponses();
        } else {
          translateY.value = withSpring(0, { damping: 24, stiffness: 150, mass: 0.8 });
        }
      }
      isDraggingVertical.value = false;
      isDraggingHorizontal.value = false;
    });

  const tapOutsideGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const cardHeight = CARD_WIDTH * 1.333;
      const startX = (width - CARD_WIDTH) / 2;
      const startY = (SCREEN_HEIGHT - cardHeight) / 2;
      if (e.x < startX || e.x > startX + CARD_WIDTH || e.y < startY || e.y > startY + cardHeight) {
        closeResponses();
      }
    });

  const composedModalGesture = Gesture.Simultaneous(modalPanGesture, tapOutsideGesture);

  const animatedModalBgStyle = useAnimatedStyle(() => ({ opacity: modalProgress.value }));
  const animatedSliderStyle = useAnimatedStyle(() => {
    const translateYOffset = interpolate(modalProgress.value, [0, 1], [SCREEN_HEIGHT * 0.72, 0]);
    const scale = interpolate(modalProgress.value, [0, 1], [0.36, 1]);
    const rotate = interpolate(modalProgress.value, [0, 1], [14, 0]);
    return { transform: [{ translateY: translateYOffset }, { scale }, { rotate: `${rotate}deg` }] };
  });

  const animatedBottomHUDStyle = useAnimatedStyle(() => {
    const translateYOffset = interpolate(modalProgress.value, [0, 1], [40, 0]);
    const opacity = interpolate(modalProgress.value, [0, 0.5, 1], [0, 0, 1]);
    return { opacity, transform: [{ translateY: translateYOffset }] };
  });

  if (photoResponses.length === 0) return null;

  return (
    <Modal
      visible={localExpandedIndex !== null}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeResponses}
    >
      {/* React Native's Modal renders into a separate native root, which is
          NOT a descendant of the app's top-level GestureHandlerRootView.
          Any GestureDetector inside a Modal needs its own root here, or
          gestures silently fail in dev and hard-crash in release builds. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[styles.modalBg, animatedModalBgStyle]}>

          <GestureDetector gesture={composedModalGesture}>
            <Animated.View style={[styles.modalSliderContainer, animatedSliderStyle]}>
              {photoResponses.map((res, i) => (
                <PhotoResponseCard
                  key={res.id}
                  res={res}
                  index={i}
                  scrollX={scrollX}
                  translateY={translateY}
                />
              ))}
            </Animated.View>
          </GestureDetector>

          <Animated.View style={[styles.bottomHUD, { paddingBottom: Math.max(insets.bottom, 24) }, animatedBottomHUDStyle]}>
            {photoResponses.length > 1 && (
              <View style={styles.bottomDotsContainer}>
                {photoResponses.map((_, idx) => (
                  <View key={idx} style={[styles.bottomDot, idx === activeIndex && styles.bottomDotActive]} />
                ))}
              </View>
            )}

            <View style={styles.actionRow}>
              {!hasResponded && onRespondClick && (
                <TouchableOpacity
                  onPress={() => { closeResponses(); onRespondClick(); }}
                  activeOpacity={0.85}
                  style={[styles.hudButton, styles.respondButtonSolid]}
                >
                  <Camera size={13} color="#000" fill="#000" style={{ marginRight: 6 }} />
                  <Text weight="bold" style={{ color: '#000', fontSize: 13 }} className="font-black">Sende Ekle</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={closeResponses}
                activeOpacity={0.85}
                style={[styles.hudButton, styles.closeButtonSolid, hasResponded && { flex: 0, width: width * 0.45 }]}
              >
                <X size={12} color="#fff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text weight="bold" style={{ color: '#fff', fontSize: 13 }} className="font-black">Kapat</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {liveGuide && (
            <LiveGuideCoachmark
              visible={liveGuide.visible}
              step={liveGuide.step}
              stepIndex={liveGuide.stepIndex}
              totalSteps={liveGuide.totalSteps}
              stepComplete={liveGuide.stepComplete}
              onBack={liveGuide.goBack}
              onSkipStep={liveGuide.skipStep}
              onClose={liveGuide.skipTour}
              placement="top"
              topOffset={18}
            />
          )}

        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.96)" },
  modalSliderContainer: { flex: 1, alignItems: "center", justifyContent: "center", zIndex: 10 },
  cardContainer: { width: CARD_WIDTH, height: CARD_WIDTH * 1.333, position: 'absolute', alignSelf: 'center' },
  slideImageWrapper: { width: "100%", height: "100%", borderRadius: 24, overflow: "hidden", position: "relative", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 18 },
  fullImage: { width: "100%", height: "100%" },
  cardBottomVignette: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 5 },
  authorBadge: { borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: 'rgba(0, 0, 0, 0.58)', borderWidth: 1.2, borderColor: "rgba(255,255,255,0.15)" },
  authorBadgeWrapper: { position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 30 },
  bottomHUD: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 14, zIndex: 50 },
  bottomDotsContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottomDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  bottomDotActive: { backgroundColor: 'rgba(255, 255, 255, 0.8)', width: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingHorizontal: 24, marginTop: 8 },
  hudButton: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  respondButtonSolid: { flex: 1.7, backgroundColor: '#fff' },
  closeButtonSolid: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1.2, borderColor: 'rgba(255, 255, 255, 0.15)' },
});