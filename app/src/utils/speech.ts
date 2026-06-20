import * as Speech from 'expo-speech';

/**
 * Text-to-speech ("read aloud") for diagnosis cards.
 *
 * Robustness: many devices lack Hindi or Marathi voice data. We enumerate
 * installed voices, pick the best match, and fall back through:
 *   Marathi → Hindi → English (never silently dead).
 */

export interface SpeakHandlers {
  onStart?: () => void;
  onDone?: () => void;
  onUnavailable?: () => void;
}

export interface SpeakFallback {
  text: string;
  lang: 'hi' | 'en' | 'mr';
}

let voicesCache: Speech.Voice[] | null = null;

async function loadVoices(): Promise<Speech.Voice[]> {
  if (voicesCache && voicesCache.length) return voicesCache;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (voices && voices.length) voicesCache = voices;
    return voices ?? [];
  } catch {
    return [];
  }
}

function findVoice(voices: Speech.Voice[], prefix: string): Speech.Voice | undefined {
  return voices.find((v) => (v.language || '').toLowerCase().replace('_', '-').startsWith(prefix));
}

function bestVoice(voices: Speech.Voice[], lang: 'hi' | 'en' | 'mr'): { voice: Speech.Voice | undefined; ttsLang: string } {
  if (lang === 'mr') {
    const mr = findVoice(voices, 'mr');
    if (mr) return { voice: mr, ttsLang: 'mr-IN' };
    // Marathi voice missing — use Hindi (same script, very similar pronunciation)
    const hi = findVoice(voices, 'hi');
    if (hi) return { voice: hi, ttsLang: 'hi-IN' };
    return { voice: findVoice(voices, 'en'), ttsLang: 'en-IN' };
  }
  if (lang === 'hi') {
    const hi = findVoice(voices, 'hi');
    if (hi) return { voice: hi, ttsLang: 'hi-IN' };
    return { voice: findVoice(voices, 'en'), ttsLang: 'en-IN' };
  }
  return { voice: findVoice(voices, 'en'), ttsLang: 'en-IN' };
}

function doSpeak(text: string, ttsLang: string, voiceId: string | undefined, handlers: SpeakHandlers): void {
  handlers.onStart?.();
  Speech.speak(text, {
    language: ttsLang,
    voice: voiceId,
    rate: ttsLang.startsWith('en') ? 0.96 : 0.92,
    pitch: 1.0,
    onDone: handlers.onDone,
    onStopped: handlers.onDone,
    onError: handlers.onDone,
  });
}

export async function speak(
  text: string,
  lang: 'hi' | 'en' | 'mr',
  handlers: SpeakHandlers = {},
  fallback?: SpeakFallback,
): Promise<void> {
  Speech.stop();
  const voices = await loadVoices();
  const haveList = voices.length > 0;
  const { voice, ttsLang } = bestVoice(voices, lang);

  // If the exact language voice is missing, signal it but still speak via fallback voice.
  if (haveList && lang !== 'en') {
    const exactPrefix = lang === 'mr' ? 'mr' : 'hi';
    const hasExact = findVoice(voices, exactPrefix) !== undefined;
    if (!hasExact) {
      handlers.onUnavailable?.();
      if (fallback) {
        const fb = bestVoice(voices, fallback.lang);
        doSpeak(fallback.text, fb.ttsLang, fb.voice?.identifier, handlers);
        return;
      }
      // Still try with whatever voice we found (Hindi for Marathi, English for Hindi)
      if (voice) {
        doSpeak(text, ttsLang, voice.identifier, handlers);
        return;
      }
      handlers.onDone?.();
      return;
    }
  }

  doSpeak(text, ttsLang, voice?.identifier, handlers);
}

export function stopSpeaking(): void {
  Speech.stop();
}
