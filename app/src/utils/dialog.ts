import { Alert, Platform } from 'react-native';

/**
 * Cross-platform dialogs.
 *
 * React Native Web does NOT implement `Alert.alert` — it silently does nothing.
 * That makes any button gated behind a confirmation appear broken in the web
 * build. These helpers fall back to the browser's `window.confirm`/`window.alert`
 * on web and use the native `Alert` on iOS/Android.
 */

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** Yes/no confirmation. Calls `onConfirm` only if the user accepts. */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  opts: ConfirmOptions = {},
): void {
  const { confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false } = opts;

  if (Platform.OS === 'web') {
    const accepted =
      typeof window === 'undefined' ||
      window.confirm(message ? `${title}\n\n${message}` : title);
    if (accepted) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Informational message (single dismiss). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
