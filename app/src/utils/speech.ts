import * as Speech from 'expo-speech';

/**
 * Text-to-speech ("read aloud") for diagnosis cards.
 *
 * Persona: a low-English-comfort kirana owner. Reading a verdict aloud in
 * Hindi is far more accessible than expecting them to read it.
 *
 * Robustness note: many devices (notably MIUI/Xiaomi) ship without Hindi voice
 * data, so the TTS engine silently plays nothing when asked for `hi-IN`. We
 * therefore enumerate installed voices, pick a real Hindi voice when present,
 * and otherwise fall back to English audio + an `onUnavailable` signal so the
 * UI can prompt the user to install the Hindi voice.
 */

export interface SpeakHandlers {
  onStart?: () => void;
  onDone?: () => void;
  /** Fired when the requested language has no installed voice on this device. */
  onUnavailable?: () => void;
}

export interface SpeakFallback {
  text: string;
  lang: 'hi' | 'en';
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

function findVoice(voices: Speech.Voice[], lang: 'hi' | 'en'): Speech.Voice | undefined {
  const prefix = lang === 'hi' ? 'hi' : 'en';
  return voices.find((v) => (v.language || '').toLowerCase().replace('_', '-').startsWith(prefix));
}

function doSpeak(text: string, lang: 'hi' | 'en', voiceId: string | undefined, handlers: SpeakHandlers): void {
  handlers.onStart?.();
  Speech.speak(text, {
    language: lang === 'hi' ? 'hi-IN' : 'en-IN',
    voice: voiceId,
    rate: lang === 'hi' ? 0.92 : 0.96,
    pitch: 1.0,
    onDone: handlers.onDone,
    onStopped: handlers.onDone,
    onError: handlers.onDone,
  });
}

/**
 * Speak `text` in `lang`. If `lang` has no installed voice, fire
 * `handlers.onUnavailable` and (if provided) read `fallback` instead so the
 * button is never silently dead.
 */
export async function speak(
  text: string,
  lang: 'hi' | 'en',
  handlers: SpeakHandlers = {},
  fallback?: SpeakFallback,
): Promise<void> {
  Speech.stop();
  const voices = await loadVoices();
  const haveList = voices.length > 0;
  const primaryVoice = findVoice(voices, lang);

  // Only treat as "unavailable" when we successfully enumerated voices and the
  // requested language is genuinely absent. If we couldn't enumerate, just try.
  if (haveList && !primaryVoice && lang === 'hi') {
    handlers.onUnavailable?.();
    if (fallback) {
      doSpeak(fallback.text, fallback.lang, findVoice(voices, fallback.lang)?.identifier, handlers);
    } else {
      handlers.onDone?.();
    }
    return;
  }

  doSpeak(text, lang, primaryVoice?.identifier, handlers);
}

/** Stop any current speech. */
export function stopSpeaking(): void {
  Speech.stop();
}
