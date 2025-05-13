import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { THEME } from '@/app/utils/theme';

export default function ProfileIndex() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    // Wait for Clerk user to load
    if (!isLoaded) return;

    // If user is loaded and has a username, redirect to their profile
    if (user?.username) {
      // Navigate to the user's profile by username
      router.replace(`/profile/${user.username}`);
    }
  }, [user, isLoaded, router]);

  // Show loading while redirecting
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={THEME.primary} />
      <Text style={{ marginTop: 16, color: THEME.textSecondary }}>
        Loading your profile...
      </Text>
    </View>
  );
} 