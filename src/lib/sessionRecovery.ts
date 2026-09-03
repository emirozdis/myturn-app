import analytics from '@react-native-firebase/analytics';
import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import { router } from 'expo-router';
import Purchases from 'react-native-purchases';
import { storage } from './storage';
import { syncWidgetSessionState } from './widgetSync';
import { addDiagnosticBreadcrumb, flushDiagnosticQueue } from './diagnostics';

const PRESERVED_STORAGE_KEYS = new Set([
  'pref_haptic_feedback',
  'pref_analytics_enabled',
  'myturn_lang',
  'active_api_base_url',
]);

function shouldPreserveStorageKey(key: string): boolean {
  return PRESERVED_STORAGE_KEYS.has(key) || key.startsWith('diagnostics_');
}

const PERMANENT_FIREBASE_AUTH_CODES = new Set([
  'auth/id-token-expired',
  'auth/invalid-user-token',
  'auth/requires-recent-login',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/user-token-expired',
]);

let recoveryPromise: Promise<void> | null = null;

function firebaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function isPermanentFirebaseAuthError(error: unknown): boolean {
  const code = firebaseErrorCode(error);
  return code !== null && PERMANENT_FIREBASE_AUTH_CODES.has(code);
}

/**
 * Clears all user-scoped local state and returns to the login screen.
 * Concurrent failing requests share one recovery operation.
 */
export function recoverInvalidSession(clearCaches: () => Promise<void>): Promise<void> {
  if (recoveryPromise) return recoveryPromise;

  recoveryPromise = (async () => {
    addDiagnosticBreadcrumb({
      category: 'auth',
      name: 'invalid_session_recovery',
      outcome: 'started',
      context: { hadUser: Boolean(auth().currentUser) },
    });
    void flushDiagnosticQueue({ forceFinalize: true });
    await Promise.allSettled([
      auth().signOut(),
      Purchases.logOut(),
      analytics().setUserId(''),
      crashlytics().setUserId(''),
      clearCaches(),
    ]);

    for (const key of storage.getAllKeys()) {
      if (!shouldPreserveStorageKey(key)) storage.delete(key);
    }

    syncWidgetSessionState(false, false);
    addDiagnosticBreadcrumb({
      category: 'auth',
      name: 'invalid_session_recovery',
      outcome: 'success',
    });
    router.replace('/');
  })().finally(() => {
    recoveryPromise = null;
  });

  return recoveryPromise;
}
