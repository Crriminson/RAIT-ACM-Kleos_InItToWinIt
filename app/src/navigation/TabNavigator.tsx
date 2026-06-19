import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, FileText, MessageSquare, User } from 'lucide-react-native';
import { colors, typography } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { TabParamList } from './types';

import UploadScreen from '../screens/UploadScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AskCaScreen from '../screens/AskCaScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  const { t } = useI18n();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: {
          ...typography.label,
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          shadowColor: '#1A2B4A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={UploadScreen}
        options={{
          tabBarLabel: t.tabs.home,
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: t.tabs.reports,
          tabBarIcon: ({ color, size }) => (
            <FileText size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AskCa"
        component={AskCaScreen}
        options={{
          tabBarLabel: t.tabs.askCa,
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t.tabs.profile,
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
