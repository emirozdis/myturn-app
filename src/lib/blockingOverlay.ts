import { useEffect, useRef, useSyncExternalStore } from 'react';

const visibleOverlays = new Set<symbol>();
const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => visibleOverlays.size > 0;

/**
 * Registers UI that owns the current interaction surface. Global page
 * gestures must remain disabled until every registered overlay has closed.
 */
export function useBlockingOverlay(visible: boolean): void {
  const tokenRef = useRef(Symbol('blocking-overlay'));

  useEffect(() => {
    const token = tokenRef.current;
    if (!visible) return;

    visibleOverlays.add(token);
    emitChange();

    return () => {
      visibleOverlays.delete(token);
      emitChange();
    };
  }, [visible]);
}

export function useHasBlockingOverlay(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
