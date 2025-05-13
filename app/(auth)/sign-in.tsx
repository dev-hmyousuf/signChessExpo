import * as React from "react";
import { View, Image, Text, SafeAreaView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { useSSO } from "@/lib/clerk";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME, SPACING, BORDER_RADIUS } from "@/app/utils/theme";

// Handle any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const { startSSOFlow } = useSSO();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Use standard Expo redirect URI
      const redirectUrl = AuthSession.makeRedirectUri();
      
      // This initiates the OAuth flow with Google
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      console.log("OAuth flow result:", JSON.stringify(result));

      // If we get a createdSessionId, authentication was successful
      if (result.createdSessionId) {
        await result.setActive!({ session: result.createdSessionId });
        router.replace("/(home)");
      } 
      // For new users that need to complete sign-up
      else if (result.signUp) {
        console.log("New user - completing sign-up");
        
        try {
          // Generate a temporary username with clerk_{name} pattern
          let nameBase = result.signUp.firstName?.toLowerCase() || '';
          // Remove special characters and spaces
          nameBase = nameBase.replace(/[^a-z0-9]/g, '');
          
          // If no name is available, use a random number
          const tempUsername = nameBase ? 
            `clerk_${nameBase}` : 
            `clerk_user${Math.floor(Math.random() * 1000000)}`;
          
          // Complete sign-up with temporary username
          const signUpAttempt = await result.signUp.update({
            username: tempUsername
          });
          
          console.log("Sign-up completed:", signUpAttempt.status);
          
          if (signUpAttempt.status === "complete") {
            await result.setActive!({ session: signUpAttempt.createdSessionId });
            
            // Still redirect to username setup
            router.replace("/onboarding/username");
          } else {
            console.log("Additional sign-up steps required:", signUpAttempt);
            setError("Additional steps required. Please try again.");
          }
        } catch (signUpError) {
          console.error("Sign-up error:", signUpError);
          setError("Failed to complete sign-up. Please try again.");
        }
      }
      // For existing users that need to complete sign-in
      else if (result.signIn) {
        console.log("Existing user - completing sign-in");
        try {
          const signInResult = await result.signIn.create({
            strategy: "oauth_google",
            redirectUrl,
          });
          
          if (signInResult.status === "complete") {
            await result.setActive!({ session: signInResult.createdSessionId });
            router.replace("/(home)");
          } else {
            console.log("Additional sign-in steps required:", signInResult);
            setError("Additional steps required. Please try again.");
          }
        } catch (signInError) {
          console.error("Sign-in error:", signInError);
          setError("Failed to complete sign-in. Please try again.");
        }
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Failed to authenticate with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.light} />
      <LinearGradient
        colors={[THEME.light, THEME.white]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue to your account</Text>
            
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={THEME.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.googleButton}
              onPress={handleGoogleAuth}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={THEME.white} />
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Image 
                      source={require('@/assets/images/google-logo.png')} 
                      style={styles.googleIcon}
                    />
                  </View>
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our{' '}
              <Text style={styles.footerLink}>Terms of Service</Text> and{' '}
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  header: {
    width: '100%',
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.xl,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: THEME.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    width: '100%',
  },
  errorText: {
    color: THEME.danger,
    marginLeft: SPACING.sm,
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    width: '100%',
    height: 56,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  googleIconContainer: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: THEME.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: THEME.textLight,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: THEME.primary,
    fontWeight: '500',
  },
});