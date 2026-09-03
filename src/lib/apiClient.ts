// ./src/lib/apiClient.ts
import { Platform } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { storage } from './storage';
import { invalidateMediaCache } from './MediaCache/cacheStore';
import { clearPendingDownloads } from './MediaCache/chunkDownloader';
import { getAppCheckHeaders } from './appCheck';
import { fetchWithTimeout, withTimeout } from './network';
import { API_BASE_URL, IS_DEVELOPMENT } from './environment';
import { waitForAuthInitialization } from './authState';
import {
  isPermanentFirebaseAuthError,
  recoverInvalidSession,
} from './sessionRecovery';
import {
  addDiagnosticBreadcrumb,
  diagnosticAppSessionId,
  getDiagnosticInstallationId,
  markDiagnosticIncidentRecovered,
  reportHttpFailure,
} from './diagnostics';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
}

export type RequestResult<T> =
  | ({ success: true; error?: never; code?: string } & (T extends object ? T : Record<string, never>))
  | { success: false; error: string; code: string; status?: number };

type ErrorMessageMap = Record<string, { tr: string; en: string }>;

const ERROR_MESSAGES: ErrorMessageMap = {
  NO_APPCHECK_TOKEN: {
    tr: 'Uygulama güvenlik doğrulaması eksik. Uygulamayı yeniden açıp tekrar deneyin.',
    en: 'App security verification is missing. Reopen the app and try again.',
  },
  INVALID_APPCHECK_TOKEN: {
    tr: 'Uygulama güvenlik doğrulaması geçersiz. Uygulamayı yeniden açıp tekrar deneyin.',
    en: 'App security verification is invalid. Reopen the app and try again.',
  },
  INVALID_SESSION: {
    tr: 'Oturumunuz geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.',
    en: 'Your session is invalid or expired. Please sign in again.',
  },
  UNAUTHORIZED: {
    tr: 'Bu işlem için giriş yapmanız gerekiyor.',
    en: 'You need to sign in to perform this action.',
  },
  FORBIDDEN: {
    tr: 'Bu işlem için yetkiniz yok.',
    en: 'You do not have permission to perform this action.',
  },
  NOT_FOUND: {
    tr: 'İstenen içerik bulunamadı veya artık mevcut değil.',
    en: 'The requested content could not be found or is no longer available.',
  },
  CONFLICT: {
    tr: 'Bu işlem mevcut durumla çakışıyor. Lütfen yenileyip tekrar deneyin.',
    en: 'This action conflicts with the current state. Refresh and try again.',
  },
  GONE: {
    tr: 'Bu işlem için kullanılan içerik artık geçerli değil.',
    en: 'The content used for this action is no longer valid.',
  },
  PAYLOAD_TOO_LARGE: {
    tr: 'Gönderdiğiniz dosya veya veri çok büyük.',
    en: 'The file or data you sent is too large.',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    tr: 'Bu dosya biçimi desteklenmiyor.',
    en: 'This file format is not supported.',
  },
  RATE_LIMITED: {
    tr: 'Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.',
    en: 'Too many attempts. Please wait a moment and try again.',
  },
  INVALID_REQUEST: {
    tr: 'İstek eksik veya hatalı. Lütfen bilgileri kontrol edip tekrar deneyin.',
    en: 'The request is incomplete or invalid. Check the details and try again.',
  },
  INTERNAL_ERROR: {
    tr: 'Sunucuda beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
    en: 'Something went wrong on the server. Please try again later.',
  },
  INVALID_RESPONSE: {
    tr: 'Sunucudan anlaşılmayan bir yanıt geldi. Lütfen tekrar deneyin.',
    en: 'The server returned an unreadable response. Please try again.',
  },
  NETWORK_ERROR: {
    tr: 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
    en: 'Could not connect to the internet. Check your connection and try again.',
  },
  NETWORK_TIMEOUT: {
    tr: 'İstek zaman aşımına uğradı. Bağlantınızı kontrol edip tekrar deneyin.',
    en: 'The request timed out. Check your connection and try again.',
  },
  INVALID_PASSWORD: {
    tr: 'Mevcut şifreniz hatalı.',
    en: 'Your current password is incorrect.',
  },
  TOO_MANY_ATTEMPTS: {
    tr: 'Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.',
    en: 'Too many attempts. Please try again later.',
  },
  PURCHASE_PROVIDER_FAILED: {
    tr: 'Satın alma doğrulanamadı. Ödeme bilgilerinizi kontrol edip tekrar deneyin.',
    en: 'The purchase could not be verified. Check your payment and try again.',
  },
  PURCHASE_VERIFICATION_UNAVAILABLE: {
    tr: 'Satın alma doğrulaması şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    en: 'Purchase verification is currently unavailable. Please try again later.',
  },
  PURCHASE_PROVIDER_INVALID_RESPONSE: {
    tr: 'Satın alma sağlayıcısından geçersiz yanıt alındı. Lütfen daha sonra tekrar deneyin.',
    en: 'The purchase provider returned an invalid response. Please try again later.',
  },
  UPLOAD_FINALIZATION_FAILED: {
    tr: 'Video yüklemesi tamamlanamadı. Lütfen tekrar deneyin.',
    en: 'The video upload could not be finalized. Please try again.',
  },
  PROMPT_CATALOG_EMPTY: {
    tr: 'Bugünün konusu şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    en: 'Today’s prompt is currently unavailable. Please try again later.',
  },
  FEEDBACK_SCREENSHOT_UPLOAD_FAILED: {
    tr: 'Ekran görüntüsü gönderilemedi, ancak geri bildiriminiz kaydedilebilir.',
    en: 'The screenshot could not be uploaded, but your feedback may still be saved.',
  },
  TRANSCODER_ORPHAN_CLEANUP_FAILED: {
    tr: 'Video işleme tamamlanamadı. Lütfen daha sonra tekrar deneyin.',
    en: 'Video processing could not be completed. Please try again later.',
  },
  CRON_NOT_CONFIGURED: {
    tr: 'Sunucu bakım işlemi şu anda kullanılamıyor.',
    en: 'Server maintenance is currently unavailable.',
  },
  PUSH_NOT_CONFIGURED: {
    tr: 'Bildirimler şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    en: 'Notifications are currently unavailable. Please try again later.',
  },
  PUSH_NOTIFICATION_FAILED: {
    tr: 'Bildirim gönderilemedi. Lütfen daha sonra tekrar deneyin.',
    en: 'The notification could not be sent. Please try again later.',
  },
};

