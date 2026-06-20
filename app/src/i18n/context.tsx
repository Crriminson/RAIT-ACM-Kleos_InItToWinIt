import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import strings, { Language, Strings } from './strings';

const STORAGE_KEY = '@kleos/lang';

const LANG_CYCLE: Language[] = ['hi', 'en', 'mr'];

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

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'hi' || saved === 'en' || saved === 'mr') setLangState(saved);
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
      const idx = LANG_CYCLE.indexOf(prev);
      const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ lang, t: strings[lang], setLang, toggle }),
    [lang, setLang, toggle],
  );

  if (!loaded) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
