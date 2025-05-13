import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { THEME, TYPOGRAPHY, BORDER_RADIUS } from '@/app/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { syncClerkUserToAppwrite } from '@/lib/clerkAuth';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UsernameSetupScreen() {
  const router = useRouter();
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isTemporaryUsername, setIsTemporaryUsername] = useState(false);

  // Check if user already has a username, if so, check if it's a temporary one
  useEffect(() => {
    if (isLoaded && clerkUser?.username) {
      // Check if it's a temporary username (starts with "clerk_")
      if (clerkUser.username.startsWith('clerk_')) {
        console.log("User has a temporary username, needs to set a permanent one");
        setIsTemporaryUsername(true);
      } else {
        // User already has a proper username, redirect to home
      router.replace('/');
      }
    }
  }, [isLoaded, clerkUser, router]);

  // Validate username (basic validation only, real check happens on submit)
  useEffect(() => {
    // Reset error message
    setErrorMessage('');

    // Check if username meets requirements
    if (username.length < 3) {
      setIsValid(false);
      return;
    }

    // Check if username starts with clerk_ (not allowed for permanent usernames)
    if (username.startsWith('clerk_')) {
      setErrorMessage('Username cannot start with "clerk_". Please choose a different username.');
      setIsValid(false);
      return;
    }

    // Check if username is alphanumeric with underscores allowed
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setErrorMessage('Username can only contain letters, numbers, and underscores');
      setIsValid(false);
      return;
    }

    // Set as valid if all checks pass
    setIsValid(true);
  }, [username]);

  // Function to handle submit
  const handleSubmit = async () => {
    if (!isValid || !username || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      // Try to set the username in Clerk
      try {
        // Set the username in Clerk
        await clerkUser?.update({
          username,
        });

        // Sync the updated data to Appwrite
        await syncClerkUserToAppwrite(clerkUser);

        // Navigate to the home page
        router.replace('/');
      } catch (error: any) {
        // Handle specific error cases
        if (error.message && (
            error.message.includes('username is already taken') || 
            error.message.includes('username already exists') ||
            error.message.includes('identifier already exists')
        )) {
          setErrorMessage('Username is already taken. Please choose another one.');
        } else {
          // Generic error
          console.error('Error setting username:', error);
          setErrorMessage(error?.message || 'Failed to set username');
        }
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      setErrorMessage(error?.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state if Clerk data isn't loaded yet
  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.topSpacer} />
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={64} color={THEME.primary} />
          <Text style={styles.title}>Create Your Username</Text>
          <Text style={styles.subtitle}>
            {isTemporaryUsername 
              ? "You currently have a temporary username starting with 'clerk_'. Please choose a permanent username that you'd like to use."
              : "Choose a unique username that will identify you across the app"}
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <View style={[styles.inputWrapper, errorMessage ? styles.inputError : null]}>
            <Ionicons name="at" size={20} color={THEME.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
            />
            {isChecking ? (
              <ActivityIndicator size="small" color={THEME.primary} />
            ) : isValid ? (
              <Ionicons name="checkmark-circle" size={20} color={THEME.success} />
            ) : username.length > 0 ? (
              <Ionicons name="alert-circle" size={20} color={THEME.danger} />
            ) : null}
          </View>
          
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <Text style={styles.helperText}>
              Username must be at least 3 characters and can only contain letters, numbers, and underscores
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, !isValid || isSubmitting ? styles.buttonDisabled : null]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={THEME.white} />
          ) : (
            <Text style={styles.buttonText}>{isTemporaryUsername ? "Save Username" : "Continue"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutLink}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          }}
        >
          <Text style={styles.signOutText}>Sign out and use another account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.light,
    padding: 16,
    paddingTop: 50,
  },
  topSpacer: {
    height: 30,
  },
  card: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...TYPOGRAPHY.headingLarge,
    color: THEME.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.inputBackground,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  inputError: {
    borderColor: THEME.danger,
  },
  input: {
    flex: 1,
    height: 48,
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.textPrimary,
    marginLeft: 8,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: THEME.danger,
    marginTop: 8,
  },
  helperText: {
    ...TYPOGRAPHY.bodySmall,
    color: THEME.textSecondary,
    marginTop: 8,
  },
  button: {
    backgroundColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: THEME.disabled,
  },
  buttonText: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: THEME.white,
  },
  signOutLink: {
    alignItems: 'center',
    padding: 8,
  },
  signOutText: {
    ...TYPOGRAPHY.bodySmall,
    color: THEME.textSecondary,
    textDecorationLine: 'underline',
  },
}); 