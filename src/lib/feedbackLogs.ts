// ./src/lib/feedbackLogs.ts
type LogLevel = "debug" | "info" | "log" | "warn" | "error";

export interface FeedbackLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface FeedbackLogState {
  installed: boolean;
  entries: FeedbackLogEntry[];
  totalCharacters: number;
}

const MAX_ENTRIES = 200;
const MAX_CHARACTERS = 64_000;
const MAX_ENTRY_CHARACTERS = 2_000;
const REDACTED_KEYS = /(authorization|cookie|password|token|secret|api.?key)/i;

const globalWithFeedbackLogs = globalThis as typeof globalThis & {
  __myturnFeedbackLogs?: FeedbackLogState;
};

const state = globalWithFeedbackLogs.__myturnFeedbackLogs ?? {
  installed: false,
  entries: [],
  totalCharacters: 0,
};
globalWithFeedbackLogs.__myturnFeedbackLogs = state;

let isCapturing = false;

function redact(value: string): string {
  return value
    .replace(/(authorization|cookie|password|token|secret)(["']?\s*[=:]\s*["']?)([^"'\s,;}]+)/gi, "$1$2[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|signature|sig|key|x-amz-[^=]+)=)[^&\s]+/gi, "$1[REDACTED]");
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`;

  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (key, nestedValue) => {
      if (REDACTED_KEYS.test(key)) return "[REDACTED]";
      if (typeof nestedValue === "object" && nestedValue !== null) {
        if (seen.has(nestedValue)) return "[Circular]";
        seen.add(nestedValue);
      }
      return nestedValue;
    });
  } catch {
    return String(value);
  }
}

function append(level: LogLevel, args: unknown[]) {
  if (isCapturing) return;
  isCapturing = true;

  try {
    const message = redact(args.map(stringify).join(" ")).slice(0, MAX_ENTRY_CHARACTERS);
    if (!message) return;

    state.entries.push({ timestamp: new Date().toISOString(), level, message });
    state.totalCharacters += message.length;

    while (state.entries.length > MAX_ENTRIES || state.totalCharacters > MAX_CHARACTERS) {
      const removed = state.entries.shift();
      state.totalCharacters -= removed?.message.length ?? 0;
    }
  } catch {
    // Fail-safe protection against logging errors
  } finally {
    isCapturing = false;
  }
}

export function installFeedbackLogCapture() {
  if (state.installed) return;
  state.installed = true;

  (["debug", "info", "log", "warn", "error"] as const).forEach((level) => {
    const original = console[level];
    if (typeof original !== "function") return;

    console[level] = function (...args: unknown[]) {
      append(level, args);
      try {
        original.apply(console, args);
      } catch {
        // Fallback for custom Hermes console overrides
      }
    };
  });
}

export function getRecentFeedbackLogs(): FeedbackLogEntry[] {
  return state.entries.map((entry) => ({ ...entry }));
}

installFeedbackLogCapture();