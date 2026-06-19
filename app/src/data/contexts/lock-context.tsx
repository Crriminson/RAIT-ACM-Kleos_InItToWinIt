import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

const STORAGE_KEY = '@kleos/lock';
const SALT = 'kleos-ciyp-v1';

interface Persisted {
  enabled: boolean;
  biometricEnabled: boolean;
  pinHash: string | null;
}

interface LockContextValue {
  loaded: boolean;
  enabled: boolean;
  locked: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  enableLock: (pin: string, withBiometric: boolean) => Promise<void>;
  disableLock: () => Promise<void>;
  setBiometricEnabled: (on: boolean) => Promise<void>;
  verifyAndUnlock: (pin: string) => Promise<boolean>;
  tryBiometric: () => Promise<boolean>;
  lockNow: () => void;
}

const LockContext = createContext<LockContextValue | null>(null);

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${SALT}:${pin}`);
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const pinHashRef = useRef<string | null>(null);

  const persist = useCallback(async (p: Persisted) => {
    pinHashRef.current = p.pinHash;
    setEnabled(p.enabled);
    setBiometricState(p.biometricEnabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // kept in memory for the session
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [raw, hasHw, enrolled] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          LocalAuthentication.hasHardwareAsync().catch(() => false),
          LocalAuthentication.isEnrolledAsync().catch(() => false),
        ]);
        setBiometricAvailable(Boolean(hasHw) && Boolean(enrolled));
        if (raw) {
          const p: Persisted = JSON.parse(raw);
          pinHashRef.current = p.pinHash;
          setEnabled(p.enabled);
          setBiometricState(p.biometricEnabled);
          setLocked(p.enabled); // require unlock on cold start
        }
      } catch {
        // treat as no lock
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Re-lock when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' && enabled) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const enableLock = useCallback(async (pin: string, withBiometric: boolean) => {
    const pinHash = await hashPin(pin);
    await persist({ enabled: true, biometricEnabled: withBiometric, pinHash });
    setLocked(false);
  }, [persist]);

  const disableLock = useCallback(async () => {
    await persist({ enabled: false, biometricEnabled: false, pinHash: null });
    setLocked(false);
  }, [persist]);

  const setBiometricEnabled = useCallback(async (on: boolean) => {
    await persist({ enabled: true, biometricEnabled: on, pinHash: pinHashRef.current });
  }, [persist]);

  const verifyAndUnlock = useCallback(async (pin: string): Promise<boolean> => {
    const h = await hashPin(pin);
    if (h === pinHashRef.current) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const tryBiometric = useCallback(async (): Promise<boolean> => {
    if (!biometricAvailable || !biometricEnabled) return false;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock CA in Your Pocket',
        disableDeviceFallback: false,
      });
      if (res.success) {
        setLocked(false);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [biometricAvailable, biometricEnabled]);

  const lockNow = useCallback(() => {
    if (enabled) setLocked(true);
  }, [enabled]);

  const value = useMemo(
    () => ({
      loaded, enabled, locked, biometricEnabled, biometricAvailable,
      enableLock, disableLock, setBiometricEnabled, verifyAndUnlock, tryBiometric, lockNow,
    }),
    [loaded, enabled, locked, biometricEnabled, biometricAvailable, enableLock, disableLock, setBiometricEnabled, verifyAndUnlock, tryBiometric, lockNow],
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}
