export const DEFAULT_NETWORK_TIMEOUT_MS = 15_000;

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_NETWORK_TIMEOUT_MS,
  message = 'Network operation timed out.',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
  timeoutMs = DEFAULT_NETWORK_TIMEOUT_MS,
  diagnostics: { handled?: boolean; route?: string } = {},
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  let didTimeout = false;

  const forwardAbort = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', forwardAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!diagnostics.handled && (response.status < 200 || response.status >= 300)) {
      const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      let route = diagnostics.route || 'network/request';
      try {
        route = diagnostics.route || new URL(rawUrl).pathname;
      } catch {
        // Keep the non-sensitive fallback route.
      }
      void import('./diagnostics').then(({ reportHttpFailure }) => {
        reportHttpFailure({
          route,
          method: init.method || 'GET',
          status: response.status,
          code: 'HTTP_NON_2XX',
          errorType: 'HttpError',
        });
      }).catch(() => {});
    }
    return response;
  } catch (error) {
    if (didTimeout) {
      const timeoutError = new Error(`Network request timed out after ${timeoutMs}ms.`);
      if (!diagnostics.handled) {
        void import('./diagnostics').then(({ reportHttpFailure }) => {
          reportHttpFailure({
            route: diagnostics.route || 'network/request',
            method: init.method || 'GET',
            status: 0,
            code: 'NETWORK_TIMEOUT',
            errorType: timeoutError.name,
            errorMessage: timeoutError.message,
          });
        }).catch(() => {});
      }
      throw timeoutError;
    }
    if (!diagnostics.handled) {
      void import('./diagnostics').then(({ reportHttpFailure }) => {
        reportHttpFailure({
          route: diagnostics.route || 'network/request',
          method: init.method || 'GET',
          status: 0,
          code: 'NETWORK_ERROR',
          errorType: error instanceof Error ? error.name : 'NetworkError',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }).catch(() => {});
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', forwardAbort);
  }
}
