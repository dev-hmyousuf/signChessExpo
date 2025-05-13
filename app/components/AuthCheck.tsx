import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsLoggedIn, useCompleteUser } from '@/lib/clerkAuth';
import { THEME } from '@/app/utils/theme';

/**
 * AuthCheck Component
 * Wraps children and only renders them if user is authenticated
 * Otherwise redirects to login page or shows loading indicator
 */
export const AuthCheck = ({ 
  children, 
  fallback, 
  redirectTo = '/(auth)/sign-in' 
}: { 
  children: React.ReactNode, 
  fallback?: React.ReactNode, 
  redirectTo?: string 
}) => {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useIsLoggedIn();
  
  useEffect(() => {
    // If not loading and not logged in, redirect
    if (!isLoading && !isLoggedIn) {
      console.log('AuthCheck: User not logged in, redirecting');
      router.replace(redirectTo);
    }
  }, [isLoading, isLoggedIn, redirectTo]);
  
  // Show loading indicator while checking auth
  if (isLoading) {
    return fallback || (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.text}>Checking authorization...</Text>
      </View>
    );
  }
  
  // Show children only if logged in
  return isLoggedIn ? <>{children}</> : null;
};

/**
 * AdminCheck Component
 * Only renders children if user is an admin
 * Otherwise redirects or shows unauthorized message
 */
export const AdminCheck = ({
  children,
  fallback,
  redirectTo = '/'
}: {
  children: React.ReactNode,
  fallback?: React.ReactNode,
  redirectTo?: string
}) => {
  const router = useRouter();
  const { isLoaded, appwriteUser } = useCompleteUser();
  
  useEffect(() => {
    // Only check after user data is loaded
    if (isLoaded && appwriteUser) {
      const isAdmin = appwriteUser.role === 'admin';
      const isDynastyAdmin = appwriteUser.role === 'dynasty_admin';
      
      if (!isAdmin && !isDynastyAdmin) {
        console.log('AdminCheck: User is not an admin, redirecting');
        router.replace(redirectTo);
      }
    }
  }, [isLoaded, appwriteUser, redirectTo]);
  
  // Show loading indicator while checking
  if (!isLoaded) {
    return fallback || (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.text}>Checking admin privileges...</Text>
      </View>
    );
  }
  
  // Check admin status
  if (appwriteUser) {
    const isAdmin = appwriteUser.role === 'admin';
    const isDynastyAdmin = appwriteUser.role === 'dynasty_admin';
    
    // Show children only if admin
    return (isAdmin || isDynastyAdmin) ? <>{children}</> : (
      fallback || (
        <View style={styles.container}>
          <Text style={styles.errorText}>You don't have admin privileges</Text>
        </View>
      )
    );
  }
  
  // No user data
  return fallback || (
    <View style={styles.container}>
      <Text style={styles.errorText}>User data not available</Text>
    </View>
  );
};

// Example usage:
// <AuthCheck>
//   <YourProtectedComponent />
// </AuthCheck>
//
// <AdminCheck>
//   <YourAdminDashboard />
// </AdminCheck>

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: THEME.darkGray,
  },
  errorText: {
    fontSize: 16,
    color: THEME.danger,
    textAlign: 'center',
  },
});

export default AuthCheck; 