import { useFonts } from 'expo-font'
import { Slot } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { account, getCurrentSession } from '@/lib/appwrite';
import { THEME } from '@/app/utils/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

// Wrapper component to handle Appwrite auth
function AppContent() {
  useEffect(() => {
    const initAppwrite = async () => {
      try {
        // Check if we have an existing session first
        const session = await getCurrentSession();
        
        if (session) {
          console.log('Already authenticated with Appwrite, session:', session.$id);
        } else {
          console.log('No authenticated Appwrite session found');
        }
        
        console.log('Appwrite initialized');
      } catch (error) {
        console.error('Failed to initialize Appwrite:', error);
      }
    };

    initAppwrite();
  }, []);

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
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: THEME.light }}>
        <AppContent />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
