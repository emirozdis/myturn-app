// ./src/components/today/TimelineTracker.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from '../ui/Text';
import { TIMELINE_POINTS } from '../../lib/theme';
import { selectionTick } from '../../lib/haptics';

interface TimelineTrackerProps {
  currentHourIndex: number;
  actualHourIndex: number;
  onHourChange: (index: number) => void;
  uploadedSlots?: number[];
}

export function TimelineTracker({
  currentHourIndex,
  actualHourIndex,
  onHourChange,
  uploadedSlots = [],
}: TimelineTrackerProps) {
  const targetProgress = Math.max(0, Math.min(1, currentHourIndex / (TIMELINE_POINTS.length - 1)));
  const progress = useSharedValue(targetProgress);
  const [trackWidth, setTrackWidth] = React.useState(0);

  React.useEffect(() => {
    progress.value = withTiming(targetProgress, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, targetProgress]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: trackWidth * progress.value,
  }));

  return (
    <View style={styles.container}>
      <View
        style={styles.trackBg}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.trackFill, animatedProgressStyle]} />
      </View>
      <View style={styles.pointsOverlay}>
        {TIMELINE_POINTS.map((pt) => {
          const isCurrent = pt.key === currentHourIndex;
          const isDone = pt.key < currentHourIndex;
          const hasUpload = uploadedSlots.includes(pt.key);
          const isFuture = pt.key > actualHourIndex;

          let dotStyle: any = styles.dotEmpty;
          if (isCurrent) dotStyle = styles.dotCurrent;
          else if (hasUpload) dotStyle = styles.dotUpload;
          else if (isDone) dotStyle = styles.dotDone;

          return (
            <TouchableOpacity
              key={pt.key}
              activeOpacity={0.7}
              onPress={() => { if (!isFuture) { selectionTick(); onHourChange(pt.key); } }}
              disabled={isFuture}
              style={[styles.hitbox, isFuture && { opacity: 0.4 }]}
            >
              <View style={[styles.dot, dotStyle]} />
              <Text weight="bold" style={[styles.label, isCurrent && { color: '#fff' }]}>{pt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 36 },
  // The first and last touch targets are 40px wide, so their dot centers are
  // exactly 20px from either edge. Keep both tracks on those same centers.
  trackBg: { position: 'absolute', top: 3, left: 20, right: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 },
  trackFill: { height: '100%', backgroundColor: '#fff', borderRadius: 1 },
  pointsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hitbox: { alignItems: 'center', width: 40, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotEmpty: { backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.6)' },
  dotUpload: { backgroundColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6 },
  dotCurrent: { backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(0,0,0,0.8)', transform: [{ scale: 1.4 }] },
  label: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});
