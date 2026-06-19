import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { I18nProvider } from './src/i18n/context';
import { SessionProvider } from './src/data/contexts/session-context';
import { ProfileProvider } from './src/data/contexts/profile-context';
import { LockProvider, useLock } from './src/data/contexts/lock-context';
import AppNavigator from './src/navigation/AppNavigator';
import LockScreen from './src/screens/LockScreen';

function LockGate({ children }: { children: React.ReactNode }) {
  const { loaded, enabled, locked } = useLock();
  if (!loaded) return null;
  if (enabled && locked) return <LockScreen />;
  return <>{children}</>;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <LockProvider>
          <ProfileProvider>
            <SessionProvider>
              <LockGate>
                <NavigationContainer>
                  <StatusBar style="dark" />
                  <AppNavigator />
                </NavigationContainer>
              </LockGate>
            </SessionProvider>
          </ProfileProvider>
        </LockProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
