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
  Alert,
} from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@/app/utils/theme';

export default function SignUpScreen() {
  const { signUp, isLoaded } = useSignUp();
  const router = useRouter();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const onSignUpPress = async () => {
    if (!isLoaded) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Start the sign-up process with email, password, and name
      await signUp.create({
        firstName,
        lastName,
        emailAddress,
        password,
      });
      
      // Send verification email
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      
      // Set pending verification to true to show verification UI
      setPendingVerification(true);
    } catch (err) {
      console.error('Error during sign up:', err);
      setError(err.errors?.[0]?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const isFormValid = firstName && lastName && emailAddress && password.length >= 8;
  
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
            <Text style={styles.tagline}>Create your account</Text>
          </View>
          
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={THEME.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>First Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={THEME.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor={THEME.mediumGray}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!loading && !pendingVerification}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Last Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={THEME.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your last name"
                placeholderTextColor={THEME.mediumGray}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!loading && !pendingVerification}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={THEME.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your email address"
                placeholderTextColor={THEME.mediumGray}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading && !pendingVerification}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={THEME.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Create a password (min. 8 characters)"
                placeholderTextColor={THEME.mediumGray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading && !pendingVerification}
              />
              <TouchableOpacity onPress={togglePasswordVisibility} style={styles.visibilityToggle}>
                <Ionicons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color={THEME.textSecondary} 
                />
              </TouchableOpacity>
            </View>
            {password && password.length < 8 && (
              <Text style={styles.passwordHint}>Password must be at least 8 characters</Text>
            )}
          </View>
          
          <TouchableOpacity
            style={[
              styles.signUpButton, 
              (!isFormValid || loading || pendingVerification) && styles.signUpButtonDisabled
            ]}
            onPress={onSignUpPress}
            disabled={!isFormValid || loading || pendingVerification}
          >
            {loading ? (
              <ActivityIndicator color={THEME.white} />
            ) : (
              <Text style={styles.signUpButtonText}>
                {pendingVerification ? 'Verification Email Sent' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
          
          {pendingVerification && (
            <View style={styles.verificationContainer}>
              <Ionicons name="mail" size={24} color={THEME.primary} />
              <Text style={styles.verificationTitle}>Verify your email</Text>
              <Text style={styles.verificationText}>
                We've sent a verification code to {emailAddress}. 
                Please check your inbox and verify your email to continue.
              </Text>
              <TouchableOpacity 
                style={styles.openEmailButton}
                onPress={() => {
                  Alert.alert(
                    'Verification Required',
                    'Please verify your email before continuing. Check your email for a verification link.'
                  );
                }}
              >
                <Text style={styles.openEmailButtonText}>Open Email App</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/sign-in')}>
              <Text style={styles.signInLink}>Sign In</Text>
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
  passwordHint: {
    ...TYPOGRAPHY.bodySmall,
    color: THEME.warning,
    marginTop: 4,
    marginLeft: 4,
  },
  signUpButton: {
    backgroundColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  signUpButtonDisabled: {
    backgroundColor: THEME.primaryLight,
    opacity: 0.7,
  },
  signUpButtonText: {
    ...TYPOGRAPHY.button,
    color: THEME.white,
  },
  verificationContainer: {
    backgroundColor: THEME.primaryTransparent,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  verificationTitle: {
    ...TYPOGRAPHY.headingSmall,
    color: THEME.primary,
    marginTop: 8,
    marginBottom: 8,
  },
  verificationText: {
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  openEmailButton: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  openEmailButtonText: {
    ...TYPOGRAPHY.button,
    color: THEME.primary,
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
  signInLink: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
    color: THEME.primary,
    marginLeft: 4,
  },
});
