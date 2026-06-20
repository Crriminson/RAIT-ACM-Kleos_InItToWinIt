import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Base URL for the AI backend (backend/ — FastAPI on port 8000).
 *
 * Resolution order:
 * 1. EXPO_PUBLIC_AI_API_URL env var (set this for a deployed server).
 * 2. Auto-derived from the Expo dev host — uses the dev machine's LAN IP
 *    on port 8000, so a physical device on the same WiFi can reach it.
 * 3. localhost:8000 (web / simulator fallback).
 */
const AI_SERVER_PORT = 8000;

function deriveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_AI_API_URL;
  if (envUrl && envUrl.trim() !== '') return envUrl.replace(/\/$/, '');

  // hostUri looks like "192.168.0.112:8081" in dev.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ||
    '';

  const host = String(hostUri).split(':')[0];
  if (host && host !== 'localhost') {
    return `http://${host}:${AI_SERVER_PORT}`;
  }

  // Android emulator can't see host "localhost"; 10.0.2.2 maps to it.
  if (Platform.OS === 'android') return `http://10.0.2.2:${AI_SERVER_PORT}`;
  return `http://localhost:${AI_SERVER_PORT}`;
}

export const AI_API_URL = deriveBaseUrl();

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';