function isCodeLike(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]+$/.test(value.trim());
}

function messageForCode(code?: string, fallback?: string): string {
  const locale = storage.getString('myturn_lang') === 'en' ? 'en' : 'tr';
  // For validation failures, the backend's explanation identifies the exact
  // missing or invalid field and is more useful than the generic code label.
  if (code === 'INVALID_REQUEST' && fallback && !isCodeLike(fallback)) return fallback;
  const mapped = code ? ERROR_MESSAGES[code]?.[locale] : undefined;
  if (mapped) return mapped;
  if (fallback && !isCodeLike(fallback)) return fallback;
  return ERROR_MESSAGES.INVALID_REQUEST[locale];
}

export function getApiErrorMessage(error: { code?: string; error?: string; status?: number } | null | undefined): string {
  return messageForCode(error?.code, error?.error);
}

function failure(code: string, fallback: string | undefined, status?: number): RequestResult<never> {
  return {
    success: false,
    code,
    status,
    error: messageForCode(code, fallback),
  };
}

type RequestOptions = {
  /** Skip a local cache read while still refreshing the cached response. */
  cachePolicy?: 'default' | 'network-only';
};

const DEFAULT_BASE_URL = API_BASE_URL;

const CACHE_TTL_MAP: Record<string, number> = {
  'profile/data': 5 * 60 * 1000,
  'social/data': 30 * 1000,
  'group/list': 60 * 1000,
  'streaks/data': 60 * 1000,
  'vlog/getSignedReadUrl': 50 * 60 * 1000,
};

const LIMITED_USE_APPCHECK_ENDPOINTS = new Set([
  'auth/change-password',
  'auth/reset-password',
  'boost/purchase',
]);

class SessionUnavailableError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SessionUnavailableError';
  }
}

function isAppCheckFailure(code: string): boolean {
  return code === 'NO_APPCHECK_TOKEN' || code === 'INVALID_APPCHECK_TOKEN';
}

class ApiClient {
  private activeBaseUrl = DEFAULT_BASE_URL;
  private inFlightReads = new Map<string, Promise<RequestResult<any>>>();

  constructor() {
    console.log(`[DEBUG] [apiClient] Initialized with dynamic code base URL: ${DEFAULT_BASE_URL}`);
  }

  getBaseUrl(): string {
    return this.activeBaseUrl;
  }

  updateBaseUrl(newUrl: string) {
    const nextOrigin = new URL(newUrl).origin;
    if (!IS_DEVELOPMENT && nextOrigin !== DEFAULT_BASE_URL) {
      throw new Error('API origin changes are disabled outside local development.');
    }

    console.log(`[DEBUG] [apiClient] Updating active base URL from "${this.activeBaseUrl}" to "${nextOrigin}"`);
    this.activeBaseUrl = nextOrigin;
    storage.set('active_api_base_url', nextOrigin);
    this.clearAllCache(); 
  }

  resetBaseUrl() {
    console.log(`[DEBUG] [apiClient] Resetting active base URL to default: ${DEFAULT_BASE_URL}`);
    this.activeBaseUrl = DEFAULT_BASE_URL;
    storage.delete('active_api_base_url');
    this.clearAllCache();
  }

  private getCacheKey(endpoint: string, args: any[]): string {
    const userScope = storage.getString('auth_firebase_uid') || 'anonymous';
    return `api_cache:${userScope}:${endpoint}:${JSON.stringify(args)}`;
  }

  /**
   * Returns a cached response even when it is stale. This is intentionally
   * separate from request() so screens can render stale data while a network
   * request revalidates it.
   */
  getCachedResponse<T = Record<string, never>>(endpoint: string, args: any[] = []): RequestResult<T> | null {
    const safeArgs = Array.isArray(args) ? args : (args !== undefined && args !== null ? [args] : []);

    try {
      const cachedRaw = storage.getString(this.getCacheKey(endpoint, safeArgs));
      if (!cachedRaw) return null;

      const cached = JSON.parse(cachedRaw);
      if (!cached?.data?.success) return null;

      return cached.data as RequestResult<T>;
    } catch (cacheErr) {
      console.warn(`[DEBUG] [apiClient] cached response read failed for ${endpoint}`, cacheErr);
      return null;
    }
  }

