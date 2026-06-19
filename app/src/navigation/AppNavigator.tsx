import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { RootStackParamList } from './types';

import SplashScreen from '../screens/SplashScreen';
import OnboardingWalkthroughScreen from '../screens/OnboardingWalkthroughScreen';
import TabNavigator from './TabNavigator';
import ReviewScreen from '../screens/ReviewScreen';
import ProcessingScreen from '../screens/ProcessingScreen';
import DiagnosisScreen from '../screens/DiagnosisScreen';
import CameraScreen from '../screens/CameraScreen';
import HistoryScreen from '../screens/HistoryScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import GstinSetupScreen from '../screens/GstinSetupScreen';
import AiInsightsScreen from '../screens/AiInsightsScreen';
import Portal2BScreen from '../screens/Portal2BScreen';
import CompareScreen from '../screens/CompareScreen';
import LockSetupScreen from '../screens/LockSetupScreen';
import WhatsAppDemoScreen from '../screens/WhatsAppDemoScreen';
import ImsWalkthroughScreen from '../screens/ImsWalkthroughScreen';
import EarlyWarningScreen from '../screens/EarlyWarningScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen
        name="OnboardingWalkthrough"
        component={OnboardingWalkthroughScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="GstinSetup" component={GstinSetupScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen
        name="Processing"
        component={ProcessingScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="Results"
        component={DiagnosisScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <Stack.Screen name="AiInsights" component={AiInsightsScreen} />
      <Stack.Screen name="Portal2B" component={Portal2BScreen} />
      <Stack.Screen name="Compare" component={CompareScreen} />
      <Stack.Screen name="LockSetup" component={LockSetupScreen} />
      <Stack.Screen
        name="WhatsAppDemo"
        component={WhatsAppDemoScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen name="ImsWalkthrough" component={ImsWalkthroughScreen} />
      <Stack.Screen name="EarlyWarning" component={EarlyWarningScreen} />
    </Stack.Navigator>
  );
}
