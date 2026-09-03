// ./src/lib/appCheck.ts
import {
  FirebaseAppCheckTypes,
  getLimitedUseToken,
  getToken,
  initializeAppCheck,
} from '@react-native-firebase/app-check';
import appCheck from '@react-native-firebase/app-check';
import { fetchWithTimeout, withTimeout } from './network';
import { APP_CHECK_DEBUG_TOKEN } from './environment';

let appCheckPromise: Promise<FirebaseAppCheckTypes.Module> | undefined;

function getAppCheck() {
  if (!appCheckPromise) {
    // RNFirebase v21 does not expose the native provider constructor in its
    // public TypeScript declarations, so provider creation remains namespaced.
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    const debugToken = APP_CHECK_DEBUG_TOKEN;

    provider.configure({
      android: debugToken
        ? { provider: 'debug', debugToken }
        : { provider: 'playIntegrity' },
      apple: debugToken
        ? { provider: 'debug', debugToken }
        : { provider: 'appAttestWithDeviceCheckFallback' },
    });

    appCheckPromise = initializeAppCheck(undefined, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  }

  return appCheckPromise;
}

export async function getAppCheckHeaders(
  forceRefresh = false,
  limitedUse = false,
): Promise<Record<string, string>> {
  const appCheckInstance = await getAppCheck();
  const acquireToken = () => limitedUse
    ? getLimitedUseToken(appCheckInstance)
    : getToken(appCheckInstance, forceRefresh);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await withTimeout(
        acquireToken(),
        4_000,
        'App Check token acquisition timed out',
      );
      if (result?.token) {
        return {
          'X-Firebase-AppCheck': result.token,
          ...(limitedUse ? { 'X-MyTurn-AppCheck-Limited-Use': '1' } : {}),
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  console.error(
    `[AppCheck] Token acquisition failed (provider: ${
      APP_CHECK_DEBUG_TOKEN ? 'debug' : 'platform attestation'
    }, debug token configured: ${Boolean(APP_CHECK_DEBUG_TOKEN)}).`,
    lastError,
  );
  throw lastError instanceof Error
    ? lastError
    : new Error('App Check did not return a token.');
}

export async function appCheckFetch(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
) {
  const headers = new Headers(init.headers);
  const appCheckHeaders = await getAppCheckHeaders();
  Object.entries(appCheckHeaders).forEach(([key, value]) => headers.set(key, value));
  return fetchWithTimeout(input, { ...init, headers });
}

// Changelog:
// - Updated getAppCheckHeaders to support forceRefresh boolean parameter to synchronize cache resets correctly.
