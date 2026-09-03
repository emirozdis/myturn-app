import { Dimensions, Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { getAppCheckHeaders } from './appCheck';
import { API_BASE_URL, APP_ENVIRONMENT } from './environment';
import { storage } from './storage';

const INSTALLATION_KEY = 'diagnostics_installation_id';
const BREADCRUMB_KEY = 'diagnostics_breadcrumbs_v1';
const QUEUE_KEY = 'diagnostics_incident_queue_v1';
const MAX_BREADCRUMBS = 100;
const MAX_QUEUE = 50;
const BEFORE_COUNT = 60;
const AFTER_COUNT = 20;
const AFTER_WINDOW_MS = 10_000;
const MAX_CONTEXT_KEYS = 30;
const SENSITIVE_KEY = /authorization|cookie|password|passwd|secret|token|signature|api[-_]?key|base64|body|payload|content|email|message|text/i;

export type DiagnosticBreadcrumbInput = {
  category: string;
  name: string;
  outcome?: 'started' | 'success' | 'failure' | 'cancelled';
  durationMs?: number;
  status?: number;
  code?: string;
  context?: Record<string, unknown>;
};

type DiagnosticBreadcrumb = DiagnosticBreadcrumbInput & {
  sequence: number;
  occurredAt: string;
  phase?: 'before' | 'trigger' | 'after';
};

type QueuedIncident = {
  clientIncidentId: string;
  clientRequestId?: string;
  operationId?: string;
  installationId: string;
  appSessionId: string;
  authState: string;
  reportedUserId?: string;
  occurredAt: string;
  finalizedAt?: string;
  finalizeAfter: number;
  triggerSequence: number;
  route: string;
  method: string;
  status: number;
  code?: string;
  errorType?: string;
  errorMessage?: string;
  durationMs?: number;
  retryNumber?: number;
  recovered?: boolean;
  environment: string;
  release: string;
  context?: Record<string, unknown>;
  deviceContext: Record<string, unknown>;
  networkContext: Record<string, unknown>;
  appContext: Record<string, unknown>;
  breadcrumbs: DiagnosticBreadcrumb[];
};

let sequence = 0;
let flushPromise: Promise<void> | null = null;
let finalizeTimer: ReturnType<typeof setTimeout> | null = null;

function parseArray<T>(key: string): T[] {
  try {
    const raw = storage.getString(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
}

let breadcrumbs = parseArray<DiagnosticBreadcrumb>(BREADCRUMB_KEY).slice(-MAX_BREADCRUMBS);
sequence = breadcrumbs.reduce((max, item) => Math.max(max, item.sequence || 0), 0);

export const diagnosticAppSessionId = Crypto.randomUUID();

export function getDiagnosticInstallationId(): string {
  const existing = storage.getString(INSTALLATION_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  storage.set(INSTALLATION_KEY, created);
  return created;
}

function scrubString(value: string, max = 1_000): string {
  return value
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/([?&](?:token|key|secret|signature|password)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, max);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return scrubString(value);
  if (!value || typeof value !== 'object' || depth >= 3) return undefined;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value).slice(0, MAX_CONTEXT_KEYS)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const safe = sanitize(nested, depth + 1);
    if (safe !== undefined) result[key.slice(0, 100)] = safe;
  }
  return result;
}

function safeContext(value?: Record<string, unknown>): Record<string, unknown> | undefined {
  const safe = sanitize(value);
  return safe && typeof safe === 'object' && !Array.isArray(safe)
    ? safe as Record<string, unknown>
    : undefined;
}

function persistBreadcrumbs() {
  storage.set(BREADCRUMB_KEY, JSON.stringify(breadcrumbs.slice(-MAX_BREADCRUMBS)));
}

export function addDiagnosticBreadcrumb(input: DiagnosticBreadcrumbInput): DiagnosticBreadcrumb {
  const breadcrumb: DiagnosticBreadcrumb = {
    sequence: ++sequence,
    occurredAt: new Date().toISOString(),
    category: scrubString(input.category, 100),
    name: scrubString(input.name, 200),
    outcome: input.outcome,
    durationMs: input.durationMs,
    status: input.status,
    code: input.code ? scrubString(input.code, 100) : undefined,
    context: safeContext(input.context),
  };
  breadcrumbs = [...breadcrumbs.slice(-(MAX_BREADCRUMBS - 1)), breadcrumb];
  persistBreadcrumbs();
  return breadcrumb;
}

function deviceContext(): Record<string, unknown> {
  const window = Dimensions.get('window');
  const reactNativeVersion = Platform.constants.reactNativeVersion;
  return {
    platform: Platform.OS,
    platformVersion: String(Platform.Version),
    reactNativeVersion: `${reactNativeVersion.major}.${reactNativeVersion.minor}.${reactNativeVersion.patch}`,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    windowWidth: Math.round(window.width),
    windowHeight: Math.round(window.height),
    windowScale: window.scale,
  };
}

function appContext(): Record<string, unknown> {
  return {
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'unknown',
    buildVersion: Constants.nativeBuildVersion ?? 'unknown',
    environment: APP_ENVIRONMENT,
  };
}

function networkContext(): Record<string, unknown> {
  return {
    online: typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : undefined,
  };
}

function readQueue(): QueuedIncident[] {
  return parseArray<QueuedIncident>(QUEUE_KEY);
}

function writeQueue(queue: QueuedIncident[]) {
  storage.set(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

function authSnapshot(): { authState: string; reportedUserId?: string } {
  const user = auth().currentUser;
  if (!user) return { authState: 'anonymous' };
  return { authState: 'present', reportedUserId: user.uid };
}

function scheduleFinalization() {
  if (finalizeTimer) clearTimeout(finalizeTimer);
  const queue = readQueue();
  const next = queue
    .filter((incident) => !incident.finalizedAt)
    .reduce((earliest, incident) => Math.min(earliest, incident.finalizeAfter), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(next)) return;
  finalizeTimer = setTimeout(() => {
    finalizeTimer = null;
    finalizePendingIncidents();
    void flushDiagnosticQueue();
  }, Math.max(0, next - Date.now()));
}

function finalizePendingIncidents(force = false) {
  const now = Date.now();
  const queue = readQueue();
  let changed = false;
  for (const incident of queue) {
    if (incident.finalizedAt || (!force && incident.finalizeAfter > now)) continue;
    const after = breadcrumbs
      .filter((item) => item.sequence > incident.triggerSequence)
      .slice(0, AFTER_COUNT)
      .map((item) => ({ ...item, phase: 'after' as const }));
    incident.breadcrumbs = [...incident.breadcrumbs, ...after];
    incident.finalizedAt = new Date().toISOString();
    changed = true;
  }
  if (changed) writeQueue(queue);
  scheduleFinalization();
}

export function reportHttpFailure(input: {
  clientRequestId?: string;
  operationId?: string;
  route: string;
  method: string;
  status?: number;
  code?: string;
  errorType?: string;
  errorMessage?: string;
  durationMs?: number;
  retryNumber?: number;
  context?: Record<string, unknown>;
  authState?: string;
}): string {
  const authInfo = authSnapshot();
  const trigger = addDiagnosticBreadcrumb({
    category: 'network',
    name: 'http_non_2xx',
    outcome: 'failure',
    status: input.status,
    code: input.code,
    durationMs: input.durationMs,
    context: { route: input.route, method: input.method, retryNumber: input.retryNumber },
  });
  const incidentId = Crypto.randomUUID();
  const preceding = breadcrumbs
    .filter((item) => item.sequence < trigger.sequence)
    .slice(-BEFORE_COUNT)
    .map((item) => ({ ...item, phase: 'before' as const }));
  const incident: QueuedIncident = {
    clientIncidentId: incidentId,
    clientRequestId: input.clientRequestId,
    operationId: input.operationId,
    installationId: getDiagnosticInstallationId(),
    appSessionId: diagnosticAppSessionId,
    ...authInfo,
    authState: input.authState || authInfo.authState,
    occurredAt: trigger.occurredAt,
    finalizeAfter: Date.now() + AFTER_WINDOW_MS,
    triggerSequence: trigger.sequence,
    route: scrubString(input.route, 500),
    method: scrubString(input.method, 20),
    status: input.status ?? 0,
    code: input.code ? scrubString(input.code, 100) : undefined,
    errorType: input.errorType ? scrubString(input.errorType, 200) : undefined,
    errorMessage: input.errorMessage ? scrubString(input.errorMessage, 2_000) : undefined,
    durationMs: input.durationMs,
    retryNumber: input.retryNumber,
    recovered: false,
    environment: APP_ENVIRONMENT,
    release: String(Constants.nativeBuildVersion ?? Constants.nativeAppVersion ?? 'unknown'),
    context: safeContext(input.context),
    deviceContext: deviceContext(),
    networkContext: networkContext(),
    appContext: appContext(),
    breadcrumbs: [
      ...preceding,
      { ...trigger, phase: 'trigger' },
    ],
  };
  writeQueue([...readQueue(), incident]);
  scheduleFinalization();
  return incidentId;
}

export function markDiagnosticIncidentRecovered(clientIncidentId: string) {
  const queue = readQueue();
  const incident = queue.find((item) => item.clientIncidentId === clientIncidentId);
  if (!incident) return;
  incident.recovered = true;
  writeQueue(queue);
}

export async function flushDiagnosticQueue(options: { forceFinalize?: boolean } = {}): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    finalizePendingIncidents(options.forceFinalize === true);
    let queue = readQueue();
    for (const incident of queue.filter((item) => item.finalizedAt).slice(0, 10)) {
      try {
        const appCheckHeaders = await getAppCheckHeaders(false, false);
        const headers: Record<string, string> = {
          ...appCheckHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Client-Installation-ID': incident.installationId,
          'X-Client-App-Session-ID': diagnosticAppSessionId,
        };
        const user = auth().currentUser;
        if (user) {
          try {
            headers.Authorization = `Bearer ${await user.getIdToken(false)}`;
          } catch {
            // Anonymous diagnostic delivery remains available when token refresh fails.
          }
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        let response: Response;
        try {
          response = await fetch(`${API_BASE_URL}/api/diagnostics/incidents`, {
            method: 'POST',
            headers,
            body: JSON.stringify(incident),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) break;
        queue = readQueue().filter((item) => item.clientIncidentId !== incident.clientIncidentId);
        writeQueue(queue);
      } catch {
        break;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

export function initializeDiagnostics() {
  getDiagnosticInstallationId();
  addDiagnosticBreadcrumb({ category: 'app', name: 'app_session_started', outcome: 'success' });
  finalizePendingIncidents();
  void flushDiagnosticQueue();
}
