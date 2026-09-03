import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAppCheckHeaders } from './appCheck';
import { API_BASE_URL, APP_ENVIRONMENT } from './environment';
import { fetchWithTimeout, withTimeout } from './network';
import { storage } from './storage';

export type AppVersionRequirement = {
  minimumVersion: string;
  minimumBuildNumber: number;
  updateUrl: string;
  updatedAt: string;
};

export type AppVersionCheck = {
  updateRequired: boolean;
  requirement: AppVersionRequirement;
};

export type AppVersionCheckResult =
  | ({ success: true } & AppVersionCheck)
  | { success: false; code: string; error: string; status?: number };

const VERSION_CHECK_CACHE_PREFIX = 'app_version_check_v2';
export const VERSION_CHECK_CACHE_TTL_MS = 60 * 60 * 1000;

function currentBuildNumber(): number | null {
  const raw = Constants.nativeBuildVersion ?? (
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode
  );
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

export function currentAppVersionContext() {
  return {
    platform: Platform.OS,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0',
    buildNumber: currentBuildNumber(),
    releaseChannel: APP_ENVIRONMENT,
  };
}

function cacheKey(context: ReturnType<typeof currentAppVersionContext>) {
  return [
    VERSION_CHECK_CACHE_PREFIX,
    context.platform,
    context.releaseChannel,
    context.appVersion,
    context.buildNumber ?? 'unknown',
  ].join(':');
}

function readCachedCheck(
  context: ReturnType<typeof currentAppVersionContext>,
): AppVersionCheckResult | null {
  try {
    const raw = storage.getString(cacheKey(context));
    if (!raw) return null;
    const cached = JSON.parse(raw) as {
      checkedAt?: number;
      result?: AppVersionCheckResult;
    };
    if (
      typeof cached.checkedAt !== 'number'
      || Date.now() - cached.checkedAt >= VERSION_CHECK_CACHE_TTL_MS
      || !cached.result?.success
    ) {
      storage.delete(cacheKey(context));
      return null;
    }
    return cached.result;
  } catch {
    storage.delete(cacheKey(context));
    return null;
  }
}

function cacheSuccessfulCheck(
  context: ReturnType<typeof currentAppVersionContext>,
  result: AppVersionCheckResult,
) {
  if (!result.success) return;
  storage.set(cacheKey(context), JSON.stringify({
    checkedAt: Date.now(),
    result,
  }));
}

async function requestVersionCheck(
  context: ReturnType<typeof currentAppVersionContext>,
  forceAppCheckRefresh = false,
): Promise<Response> {
  const appCheckHeaders = await withTimeout(
    getAppCheckHeaders(forceAppCheckRefresh, false),
    9_000,
    'Version security check timed out.',
  );
  const headers = new Headers(appCheckHeaders);
  headers.set('Accept', 'application/json');
  headers.set('X-MyTurn-Locale', storage.getString('myturn_lang') === 'en' ? 'en' : 'tr');
  const params = new URLSearchParams({
    platform: context.platform,
    appVersion: context.appVersion,
    buildNumber: String(context.buildNumber),
    releaseChannel: context.releaseChannel,
  });
  return fetchWithTimeout(
    `${API_BASE_URL}/api/app/version?${params.toString()}`,
    { method: 'GET', headers },
    10_000,
    { handled: true },
  );
}

export async function checkAppVersion(
  options: { forceRefresh?: boolean } = {},
): Promise<AppVersionCheckResult> {
  const context = currentAppVersionContext();
  if (
    (context.platform !== 'ios' && context.platform !== 'android')
    || context.buildNumber === null
  ) {
    return {
      success: false,
      code: 'INVALID_APP_VERSION',
      error: 'Native app version information is unavailable.',
    };
  }

  if (!options.forceRefresh) {
    const cached = readCachedCheck(context);
    if (cached) return cached;
  }

  try {
    let response = await requestVersionCheck(context);
    if (response.status === 401) {
      response = await requestVersionCheck(context, true);
    }
    const body = await response.json() as Partial<AppVersionCheck> & {
      code?: string;
      error?: string;
    };
    if (
      !response.ok
      || typeof body.updateRequired !== 'boolean'
      || !body.requirement
    ) {
      return {
        success: false,
        code: body.code || 'VERSION_CHECK_FAILED',
        error: body.error || 'The app version could not be verified.',
        status: response.status,
      };
    }
    const result: AppVersionCheckResult = {
      success: true,
      updateRequired: body.updateRequired,
      requirement: body.requirement,
    };
    cacheSuccessfulCheck(context, result);
    return result;
  } catch (error) {
    return {
      success: false,
      code: 'VERSION_CHECK_FAILED',
      error: error instanceof Error ? error.message : 'The app version could not be verified.',
    };
  }
}
