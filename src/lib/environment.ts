import { Platform } from 'react-native';

export type AppEnvironment = 'development' | 'preview' | 'production';
export type AppBuildProfile = 'development' | 'preview' | 'production';

function readAppEnvironment(): AppEnvironment {
  const value = process.env.EXPO_PUBLIC_APP_ENV;
  if (value === 'development' || value === 'preview' || value === 'production') {
    return value;
  }

  throw new Error(
    'EXPO_PUBLIC_APP_ENV must be set to development, preview, or production.',
  );
}

function readApiBaseUrl(appEnvironment: AppEnvironment): string {
  const rawValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!rawValue) {
    throw new Error('EXPO_PUBLIC_API_URL is required.');
  }

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute URL.');
  }

  if (appEnvironment !== 'development' && url.protocol !== 'https:') {
    throw new Error('Preview and production API URLs must use HTTPS.');
  }

  if (
    appEnvironment === 'development' &&
    Platform.OS === 'android' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    // Android emulators run in their own virtual network. 10.0.2.2 is the
    // emulator's special alias for the development machine's loopback.
    url.hostname = '10.0.2.2';
  }

  const normalizedUrl = url.origin;
  if (
    appEnvironment === 'production' &&
    normalizedUrl !== 'https://myturn.emirozdis.tr'
  ) {
    throw new Error(
      'Production builds must use https://myturn.emirozdis.tr as the API URL.',
    );
  }

  return normalizedUrl;
}

function readBuildProfile(): AppBuildProfile {
  const value = process.env.EXPO_PUBLIC_BUILD_PROFILE;
  if (value === 'development' || value === 'preview' || value === 'production') {
    return value;
  }
  return readAppEnvironment();
}

export const APP_ENVIRONMENT = readAppEnvironment();
export const APP_BUILD_PROFILE = readBuildProfile();
export const IS_DEVELOPMENT = APP_ENVIRONMENT === 'development';
export const IS_PRODUCTION = APP_ENVIRONMENT === 'production';
export const IS_PREVIEW = APP_BUILD_PROFILE === 'preview';
export const API_BASE_URL = readApiBaseUrl(APP_ENVIRONMENT);

const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();

export const APP_CHECK_DEBUG_TOKEN =
  (!IS_PRODUCTION || IS_PREVIEW)
    ? process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim() || undefined
    : undefined;

if (
  IS_PRODUCTION &&
  !IS_PREVIEW &&
  process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim()
) {
  throw new Error(
    'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN must not be set in production.',
  );
}

export function getRevenueCatApiKey(): string {
  const apiKey = Platform.select({
    ios: REVENUECAT_IOS_API_KEY,
    android: REVENUECAT_ANDROID_API_KEY,
  });

  if (!apiKey) {
    throw new Error(`RevenueCat is not configured for ${Platform.OS}.`);
  }

  if (IS_PRODUCTION && apiKey.startsWith('test_')) {
    throw new Error('A RevenueCat test key cannot be used in production.');
  }

  return apiKey;
}
