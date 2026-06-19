import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

interface PickedLike {
  uri: string;
  file?: unknown; // browser File on web
}

/**
 * Read a picked document as UTF-8 text, cross-platform.
 * Web: the picker hands back a browser File/Blob (or a blob: URI we can fetch).
 * Native: try the new File API, then the legacy reader; surface a real error if both fail.
 */
export async function readAssetText(asset: PickedLike): Promise<string> {
  const webFile = asset.file as { text?: () => Promise<string> } | undefined;
  if (webFile && typeof webFile.text === 'function') {
    return webFile.text();
  }
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    return res.text();
  }

  const attempts: string[] = [];
  // Legacy reader first — it goes through ContentResolver and can read content:// URIs.
  try {
    return await readAsStringAsync(asset.uri);
  } catch (e: any) {
    attempts.push(`legacy: ${e?.message ?? e}`);
  }
  try {
    return await new File(asset.uri).text();
  } catch (e: any) {
    attempts.push(`File API: ${e?.message ?? e}`);
  }
  throw new Error(`${attempts.join(' | ')} | uri=${asset.uri}`);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  if (typeof btoa !== 'undefined') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
}

/** Convert a Blob to a base64 string via FileReader (works in RN and on web). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => {
      const s = typeof reader.result === 'string' ? reader.result : '';
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s); // strip "data:...;base64,"
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Read a file as base64, cross-platform (used for invoice → AI vision).
 *
 * Native reading is brittle across devices: Expo Go on Android/MIUI can reject
 * a direct FileSystem read of a picked file with "isn't readable". So we try
 * several strategies in order and use whichever succeeds.
 */
export async function readAssetBase64(asset: PickedLike): Promise<string> {
  const webFile = asset.file as Blob | undefined;
  if (Platform.OS === 'web' || (webFile && typeof (webFile as any).arrayBuffer === 'function')) {
    const blob: Blob = webFile ?? (await (await fetch(asset.uri)).blob());
    const buf = await blob.arrayBuffer();
    return arrayBufferToBase64(buf);
  }

  const attempts: string[] = [];

  // 1) fetch → blob → base64. RN's networking reads file:// and content://
  //    URIs even when the FileSystem APIs refuse the cached copy.
  try {
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    return await blobToBase64(blob);
  } catch (e: any) {
    attempts.push(`fetch: ${e?.message ?? e}`);
  }

  // 2) New File API.
  try {
    return await new File(asset.uri).base64();
  } catch (e: any) {
    attempts.push(`File API: ${e?.message ?? e}`);
  }

  // 3) Legacy reader (goes through ContentResolver — best for content:// URIs).
  try {
    return await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
  } catch (e: any) {
    attempts.push(`legacy: ${e?.message ?? e}`);
  }

  throw new Error(`Could not read file as base64 | ${attempts.join(' | ')} | uri=${asset.uri}`);
}
