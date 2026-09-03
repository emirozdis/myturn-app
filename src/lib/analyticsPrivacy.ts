import analytics from '@react-native-firebase/analytics';

import { storage } from './storage';

export const ANALYTICS_ENABLED_KEY = 'pref_analytics_enabled';

export function isAnalyticsEnabled(): boolean {
  return storage.getBoolean(ANALYTICS_ENABLED_KEY) ?? false;
}

export async function applyAnalyticsPreference(): Promise<boolean> {
  const enabled = isAnalyticsEnabled();
  await analytics().setAnalyticsCollectionEnabled(enabled);
  await analytics().setUserId(
    enabled ? storage.getString('auth_user_id') ?? null : null,
  );
  return enabled;
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  await analytics().setAnalyticsCollectionEnabled(enabled);
  await analytics().setUserId(
    enabled ? storage.getString('auth_user_id') ?? null : null,
  );

  if (!enabled) {
    try {
      await analytics().resetAnalyticsData();
    } catch (error) {
      console.warn('[Analytics] Collection disabled but local reset failed', error);
    }
  }

  storage.set(ANALYTICS_ENABLED_KEY, enabled);
}
