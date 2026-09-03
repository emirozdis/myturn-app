// ./src/components/ui/GlassView.tsx
import React, { Component, ReactNode } from 'react';
import { View, StyleSheet, ViewProps, Platform, LogBox } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';

// Suppress the React Navigation context redbox crash in development.
// This error occurs due to dependency context mismatches between the native library and Expo Router.
// Since we intentionally catch and handle this crash via GlassErrorBoundary, we safely ignore the visual log.
LogBox.ignoreLogs([
  "Couldn't find a navigation context",
  "Have you wrapped your app with 'NavigationContainer'?"
]);

interface GlassViewProps extends ViewProps {
  intensity?: number;
  alpha?: number;
  borderAlpha?: number;
  preset?: 'liquid' | 'frosted' | 'specular' | 'deep';
  glow?: boolean;
  interactive?: boolean;
}

// Robust Error Boundary specifically designed to catch native component crashes
// and seamlessly degrade to our identical cross-platform fallback UI.
class GlassErrorBoundary extends Component<{ fallback: ReactNode, children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.log("[GlassView] Native LiquidGlassView encountered a context error. Safely falling back to Expo Blur.");
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function GlassView({ 
  intensity = 65, 
  alpha = 0.08, 
  borderAlpha = 0.15,
  preset = 'liquid',
  glow = true,
  interactive = false,
  style, 
  children, 
  ...props 
}: GlassViewProps) {
  const flatStyle = StyleSheet.flatten(style) || {};
  const borderRadius = (flatStyle as any).borderRadius ?? 0;

  // Cross-platform fallbacks (Android, older iOS versions, Web, or Error states)
  let gradientColors = ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.07)'];
  let gradientLocations = [0, 0.45, 1];
  let customBlurIntensity = intensity;

  if (preset === 'frosted') {
    gradientColors = ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.04)'];
    gradientLocations = [0, 1];
    customBlurIntensity = 45;
  } else if (preset === 'deep') {
    gradientColors = ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.03)'];
    gradientLocations = [0, 0.5, 1];
    customBlurIntensity = 85;
  } else if (preset === 'specular') {
    gradientColors = ['rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.15)'];
    gradientLocations = [0, 0.3, 1];
    customBlurIntensity = 55;
  }

  const FallbackUI = (
    <View style={[styles.container, style, interactive && { overflow: 'visible' }]} {...props}>
      {/* 1. Deep System Blur fallback - Clipped internally */}
      <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
        <BlurView 
          intensity={customBlurIntensity} 
          tint="dark" 
          style={StyleSheet.absoluteFill} 
        />
      </View>

      {/* 2. Specular Glass Refraction Sheen fallback - Clipped internally */}
      <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
        <LinearGradient
          colors={gradientColors as any}
          locations={gradientLocations as any}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 3. Liquid Inner Specular Light Ring fallback */}
      <View 
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderTopWidth: 1.2,
            borderLeftWidth: 1.2,
            borderRightWidth: 0.8,
            borderBottomWidth: 0.5,
            borderTopColor: `rgba(255, 255, 255, ${borderAlpha * 2.8})`,
            borderLeftColor: `rgba(255, 255, 255, ${borderAlpha * 1.8})`,
            borderRightColor: `rgba(255, 255, 255, ${borderAlpha * 0.5})`,
            borderBottomColor: `rgba(255, 255, 255, ${borderAlpha * 0.2})`,
          }
        ]} 
        pointerEvents="none"
      />

      {/* 4. Sub-specular micro-glistening depth fallback */}
      {glow && (
        <View 
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              shadowColor: '#fff',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 10,
            }
          ]} 
          pointerEvents="none"
        />
      )}

      {children}
    </View>
  );

  // Render Apple's native iOS 26+ Liquid Glass using native UIVisualEffectView/SwiftUI bridges,
  // safely wrapped in our ErrorBoundary to prevent Expo Router context mismatch crashes.
  if (Platform.OS === 'ios' && isLiquidGlassSupported) {
    const nativeEffect = preset === 'specular' || preset === 'liquid' ? 'clear' : 'regular';
    
    return (
      <GlassErrorBoundary fallback={FallbackUI}>
        <LiquidGlassView
          effect={nativeEffect}
          interactive={interactive}
          colorScheme="dark"
          style={[{ overflow: 'visible' }, style]}
          {...props}
        >
          {children}
        </LiquidGlassView>
      </GlassErrorBoundary>
    );
  }

  return FallbackUI;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
});
