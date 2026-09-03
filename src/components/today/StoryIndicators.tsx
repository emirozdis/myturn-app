// ./src/components/today/StoryIndicators.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type StoryIndicatorFillProps = {
  state: 'done' | 'active' | 'pending';
  videoProgress: SharedValue<number>;
};

function StoryIndicatorFill({ state, videoProgress }: StoryIndicatorFillProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = state === 'done'
      ? 100
      : state === 'active'
        ? Math.max(0, Math.min(100, videoProgress.value))
        : 0;

    return { width: `${progress}%` };
  }, [state]);

  return <Animated.View style={[styles.fill, animatedStyle]} />;
}

export function StoryIndicators({ clips, currentClipSubIndex, videoProgress }: {
  clips: any[];
  currentClipSubIndex: number;
  videoProgress: SharedValue<number>;
}) {
  if (!clips || clips.length <= 1) return null;

  return (
    <View style={styles.container}>
      {clips.map((c: any, idx: number) => {
        const state = idx < currentClipSubIndex
          ? 'done'
          : idx === currentClipSubIndex
            ? 'active'
            : 'pending';
        
        return (
          <View key={c.id || idx} style={styles.track}>
            <StoryIndicatorFill state={state} videoProgress={videoProgress} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    height: 2,
    zIndex: 40,
  },
  track: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1,
  },
});
