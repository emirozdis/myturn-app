// ./src/lib/haptics.ts
// Centralized haptic feedback utility.
// All haptic triggers go through this module, which respects the user's
// "Titreşimli Geri Bildirim" preference stored in MMKV.

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { storage } from './storage';

const HAPTIC_PREF_KEY = 'pref_haptic_feedback';

// ─── Preference helpers ──────────────────────────────────────────────────────

/** Read persisted haptic preference (default: enabled) */
export function isHapticEnabled(): boolean {
  const raw = storage.getString(HAPTIC_PREF_KEY);
  // If never set, default to true
  if (raw === undefined || raw === null) return true;
  return raw === 'true';
}

/** Persist haptic preference */
export function setHapticEnabled(enabled: boolean): void {
  storage.set(HAPTIC_PREF_KEY, String(enabled));
}

// ─── Guard ───────────────────────────────────────────────────────────────────

function shouldFire(): boolean {
  // Haptics are iOS/Android only — skip silently on web
  if (Platform.OS === 'web') return false;
  return isHapticEnabled();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Light tap — e.g. tab switches, selection changes, toggle taps */
export function lightTap(): void {
  if (!shouldFire()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — e.g. button presses, camera shutter, navigation actions */
export function mediumTap(): void {
  if (!shouldFire()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy tap — e.g. recording start/stop, important confirmations */
export function heavyTap(): void {
  if (!shouldFire()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Selection tick — e.g. scrolling through picker items, zoom levels */
export function selectionTick(): void {
  if (!shouldFire()) return;
  Haptics.selectionAsync();
}

/** Success notification — e.g. upload complete, achievement unlocked, group created */
export function notifySuccess(): void {
  if (!shouldFire()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning notification — e.g. approaching limits, permission prompts */
export function notifyWarning(): void {
  if (!shouldFire()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error notification — e.g. failed upload, validation errors */
export function notifyError(): void {
  if (!shouldFire()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
