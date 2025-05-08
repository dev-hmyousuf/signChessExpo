import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@/app/utils/theme';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const onSignInPress = async () => {
    if (!isLoaded) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });
      
      // Check if signIn requires more steps
      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/');
      } else {
        console.log('Sign in attempt not complete', signInAttempt);
        setError('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Error during sign in:', err);
      setError(err.errors?.[0]?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  return (
    <LinearGradient
      colors={[THEME.primaryTransparent, THEME.light]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Cricket Dynasty</Text>
            <Text style={styles.tagline}>Sign in to your account</Text>
          </View>
          
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={THEME.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={THEME.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={THEME.mediumGray}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={THEME.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={THEME.mediumGray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity onPress={togglePasswordVisibility} style={styles.visibilityToggle}>
                <Ionicons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color={THEME.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.signInButton, loading && styles.signInButtonDisabled]}
            onPress={onSignInPress}
            disabled={loading || !emailAddress || !password}
          >
            {loading ? (
              <ActivityIndicator color={THEME.white} />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/sign-up')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appName: {
    ...TYPOGRAPHY.headingLarge,
    color: THEME.primary,
    marginBottom: 8,
  },
  tagline: {
    ...TYPOGRAPHY.bodyLarge,
    color: THEME.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.danger,
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: THEME.white,
    paddingHorizontal: 12,
    ...SHADOWS.small,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    ...TYPOGRAPHY.bodyLarge,
    flex: 1,
    paddingVertical: 12,
    color: THEME.textPrimary,
  },
  visibilityToggle: {
    padding: 8,
  },
  signInButton: {
    backgroundColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  signInButtonDisabled: {
    backgroundColor: THEME.primaryLight,
    opacity: 0.7,
  },
  signInButtonText: {
    ...TYPOGRAPHY.button,
    color: THEME.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.textSecondary,
  },
  signUpLink: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: THEME.primary,
    marginLeft: 4,
  },
});