  invalidateCache(endpoints: string | string[]) {
    try {
      const targets = Array.isArray(endpoints) ? endpoints : [endpoints];
      const allKeys = storage.getAllKeys();
      targets.forEach((endpoint) => {
        const userScope = storage.getString('auth_firebase_uid') || 'anonymous';
        const prefix = `api_cache:${userScope}:${endpoint}:`;
        allKeys.forEach((key) => {
          if (key.startsWith(prefix)) {
            storage.delete(key);
            console.log(`[DEBUG] [apiClient] Evicted cache entry manually: "${key}"`);
          }
        });
      });
    } catch (e) {
      console.warn(`[DEBUG] [apiClient] Failed manually invalidating cache entries:`, e);
    }
  }

  async clearAllCache() {
    try {
      const allKeys = storage.getAllKeys();
      allKeys.forEach((key) => {
        if (key.startsWith('api_cache:')) {
          storage.delete(key);
        }
      });
      clearPendingDownloads();
      await invalidateMediaCache();
      console.log(`[DEBUG] [apiClient] Cleared API and media caches successfully.`);
    } catch (e) {
      console.warn(`[DEBUG] [apiClient] Failed clearing API and media caches:`, e);
    }
  }

  private async getHeaders(options: {
    isMultipart?: boolean;
    forceRefresh?: boolean;
    includeAuth?: boolean;
    includeAppCheck?: boolean;
    limitedUseAppCheck?: boolean;
  } = {}): Promise<Headers> {
    const {
      isMultipart = false,
      forceRefresh = false,
      includeAuth = true,
      includeAppCheck = true,
      limitedUseAppCheck = false,
    } = options;
    const headers = new Headers();

    const appCheckPromise = includeAppCheck
      ? getAppCheckHeaders(forceRefresh, limitedUseAppCheck)
      : Promise.resolve({} as Record<string, string>);
    const idTokenPromise = includeAuth
      ? (async () => {
          const currentUser = await waitForAuthInitialization();
          if (!currentUser) {
            throw new SessionUnavailableError('No authenticated Firebase user is available.', true);
          }
          try {
            return await currentUser.getIdToken(forceRefresh);
          } catch (tokenErr) {
            throw new SessionUnavailableError(
              'Firebase could not provide an ID token.',
              isPermanentFirebaseAuthError(tokenErr),
              { cause: tokenErr },
            );
          }
        })()
      : Promise.resolve<string | null>(null);

    const [appCheckHeaders, idToken] = await Promise.all([
      appCheckPromise,
      idTokenPromise,
    ]);
    Object.entries(appCheckHeaders).forEach(([key, value]) => headers.set(key, value));

    if (!isMultipart) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');
    const locale = storage.getString('myturn_lang') === 'en' ? 'en' : 'tr';
    headers.set('X-MyTurn-Locale', locale);
    
    if (idToken) headers.set('Authorization', `Bearer ${idToken}`);
    
    return headers;
  }

  private async readLocalUriAsBase64(localUri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (e: any) {
      console.error("[readLocalUriAsBase64] FileSystem readAsStringAsync failed:", e);
      throw new Error(`Failed to read file as Base64: ${e.message || e}`);
    }
  }

