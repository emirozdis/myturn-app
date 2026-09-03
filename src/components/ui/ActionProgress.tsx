import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { ACCENT } from '../../lib/theme';

type ActionProgressProps = {
  label?: string;
  color?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Compact, non-blocking feedback for an action that is actively progressing. */
export function ActionProgress({
  label = 'İşleniyor',
  color = ACCENT,
  compact = false,
  style,
}: ActionProgressProps) {
  return (
    <View
      style={[styles.row, compact && styles.compactRow, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size="small" color={color} style={compact && styles.compactSpinner} />
      {!!label && <Text weight="bold" style={[styles.label, { color }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  compactRow: { gap: 5 },
  compactSpinner: { transform: [{ scale: 0.78 }] },
  label: { fontSize: 11, letterSpacing: 0.15 },
});
