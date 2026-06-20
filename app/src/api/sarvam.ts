/**
 * Sarvam AI API client — Speech-to-Text and Translation.
 *
 * STT:       Records audio → sends to Sarvam → returns transcribed text.
 * Translate: Translates AI-generated text (en/hi) → Marathi.
 *
 * API docs: https://docs.sarvam.ai
 */
import { Platform } from 'react-native';

const SARVAM_API_URL = 'https://api.sarvam.ai';
const SARVAM_API_KEY = process.env.EXPO_PUBLIC_SARVAM_KEY ?? '';

type SarvamLang = 'hi-IN' | 'en-IN' | 'mr-IN';

// ── Speech-to-Text ─────────────────────────────────────────────────────────
// expo-av is lazily imported to avoid crashing on web where the native module
// doesn't exist.  STT is only available on native (Android/iOS).

let _Audio: any = null;
let _FileSystem: any = null;
let recording: any = null;

async function getAudio() {
  if (!_Audio) {
    const mod = await import('expo-av');
    _Audio = mod.Audio;
  }
  return _Audio;
}

async function getFileSystem() {
  if (!_FileSystem) {
    _FileSystem = await import('expo-file-system');
  }
  return _FileSystem;
}

export function isSttAvailable(): boolean {
  return Platform.OS !== 'web';
}

export async function startRecording(): Promise<void> {
  if (Platform.OS === 'web') throw new Error('STT not available on web');

  const Audio = await getAudio();
  const { granted } = await Audio.requestPermissionsAsync();
  if (!granted) throw new Error('Microphone permission denied');

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  recording = rec;
}

export async function stopRecordingAndTranscribe(
  lang: 'hi' | 'en' | 'mr',
): Promise<string> {
  if (!recording) throw new Error('No recording in progress');

  const Audio = await getAudio();

  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recording.getURI();
  recording = null;

  if (!uri) throw new Error('Recording failed — no audio file');

  const langMap: Record<string, SarvamLang> = {
    hi: 'hi-IN',
    en: 'en-IN',
    mr: 'mr-IN',
  };

  return transcribe(uri, langMap[lang] ?? 'hi-IN');
}

async function transcribe(uri: string, lang: SarvamLang): Promise<string> {
  const FileSystem = await getFileSystem();

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/m4a' });

  return sendToSarvam(blob, lang);
}

async function sendToSarvam(blob: Blob, lang: SarvamLang): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob, 'recording.m4a');
  formData.append('language_code', lang);
  formData.append('model', 'saarika:v2');
  formData.append('with_timestamps', 'false');

  const result = await fetch(`${SARVAM_API_URL}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_API_KEY },
    body: formData,
  });

  if (!result.ok) throw new Error(`Sarvam STT error: ${result.status}`);
  const data = await result.json();
  return data.transcript ?? '';
}

export function isRecording(): boolean {
  return recording !== null;
}

// ── Translation (for AI responses → Marathi) ───────────────────────────────

export async function translateToMarathi(
  text: string,
  sourceLang: 'hi' | 'en' = 'en',
): Promise<string> {
  if (!text.trim() || !SARVAM_API_KEY) return text;

  const sourceCode = sourceLang === 'hi' ? 'hi-IN' : 'en-IN';

  const res = await fetch(`${SARVAM_API_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: JSON.stringify({
      input: text,
      source_language_code: sourceCode,
      target_language_code: 'mr-IN',
      model: 'mayura:v1',
      enable_preprocessing: true,
    }),
  });

  if (!res.ok) throw new Error(`Sarvam translate error: ${res.status}`);
  const data = await res.json();
  return data.translated_text ?? text;
}