  async request<T = Record<string, never>>(
    endpoint: string,
    args: any[] = [],
    options: RequestOptions = {},
  ): Promise<RequestResult<T>> {
    const safeArgs = Array.isArray(args) ? args : (args !== undefined && args !== null ? [args] : []);
    const deduplicatedReads = new Set([
      'profile/data',
      'profile/public',
      'group/list',
      'social/data',
      'streaks/data',
      'vlog/today-assignment',
      'vlog/todayAssignment',
      'vlog/today-turn-state',
      'surveys/pending',
      'surveys/preferences',
      'surveys/library',
    ]);
    if (!deduplicatedReads.has(endpoint)) {
      return this.performRequest<T>(endpoint, safeArgs, options);
    }

    const userScope = storage.getString('auth_firebase_uid') || 'anonymous';
    const requestKey = `${userScope}:${endpoint}:${JSON.stringify(safeArgs)}:${options.cachePolicy || 'default'}`;
    const existing = this.inFlightReads.get(requestKey);
    if (existing) return existing as Promise<RequestResult<T>>;

    const request = this.performRequest<T>(endpoint, safeArgs, options);
    this.inFlightReads.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (this.inFlightReads.get(requestKey) === request) {
        this.inFlightReads.delete(requestKey);
      }
    }
  }

  private async performRequest<T = Record<string, never>>(
    endpoint: string,
    args: any[] = [],
    options: RequestOptions = {},
  ): Promise<RequestResult<T>> {
    const startTime = Date.now();
    const operationId = Crypto.randomUUID();
    const safeArgs = Array.isArray(args) ? args : (args !== undefined && args !== null ? [args] : []);
    
    const publicAuthEndpoints = new Set([
      'auth/sign-up', 'auth/resend-verification',
      'auth/request-password-reset', 'auth/verify-email', 'auth/reset-password',
      'auth/mobile/google/session',
      'legal/current', 'legal/privacy',
    ]);
    const isPublicEndpoint = publicAuthEndpoints.has(endpoint);

    const currentUser = isPublicEndpoint
      ? null
      : await waitForAuthInitialization();
    if (!currentUser && !isPublicEndpoint) {
      console.log(`[DEBUG] [apiClient] Request to "${endpoint}" rejected: No active Firebase user.`);
      await recoverInvalidSession(() => this.clearAllCache());
      return failure('INVALID_SESSION', 'Unauthorized');
    }

    let cacheKey = '';
    const ttl = CACHE_TTL_MAP[endpoint];
    const isCacheable = ttl !== undefined;

    if (isCacheable) {
      cacheKey = this.getCacheKey(endpoint, safeArgs);
    }

    if (isCacheable && options.cachePolicy !== 'network-only') {
      try {
        const cachedRaw = storage.getString(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const isExpired = Date.now() - cached.timestamp > ttl;
          if (!isExpired) {
            console.log(`[DEBUG] [apiClient] [CACHE HIT] ${endpoint} resolved in 0ms`);
            return cached.data;
          } else {
            console.log(`[DEBUG] [apiClient] [CACHE EXPIRED] ${endpoint}. Evicting old entry.`);
            storage.delete(cacheKey);
          }
        }
      } catch (cacheErr) {
        console.warn(`[DEBUG] [apiClient] cache evaluation error for ${endpoint}`, cacheErr);
      }
    }

    let url = `${this.activeBaseUrl}/api/${endpoint}`;
    let method = 'POST';
    let body: any = safeArgs[0] ? JSON.stringify(safeArgs) : undefined;

    if (endpoint === 'auth/mobile/google/session') {
      // This endpoint expects a JSON object rather than the default
      // positional-argument array used by the legacy API methods.
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'profile/data') {
      url = `${this.activeBaseUrl}/api/profile`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'profile/public') {
      const userId = encodeURIComponent(String(safeArgs[0] || ''));
      const groupId = safeArgs[1]
        ? `&groupId=${encodeURIComponent(String(safeArgs[1]))}`
        : '';
      url = `${this.activeBaseUrl}/api/profile?userId=${userId}${groupId}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'profile/username-availability') {
      const handle = encodeURIComponent(String(safeArgs[0] || ''));
      url = `${this.activeBaseUrl}/api/profile?intent=usernameAvailability&handle=${handle}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'profile/onboarding-status') {
      url = `${this.activeBaseUrl}/api/profile?intent=onboardingStatus`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'legal/current') {
      url = `${this.activeBaseUrl}/api/legal/agreements`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'legal/privacy') {
      url = `${this.activeBaseUrl}/api/legal/privacy`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'legal/accepted') {
      url = `${this.activeBaseUrl}/api/legal/agreements?scope=accepted`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'profile/update') {
      url = `${this.activeBaseUrl}/api/profile`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'profile/delete-account') {
      url = `${this.activeBaseUrl}/api/profile`;
      method = 'DELETE';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'profile/avatar') {
      const localUri = safeArgs[0];
      const base64Data = await this.readLocalUriAsBase64(localUri);
      url = `${this.activeBaseUrl}/api/profile/avatar`;
      method = 'POST';
      body = JSON.stringify({ base64Data });
    } else if (endpoint === 'boost/purchase') {
      url = `${this.activeBaseUrl}/api/boost/purchase`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'vlog/delete-clip' || endpoint === 'vlog/deleteClip') {
      url = `${this.activeBaseUrl}/api/vlog?intent=deleteClip&id=${safeArgs[0]}`;
      method = 'DELETE';
      body = undefined;
    } else if (endpoint === 'vlog/today-assignment' || endpoint === 'vlog/todayAssignment') {
      url = `${this.activeBaseUrl}/api/vlog?intent=getOrCreateTodayAssignment&groupId=${safeArgs[0]}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'vlog/today-turn-state') {
      url = `${this.activeBaseUrl}/api/vlog?intent=getTodayTurnState&groupId=${safeArgs[0]}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'vlog/getSignedReadUrl') {
      url = `${this.activeBaseUrl}/api/vlog?intent=getSignedReadUrl&bucket=${safeArgs[0]}&path=${encodeURIComponent(safeArgs[1] || '')}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'vlog/reaction' || endpoint === 'vlog/toggleReaction') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'toggleReaction', clipId: safeArgs[0], emoji: safeArgs[1] });
    } else if (endpoint === 'vlog/poke' || endpoint === 'vlog/pokeVlogger') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'pokeVlogger', assignmentId: safeArgs[0] });
    } else if (endpoint === 'vlog/toggle-volunteer' || endpoint === 'vlog/toggleVolunteer') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'toggleVolunteer', groupId: safeArgs[0] });
    } else if (endpoint === 'vlog/comment' || endpoint === 'vlog/addComment') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'addComment', clipId: safeArgs[0], text: safeArgs[1], parentId: safeArgs[2] });
    } else if (endpoint === 'vlog/toggleCommentLike' || endpoint === 'vlog/comment-like') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'toggleCommentLike', commentId: safeArgs[0] });
    } else if (endpoint === 'vlog/delete-comment' || endpoint === 'vlog/deleteComment') {
      url = `${this.activeBaseUrl}/api/vlog?intent=deleteComment&id=${safeArgs[0]}`;
      method = 'DELETE';
      body = undefined;
    } else if (endpoint === 'vlog/photo-response' || endpoint === 'vlog/addPhotoResponse' || endpoint === 'vlog/uploadPhotoResponse') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'addPhotoResponse', clipId: safeArgs[0], path: safeArgs[1], mediaType: safeArgs[2] || 'photo' });
    } else if (endpoint === 'vlog/create-clip' || endpoint === 'vlog/createClip') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'createClip', ...(safeArgs[0] || {}) });
    } else if (endpoint === 'vlog/complete-upload' || endpoint === 'vlog/completeUpload') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'completeUpload', clipId: safeArgs[0] });
    } else if (endpoint === 'vlog/trackView' || endpoint === 'vlog/track-view') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify({ action: 'trackView', clipId: safeArgs[0] });
    } else if (endpoint === 'vlog/upload') {
      url = `${this.activeBaseUrl}/api/vlog/upload`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'vlog') {
      url = `${this.activeBaseUrl}/api/vlog`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {}); 
    } else if (endpoint === 'social/data') {
      url = `${this.activeBaseUrl}/api/social`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'social/friend-request') {
      url = `${this.activeBaseUrl}/api/social`;
      method = 'POST';
      body = JSON.stringify({ action: 'send', targetUserId: safeArgs[0] });
    } else if (endpoint === 'social/respond-friend-request') {
      url = `${this.activeBaseUrl}/api/social`;
      method = 'POST';
      body = JSON.stringify({ action: 'respond', requestId: safeArgs[0], accept: safeArgs[1] });
    } else if (endpoint === 'social/cancel-friend-request') {
      url = `${this.activeBaseUrl}/api/social`;
      method = 'POST';
      body = JSON.stringify({ action: 'cancel', requestId: safeArgs[0] });
    } else if (endpoint === 'group/list') {
      url = `${this.activeBaseUrl}/api/group`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'group/join') {
      url = `${this.activeBaseUrl}/api/group`;
      method = 'POST';
      body = JSON.stringify({ action: 'join', inviteCode: safeArgs[0] });
    } else if (endpoint === 'group/create') {
      url = `${this.activeBaseUrl}/api/group`;
      method = 'POST';
      body = JSON.stringify({ action: 'create', name: safeArgs[0], timezone: safeArgs[1], image: safeArgs[2] });
    } else if (endpoint === 'group/leave') {
      url = `${this.activeBaseUrl}/api/group?groupId=${safeArgs[0]}`;
      method = 'DELETE';
      body = undefined;
    } else if (endpoint === 'streaks/data') {
      url = `${this.activeBaseUrl}/api/streaks?groupId=${safeArgs[0]}&include=comments,reactions,views&populate=true`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'auth/sign-up') {
      url = `${this.activeBaseUrl}/api/auth/signup`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0]);
    } else if (endpoint === 'auth/resend-verification') {
      url = `${this.activeBaseUrl}/api/auth/resend-verification`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0]);
    } else if (endpoint === 'auth/request-password-reset') {
      url = `${this.activeBaseUrl}/api/auth/request-password-reset`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0]);
    } else if (endpoint === 'auth/verify-email') {
      url = `${this.activeBaseUrl}/api/auth/verify-email`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0]);
    } else if (endpoint === 'auth/reset-password') {
      url = `${this.activeBaseUrl}/api/auth/reset-password`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0]);
    } else if (endpoint === 'auth/change-password') {
      url = `${this.activeBaseUrl}/api/auth/change-password`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0]);
    } else if (endpoint === 'push/register') {
      url = `${this.activeBaseUrl}/api/push`;
      method = 'POST';
      body = JSON.stringify({ token: safeArgs[0], locale: safeArgs[1] });
    } else if (endpoint === 'push/unregister') {
      url = `${this.activeBaseUrl}/api/push`;
      method = 'POST';
      body = JSON.stringify({ action: 'unregister', token: safeArgs[0] });
    } else if (endpoint === 'notification-preferences/get') {
      url = `${this.activeBaseUrl}/api/notification-preferences`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'notification-preferences/update') {
      url = `${this.activeBaseUrl}/api/notification-preferences`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'feedback/submit') {
      url = `${this.activeBaseUrl}/api/feedback/submit`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'surveys/pending') {
      const context = safeArgs[0] || {};
      const params = new URLSearchParams();
      for (const key of ['platform', 'appVersion', 'buildNumber', 'releaseChannel']) {
        if (context[key] !== null && context[key] !== undefined) {
          params.set(key, String(context[key]));
        }
      }
      url = `${this.activeBaseUrl}/api/surveys?${params.toString()}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'surveys/preferences') {
      url = `${this.activeBaseUrl}/api/surveys?intent=preferences`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'surveys/library') {
      const context = safeArgs[0] || {};
      const params = new URLSearchParams({ intent: 'library' });
      for (const key of ['platform', 'appVersion', 'buildNumber', 'releaseChannel']) {
        if (context[key] !== null && context[key] !== undefined) {
          params.set(key, String(context[key]));
        }
      }
      url = `${this.activeBaseUrl}/api/surveys?${params.toString()}`;
      method = 'GET';
      body = undefined;
    } else if (endpoint === 'surveys/submit' || endpoint === 'surveys/preferences/update') {
      url = `${this.activeBaseUrl}/api/surveys`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    } else if (endpoint === 'group') {
      url = `${this.activeBaseUrl}/api/group`;
      method = 'POST';
      body = JSON.stringify(safeArgs[0] || {});
    }

    try {
      let headers = await withTimeout(
        this.getHeaders({
          includeAuth: !isPublicEndpoint,
          includeAppCheck: endpoint !== 'legal/privacy',
          limitedUseAppCheck: LIMITED_USE_APPCHECK_ENDPOINTS.has(endpoint),
        }),
        10_000,
        'Header resolution timed out.',
      );
      let clientRequestId = Crypto.randomUUID();
      headers.set('X-Client-Request-ID', clientRequestId);
      headers.set('X-Client-Operation-ID', operationId);
      headers.set('X-Client-App-Session-ID', diagnosticAppSessionId);
      headers.set('X-Client-Installation-ID', getDiagnosticInstallationId());

      console.log(`[DEBUG] [apiClient] [START] ${method} -> ${url}`);
      crashlytics().log(`[API Request] ${method} -> ${url}`);
      addDiagnosticBreadcrumb({
        category: 'network',
        name: 'api_request',
        outcome: 'started',
        context: { endpoint, method, operationId },
      });

      let response = await fetchWithTimeout(url, {
        method,
        headers,
        body,
      }, 20_000, { handled: true });

      // Retry exactly once on 401 using a forced token refresh to seamlessly
      // handle background expiries without ejecting the user session
      if (response.status === 401 && !isPublicEndpoint) {
        const retryIncidentId = reportHttpFailure({
          clientRequestId,
          operationId,
          route: endpoint,
          method,
          status: response.status,
          code: 'INVALID_SESSION',
          durationMs: Date.now() - startTime,
          retryNumber: 0,
          authState: 'expired_or_invalid',
          context: { serverRequestId: response.headers.get('x-request-id') || undefined },
        });
        console.log(`[DEBUG] [apiClient] [RETRY] 401 Unauthorized received for ${endpoint}. Force refreshing tokens...`);
        headers = await withTimeout(
          this.getHeaders({
            forceRefresh: true,
            includeAuth: true,
            limitedUseAppCheck: LIMITED_USE_APPCHECK_ENDPOINTS.has(endpoint),
          }),
          10_000,
          'Header force-refresh timed out.',
        );
        clientRequestId = Crypto.randomUUID();
        headers.set('X-Client-Request-ID', clientRequestId);
        headers.set('X-Client-Operation-ID', operationId);
        headers.set('X-Client-App-Session-ID', diagnosticAppSessionId);
        headers.set('X-Client-Installation-ID', getDiagnosticInstallationId());
        response = await fetchWithTimeout(url, {
          method,
          headers,
          body,
        }, 20_000, { handled: true });
        if (response.ok) markDiagnosticIncidentRecovered(retryIncidentId);
      }

      const latency = Date.now() - startTime;
      console.log(`[DEBUG] [apiClient] [STATUS] ${response.status} | Latency: ${latency}ms`);
      crashlytics().log(`[API Response] ${response.status} for ${endpoint} | Latency: ${latency}ms`);

      const resText = await response.text();

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = JSON.parse(resText);
        } catch { }
        const code = typeof errorData.code === 'string'
          ? errorData.code
          : response.status === 401
            ? 'INVALID_SESSION'
            : response.status === 403
              ? 'FORBIDDEN'
              : response.status === 404
                ? 'NOT_FOUND'
                : response.status === 429
                  ? 'RATE_LIMITED'
                  : response.status >= 500
                    ? 'INTERNAL_ERROR'
                    : 'INVALID_REQUEST';
        if (response.status === 401 && !isPublicEndpoint && !isAppCheckFailure(code)) {
          await recoverInvalidSession(() => this.clearAllCache());
        }
        reportHttpFailure({
          clientRequestId,
          operationId,
          route: endpoint,
          method,
          status: response.status,
          code,
          errorType: 'HttpError',
          errorMessage: typeof errorData.error === 'string'
            ? errorData.error
            : typeof errorData.message === 'string'
              ? errorData.message
              : undefined,
          durationMs: latency,
          retryNumber: response.status === 401 && !isPublicEndpoint ? 1 : 0,
          authState: response.status === 401 ? 'expired_or_invalid' : undefined,
          context: { serverRequestId: response.headers.get('x-request-id') || undefined },
        });
        return failure(
          code,
          typeof errorData.error === 'string'
            ? errorData.error
            : typeof errorData.message === 'string'
              ? errorData.message
              : resText.trim() || undefined,
          response.status,
        );
      }

      try {
        const resBody = JSON.parse(resText);

        if (resBody?.success === false) {
          reportHttpFailure({
            clientRequestId,
            operationId,
            route: endpoint,
            method,
            status: response.status,
            code: typeof resBody.code === 'string' ? resBody.code : 'INVALID_REQUEST',
            errorType: 'ApplicationResponseError',
            durationMs: latency,
            context: { serverRequestId: response.headers.get('x-request-id') || undefined },
          });
          return failure(
            typeof resBody.code === 'string' ? resBody.code : 'INVALID_REQUEST',
            typeof resBody.error === 'string' ? resBody.error : resBody.message,
            response.status,
          );
        }

        if (resBody && resBody.success) {
          if (isCacheable) {
            const cachePayload = {
              timestamp: Date.now(),
              data: resBody,
            };
            storage.set(cacheKey, JSON.stringify(cachePayload));
            console.log(`[DEBUG] [apiClient] [CACHE SAVE] Cached response for ${endpoint}`);
          }

          if (endpoint === 'profile/update' || endpoint === 'profile/avatar') {
            this.invalidateCache('profile/data');
          } else if (endpoint === 'group/join' || endpoint === 'group/create' || endpoint === 'group/leave' || endpoint === 'group') {
            this.invalidateCache(['group/list', 'social/data']);
          } else if (endpoint.startsWith('social/')) {
            this.invalidateCache('social/data');
          } else if (
            endpoint === 'vlog/delete-clip' || 
            endpoint === 'vlog/deleteClip' || 
            endpoint === 'vlog/create-clip' || 
            endpoint === 'vlog/createClip'
          ) {
            this.invalidateCache(['profile/data', 'streaks/data']);
          }
        }

        addDiagnosticBreadcrumb({
          category: 'network',
          name: 'api_request',
          outcome: 'success',
          durationMs: latency,
          status: response.status,
          context: { endpoint, method, operationId, serverRequestId: response.headers.get('x-request-id') || undefined },
        });
        return resBody;
      } catch (parseErr: any) {
        crashlytics().recordError(parseErr);
        reportHttpFailure({
          clientRequestId,
          operationId,
          route: endpoint,
          method,
          status: response.status,
          code: 'INVALID_RESPONSE',
          errorType: parseErr?.name || 'ParseError',
          errorMessage: parseErr?.message,
          durationMs: latency,
          context: { serverRequestId: response.headers.get('x-request-id') || undefined },
        });
        return failure('INVALID_RESPONSE', undefined, response.status);
      }
    } catch (err: any) {
      crashlytics().recordError(err);
      reportHttpFailure({
        operationId,
        route: endpoint,
        method,
        status: err instanceof SessionUnavailableError && err.permanent ? 401 : 0,
        code: err instanceof SessionUnavailableError && err.permanent
          ? 'INVALID_SESSION'
          : typeof err?.message === 'string' && /timed out|timeout/i.test(err.message)
            ? 'NETWORK_TIMEOUT'
            : 'NETWORK_ERROR',
        errorType: err?.name || 'NetworkError',
        errorMessage: err?.message,
        durationMs: Date.now() - startTime,
        authState: err instanceof SessionUnavailableError && err.permanent ? 'expired' : undefined,
      });
      if (err instanceof SessionUnavailableError) {
        if (err.permanent) {
          await recoverInvalidSession(() => this.clearAllCache());
        }
        return failure(
          err.permanent ? 'INVALID_SESSION' : 'NETWORK_ERROR',
          err.message,
          err.permanent ? 401 : undefined,
        );
      }
      const isTimeout = typeof err?.message === 'string' && /timed out|timeout/i.test(err.message);
      return failure(isTimeout ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR', err?.message);
    }
  }

  async uploadMedia(
    bucket: 'vlogs' | 'avatars' | 'thumbnails',
    localUri: string,
    destinationPath: string
  ): Promise<ActionResult<{ path: string }>> {
    const operationId = Crypto.randomUUID();
    const startedAt = Date.now();
    let clientRequestId = Crypto.randomUUID();
    try {
      const url = `${this.activeBaseUrl}/api/media`;
      crashlytics().log(`[Media Upload] POST -> ${url} (Bucket: ${bucket})`);

      const filename = localUri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';

      let type = 'image/jpeg';
      if (ext === 'mp4') type = 'video/mp4';
      else if (ext === 'mov') type = 'video/quicktime';
      else if (ext === 'webm') type = 'video/webm';
      else if (ext === 'png') type = 'image/png';
      else if (ext === 'gif') type = 'image/gif';

      let headers = await withTimeout(
        this.getHeaders({ isMultipart: true, forceRefresh: false, includeAuth: true }),
        10_000,
        'Header resolution timed out.'
      );
      headers.set('X-Client-Request-ID', clientRequestId);
      headers.set('X-Client-Operation-ID', operationId);
      headers.set('X-Client-App-Session-ID', diagnosticAppSessionId);
      headers.set('X-Client-Installation-ID', getDiagnosticInstallationId());
      let headersRecord: Record<string, string> = {};
      headers.forEach((val, key) => { headersRecord[key] = val; });

      let uploadResult = await FileSystem.uploadAsync(url, localUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: type,
        parameters: {
          bucket,
          path: destinationPath,
        },
        headers: headersRecord,
      });

      // Retry mechanism for transparent reauthentication
      if (uploadResult.status === 401) {
        const retryIncidentId = reportHttpFailure({
          clientRequestId,
          operationId,
          route: 'media/upload',
          method: 'POST',
          status: 401,
          code: 'INVALID_SESSION',
          durationMs: Date.now() - startedAt,
          retryNumber: 0,
          authState: 'expired_or_invalid',
          context: { bucket },
        });
        console.log(`[DEBUG] [apiClient] [RETRY] 401 Unauthorized for uploadMedia. Force refreshing tokens...`);
        headers = await withTimeout(
          this.getHeaders({ isMultipart: true, forceRefresh: true, includeAuth: true }),
          10_000,
          'Header force-refresh timed out.',
        );
        clientRequestId = Crypto.randomUUID();
        headers.set('X-Client-Request-ID', clientRequestId);
        headers.set('X-Client-Operation-ID', operationId);
        headers.set('X-Client-App-Session-ID', diagnosticAppSessionId);
        headers.set('X-Client-Installation-ID', getDiagnosticInstallationId());
        headersRecord = {};
        headers.forEach((val, key) => { headersRecord[key] = val; });

        uploadResult = await FileSystem.uploadAsync(url, localUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: type,
          parameters: {
            bucket,
            path: destinationPath,
          },
          headers: headersRecord,
        });
        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          markDiagnosticIncidentRecovered(retryIncidentId);
        }
      }

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        let errorData: any = {};
        try {
          errorData = JSON.parse(uploadResult.body);
        } catch { }
        const code = typeof errorData.code === 'string'
          ? errorData.code
          : uploadResult.status === 401
            ? 'INVALID_SESSION'
            : uploadResult.status === 403
              ? 'FORBIDDEN'
              : uploadResult.status === 413
                ? 'PAYLOAD_TOO_LARGE'
                : uploadResult.status === 429
                  ? 'RATE_LIMITED'
                  : uploadResult.status >= 500
                  ? 'INTERNAL_ERROR'
                  : 'INVALID_REQUEST';
        if (uploadResult.status === 401 && !isAppCheckFailure(code)) {
          await recoverInvalidSession(() => this.clearAllCache());
        }
        reportHttpFailure({
          clientRequestId,
          operationId,
          route: 'media/upload',
          method: 'POST',
          status: uploadResult.status,
          code,
          errorType: 'MediaUploadHttpError',
          durationMs: Date.now() - startedAt,
          context: { bucket },
          authState: uploadResult.status === 401 ? 'expired_or_invalid' : undefined,
        });
        return {
          ...failure(code, typeof errorData.error === 'string' ? errorData.error : uploadResult.body, uploadResult.status),
        };
      }

      const data = JSON.parse(uploadResult.body);
      if (data?.success === false) {
        reportHttpFailure({
          clientRequestId,
          operationId,
          route: 'media/upload',
          method: 'POST',
          status: uploadResult.status,
          code: typeof data.code === 'string' ? data.code : 'INVALID_REQUEST',
          errorType: 'MediaUploadResponseError',
          durationMs: Date.now() - startedAt,
          context: { bucket },
        });
        return failure(
          typeof data.code === 'string' ? data.code : 'INVALID_REQUEST',
          typeof data.error === 'string' ? data.error : data.message,
          uploadResult.status,
        );
      }
      addDiagnosticBreadcrumb({
        category: 'upload',
        name: 'media_upload',
        outcome: 'success',
        status: uploadResult.status,
        durationMs: Date.now() - startedAt,
        context: { bucket, operationId },
      });
      return { success: true, data };
    } catch (err: any) {
      crashlytics().recordError(err);
      reportHttpFailure({
        clientRequestId,
        operationId,
        route: 'media/upload',
        method: 'POST',
        status: err instanceof SessionUnavailableError && err.permanent ? 401 : 0,
        code: err instanceof SessionUnavailableError && err.permanent
          ? 'INVALID_SESSION'
          : typeof err?.message === 'string' && /timed out|timeout/i.test(err.message)
            ? 'NETWORK_TIMEOUT'
            : 'UPLOAD_ERROR',
        errorType: err?.name || 'UploadError',
        errorMessage: err?.message,
        durationMs: Date.now() - startedAt,
        context: { bucket },
        authState: err instanceof SessionUnavailableError && err.permanent ? 'expired' : undefined,
      });
      if (err instanceof SessionUnavailableError) {
        if (err.permanent) {
          await recoverInvalidSession(() => this.clearAllCache());
        }
        return failure(
          err.permanent ? 'INVALID_SESSION' : 'NETWORK_ERROR',
          err.message,
          err.permanent ? 401 : undefined,
        );
      }
      const isTimeout = typeof err?.message === 'string' && /timed out|timeout/i.test(err.message);
      return failure(isTimeout ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR', err?.message);
    }
  }
}

export const apiClient = new ApiClient();

// Changelog:
// - Extracted header generation inside try block so resolution failure gracefully rejects the request instead of throwing.
// - Replaced synchronous usage of auth().currentUser with waitForAuthInitialization to prevent unauthenticated drops on cold start.
// - Filtered public auth endpoints from triggering auth initialization blocks.
// - Replaced the credentials: 'include' option with the explicit HTTP header for cookie isolation.
