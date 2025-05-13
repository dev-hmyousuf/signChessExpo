import React from 'react';
import { Stack } from 'expo-router';
import { THEME } from '@/app/utils/theme';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.white,
        },
        headerTintColor: THEME.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'My Profile',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[username]"
        options={{
          // Dynamic title will be set in the component
          headerTitle: 'Player Profile',
          headerShown: false,
        }}
      />
    </Stack>
  );
} 