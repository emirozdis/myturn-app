// ./src/components/achievements/ParticleEffect.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { ACCENT } from '../../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Particle {
  id: number;
  startX: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  rotateDeg: number;
}

const CONFETTI_COLORS = [ACCENT, '#ffcc00', '#30D158', '#0A84FF', '#ffffff'];
const SPARKS_COLORS = [ACCENT, '#ffb880', '#ffffff'];

export function ParticleEffect({ type }: { type: 'confetti' | 'sparks' | 'none' }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (type === 'none') {
      setParticles([]);
      return;
    }

    const isConfetti = type === 'confetti';
    const colors = isConfetti ? CONFETTI_COLORS : SPARKS_COLORS;
    const count = isConfetti ? 45 : 30;

    const items = Array.from({ length: count }).map((_, i) => ({
      id: i,
      startX: Math.random() * SCREEN_WIDTH,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * (isConfetti ? 8 : 4) + 4,
      delay: Math.random() * 600,
      duration: Math.random() * 1500 + 2000,
      rotateDeg: Math.random() * 360,
    }));

    setParticles(items);
  }, [type]);

  if (type === 'none') return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <FallingParticle key={p.id} particle={p} type={type} />
      ))}
    </View>
  );
}

function FallingParticle({ particle, type }: { particle: Particle; type: 'confetti' | 'sparks' }) {
  const y = useSharedValue(-50);
  const drift = useSharedValue(particle.startX);
  const rot = useSharedValue(0);

  useEffect(() => {
    y.value = -50;
    drift.value = particle.startX;
    rot.value = 0;

    y.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(SCREEN_HEIGHT + 50, {
          duration: particle.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    drift.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(particle.startX + (Math.random() * 120 - 60), {
          duration: particle.duration,
          easing: Easing.ease,
        }),
        -1,
        true
      )
    );

    rot.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(particle.rotateDeg + 360, {
          duration: particle.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(y);
      cancelAnimation(drift);
      cancelAnimation(rot);
    };
  }, [particle]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: drift.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        {
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
          borderRadius: type === 'sparks' ? particle.size / 2 : 2,
          shadowColor: particle.color,
          shadowOpacity: type === 'sparks' ? 0.6 : 0,
          shadowRadius: type === 'sparks' ? 4 : 0,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});