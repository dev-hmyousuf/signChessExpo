import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { ClerkProvider } from '@clerk/clerk-expo';
import { clerkProviderProps, useAuth, useUser } from '@/lib/clerk';
import { useFonts } from 'expo-font';
import { THEME, TYPOGRAPHY } from '@/app/utils/theme';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { databases, APPWRITE_DATABASE_ID, COLLECTION_USERS, ID } from '@/lib/appwrite';
import { Query } from 'react-native-appwrite';
import { AppwriteUser, syncClerkUserToAppwrite } from '@/lib/clerkAuth';

// Keep the splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

// Call this once in your app to handle OAuth redirects
// This is crucial for the OAuth flow to work properly
WebBrowser.maybeCompleteAuthSession();

// Wrapper component to handle authentication
function AppContent() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isMounted = useRef(false);
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  
  // Set mounted flag after initial render
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Sync Clerk user to Appwrite database when signed in
  useEffect(() => {
    const syncUserToDatabase = async () => {
      if (isLoaded && isSignedIn && clerkUser) {
        try {
          // Use the utility function instead of implementing the logic here
          await syncClerkUserToAppwrite(clerkUser);
        } catch (error) {
          console.error('Error syncing user data to database:', error);
        }
      }
    };
    
    syncUserToDatabase();
  }, [isLoaded, isSignedIn, clerkUser]);
  
  // Handle authentication and redirection
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip auth check if already in auth route
        if (pathname.startsWith('/(auth)')) {
          setIsCheckingAuth(false);
          return;
        }
        
        // Wait for Clerk to be loaded
        if (!isLoaded) {
          return;
        }
        
        // Log authentication status
        console.log('Authentication state:', { 
          isSignedIn, 
          hasUsername: clerkUser?.username ? true : false,
          currentPath: pathname
        });
        
        // If not authenticated, redirect to sign-in
        if (!isSignedIn && isMounted.current) {
          console.log('User not authenticated with Clerk, redirecting to sign-in');
          setTimeout(() => {
            router.replace('/(auth)/sign-in');
          }, 0);
          return;
        }
        
        // User is signed in
        if (isSignedIn && clerkUser) {
          console.log('User is authenticated with Clerk');
          
          // Check if username is missing - if so, redirect to username setup
          // IMPORTANT: Skip this check only if already on the username setup page
          if (!clerkUser.username && !pathname.includes('/onboarding/username')) {
            console.log('User has no username, redirecting to username setup');
            setTimeout(() => {
              router.replace('/onboarding/username');
            }, 0);
            return;
          }
          
          // Check if user has a temporary username (starts with clerk_)
          if (clerkUser.username && clerkUser.username.startsWith('clerk_') && !pathname.includes('/onboarding/username')) {
            console.log('User has a temporary username, redirecting to username setup');
            setTimeout(() => {
              router.replace('/onboarding/username');
            }, 0);
            return;
          }
          
          // If user has username but is on onboarding pages, redirect to home
          if (clerkUser.username && !clerkUser.username.startsWith('clerk_') && pathname.includes('/onboarding')) {
            console.log('User already has permanent username, redirecting from onboarding to home');
            setTimeout(() => {
              router.replace('/(home)');
            }, 0);
            return;
          }
          
          // If user has username and is on the root path, redirect to home
          if (clerkUser.username && !clerkUser.username.startsWith('clerk_') && pathname === '/') {
            console.log('User has permanent username, redirecting to home from root path');
            setTimeout(() => {
              router.replace('/(home)');
            }, 0);
            return;
          }
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
      } finally {
        if (isMounted.current) {
          setIsCheckingAuth(false);
        }
      }
    };

    // Use a short delay before checking auth to ensure component is mounted
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [pathname, isLoaded, isSignedIn, clerkUser]);

  if (isCheckingAuth || !isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.light }}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={THEME.white} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  return (
    <ClerkProvider {...clerkProviderProps}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: THEME.light }}>
          <AppContent />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}
