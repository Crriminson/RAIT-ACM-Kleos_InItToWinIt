import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import strings, { Language, Strings } from './strings';

const STORAGE_KEY = '@kleos/lang';

interface I18nContextValue {
  lang: Language;
  t: Strings;
  setLang: (lang: Language) => void;
  toggle: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('hi');
  const [loaded, setLoaded] = useState(false);

  // Load the saved language once on startup.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'hi' || saved === 'en') setLangState(saved);
      } catch {
        // fall back to default
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next: Language) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setLang = useCallback((next: Language) => persist(next), [persist]);
  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'hi' ? 'en' : 'hi';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ lang, t: strings[lang], setLang, toggle }),
    [lang, setLang, toggle],
  );

  // Avoid a flash of the default language before the saved one loads.
  if (!loaded) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
