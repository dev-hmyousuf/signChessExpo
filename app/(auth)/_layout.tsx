import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { THEME } from '@/app/utils/theme';
import { useUser } from '@/lib/clerk';

export default function AuthLayout() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Redirect href="/(home)" />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: THEME.white,
          },
          headerTintColor: THEME.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="sign-in"
          options={{
            title: 'Sign In',
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
  },
});
