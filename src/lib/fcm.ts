// src/lib/fcm.ts
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from './apiClient';
import { storage } from './storage';
import { waitForAuthInitialization } from './authState';

export const PUSH_NOTIFICATIONS_ENABLED_KEY = 'push_notifications_enabled';

const pushStateListeners = new Set<() => void>();

function setPushNotificationsEnabled(enabled: boolean) {
  storage.set(PUSH_NOTIFICATIONS_ENABLED_KEY, enabled);
  pushStateListeners.forEach((listener) => listener());
}

export function subscribeToPushNotificationStateChanges(listener: () => void) {
  pushStateListeners.add(listener);
  return () => {
    pushStateListeners.delete(listener);
  };
}

async function registerTokenWithBackend(token: string) {
  const locale = storage.getString('myturn_lang') === 'en' ? 'en' : 'tr';
  return apiClient.request<any>('push/register', [token, locale]);
}

export async function syncFCMTokenIfEnabled() {
  const user = await waitForAuthInitialization();
  if (!storage.getBoolean(PUSH_NOTIFICATIONS_ENABLED_KEY) || !user) {
    return false;
  }
  try {
    const token = await messaging().getToken();
    const result = await registerTokenWithBackend(token);
    if (!result.success) {
      console.warn('[FCM] Existing token could not be synchronized:', result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[FCM] Existing token synchronization failed:', error);
    return false;
  }
}

export function subscribeToFCMTokenRefresh() {
  return messaging().onTokenRefresh(async (token) => {
    const user = await waitForAuthInitialization();
    if (!storage.getBoolean(PUSH_NOTIFICATIONS_ENABLED_KEY) || !user) {
      return;
    }
    try {
      const result = await registerTokenWithBackend(token);
      if (!result.success) {
        console.warn('[FCM] Refreshed token could not be registered:', result.error);
      }
    } catch (error) {
      console.warn('[FCM] Refreshed token registration failed:', error);
    }
  });
}

/**
 * Enables and registers push only when notification access was already granted
 * by the operating system. This deliberately never opens a permission prompt.
 */
export async function enablePushNotificationsIfPermitted() {
  try {
    const authStatus = await messaging().hasPermission();
    const permitted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!permitted) return false;

    return requestFCMPermissionAndRegister();
  } catch (error) {
    console.warn('[FCM] Could not enable already-permitted notifications:', error);
    return false;
  }
}

/**
 * Requests notification permissions from the OS and maps the returned 
 * Firebase Cloud Messaging token to your Next.js backend.
 */
export async function requestFCMPermissionAndRegister() {
  try {
    // messaging().requestPermission() only presents the native prompt on iOS.
    // Expo's permission API also requests POST_NOTIFICATIONS on Android 13+.
    const permission = await Notifications.requestPermissionsAsync();
    const enabled =
      permission.granted ||
      permission.status === Notifications.PermissionStatus.GRANTED ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;

    if (!enabled) {
      setPushNotificationsEnabled(false);
      console.log('[FCM] Push permission not granted by user.');
      return false;
    }

    if (Platform.OS === 'ios') {
      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }
      
      const apnsToken = await messaging().getAPNSToken();
      if (!apnsToken) {
        setPushNotificationsEnabled(false);
        console.warn('[FCM] APNS token is null. Skipping push registration for this iOS runtime.');

        try {
          const staleToken = await messaging().getToken();
          if (staleToken) {
            await apiClient.request<any>('push/unregister', [staleToken]);
          }
          await messaging().deleteToken();
        } catch (cleanupError) {
          console.warn('[FCM] Could not clean up unusable iOS token:', cleanupError);
        }

        return false;
      }
    }

    const token = await messaging().getToken();

    const res = await registerTokenWithBackend(token);
    
    if (!res.success) {
      setPushNotificationsEnabled(false);
      console.error('[FCM] Failed to register token with backend:', res.error);
      return false;
    }

    setPushNotificationsEnabled(true);
    return true;
  } catch (error) {
    setPushNotificationsEnabled(false);
    console.error('[FCM] Registration failed:', error);
    return false;
  }
}

/**
 * Removes the FCM token from your backend and purges it locally from Firebase.
 */
export async function unregisterFCMToken() {
  try {
    const token = await messaging().getToken();
    await apiClient.request<any>('push/unregister', [token]);
    await messaging().deleteToken();
    setPushNotificationsEnabled(false);
    console.log('[FCM] Token deleted and unregistered successfully.');
  } catch (error) {
    setPushNotificationsEnabled(false);
    console.error('[FCM] Unregister failed:', error);
  }
}

// Changelog:
// - Substituted synchronous authentication queries with promise-based initialization checkpoints on device push bindings.
