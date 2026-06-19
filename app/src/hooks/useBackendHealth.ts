import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { checkHealth } from '../api/ai';

export interface BackendHealth {
  /** null = not yet checked, true = reachable, false = unreachable. */
  online: boolean | null;
  checking: boolean;
  recheck: () => void;
}

// Re-probe periodically only while we believe we're offline, so the banner can
// auto-dismiss when the server comes back — without polling a healthy server.
const OFFLINE_RECHECK_MS = 15000;

/**
 * Lightweight backend reachability probe. There's no NetInfo dependency in the
 * project, so "offline" here means "the AI backend didn't answer /api/health"
 * — which is exactly what gates OCR / AI features.
 */
export function useBackendHealth(): BackendHealth {
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);

  const recheck = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const { ok } = await checkHealth();
      setOnline(ok);
    } catch {
      setOnline(false);
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, []);

  // Initial probe + re-probe when the app returns to the foreground.
  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  // While offline, retry on an interval so the banner clears itself on recovery.
  useEffect(() => {
    if (online !== false) return;
    const id = setInterval(recheck, OFFLINE_RECHECK_MS);
    return () => clearInterval(id);
  }, [online, recheck]);

  return { online, checking, recheck };
}
