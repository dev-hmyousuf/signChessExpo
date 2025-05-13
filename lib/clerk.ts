import * as WebBrowser from 'expo-web-browser';
import { ClerkProvider, useAuth, useUser, useSSO } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

// Complete any Clerk auth sessions
WebBrowser.maybeCompleteAuthSession();

// Set your Clerk publishable key
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Secure storage for tokens
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

// Export the props for ClerkProvider to be used in _layout.tsx
export const clerkProviderProps = {
  publishableKey,
  tokenCache,
};

// Export the Clerk hooks
export {
  ClerkProvider,
  useAuth,
  useUser,
  useSSO
};

export default {}; 