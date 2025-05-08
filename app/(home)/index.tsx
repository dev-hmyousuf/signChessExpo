import React, { useState, useEffect } from 'react';
import { Link } from 'expo-router';
import { Text, View, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { account, isLoggedIn, getCurrentSession, logout, getCountries } from '@/lib/appwrite';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@/app/utils/theme';

export default function Page() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [hasCountries, setHasCountries] = useState(true);

  useEffect(() => {
    const checkAuthAndLoadUser = async () => {
      try {
        const authStatus = await isLoggedIn();
        setAuthenticated(authStatus);
        
        if (authStatus) {
          const userData = await account.get();
          setUser(userData);
          
          // Check if countries exist
          try {
            const countries = await getCountries();
            setHasCountries(countries && countries.length > 0);
          } catch (error) {
            console.error("Error checking countries:", error);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthAndLoadUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await logout();
      setAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Render authenticated user view
  const renderAuthenticatedView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back</Text>
        <Text style={styles.nameText}>
          {user?.name || user?.email}
        </Text>
      </View>

      {!hasCountries && (
        <TouchableOpacity 
          style={styles.noDataBanner}
          onPress={() => Link.push('/add-data')}
        >
          <View style={styles.noDataBannerContent}>
            <Ionicons name="alert-circle" size={24} color={THEME.white} />
            <View style={styles.noDataBannerText}>
              <Text style={styles.noDataBannerTitle}>Setup Required</Text>
              <Text style={styles.noDataBannerDescription}>
                Add demo data to start using the app's features
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={THEME.white} />
        </TouchableOpacity>
      )}

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Image 
            source={{ 
              uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`
            }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Tournaments</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <View style={styles.actionGrid}>
        <Link href="/tournament" asChild>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.iconCircle, { backgroundColor: THEME.primaryTransparent }]}>
              <Ionicons name="trophy" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.actionText}>Tournaments</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/chess" asChild>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.iconCircle, { backgroundColor: THEME.primaryTransparent }]}>
              <Ionicons name="game-controller" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.actionText}>Games</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/chat" asChild>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.iconCircle, { backgroundColor: THEME.primaryTransparent }]}>
              <Ionicons name="chatbubble-ellipses" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.actionText}>Chat</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/profile" asChild>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.iconCircle, { backgroundColor: THEME.primaryTransparent }]}>
              <Ionicons name="person" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.actionText}>Profile</Text>
          </TouchableOpacity>
        </Link>
      </View>
      
      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Developer Tools Link */}
      <Link href="../components/dev-tools" asChild>
        <TouchableOpacity style={styles.devToolsButton}>
          <Ionicons name="construct-outline" size={16} color={THEME.textSecondary} />
          <Text style={styles.devToolsText}>Developer Tools</Text>
        </TouchableOpacity>
      </Link>
    </>
  );

  // Render non-authenticated view
  const renderSignedOutView = () => (
    <View style={styles.signedOutContainer}>
      <Image 
        source={require('@/assets/images/icon.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.signedOutTitle}>Welcome to Cricket Dynasty</Text>
      <Text style={styles.signedOutSubtitle}>Sign in or create an account to get started</Text>
      
      <View style={styles.buttonContainer}>
        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/(auth)/sign-up" asChild>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : authenticated ? (
          renderAuthenticatedView()
        ) : (
          renderSignedOutView()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.light,
  },
  scrollContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: THEME.textPrimary,
    ...TYPOGRAPHY.bodyMedium,
  },
  header: {
    marginBottom: 16,
  },
  welcomeText: {
    ...TYPOGRAPHY.bodyLarge,
    color: THEME.textSecondary,
  },
  nameText: {
    ...TYPOGRAPHY.headingLarge,
    color: THEME.textPrimary,
  },
  noDataBanner: {
    backgroundColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    ...SHADOWS.small,
  },
  noDataBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  noDataBannerText: {
    marginLeft: 12,
    flex: 1,
  },
  noDataBannerTitle: {
    color: THEME.white,
    fontWeight: '600',
    ...TYPOGRAPHY.bodyLarge,
  },
  noDataBannerDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    ...TYPOGRAPHY.bodyMedium,
  },
  profileCard: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 24,
    ...SHADOWS.small,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.lightGray,
  },
  profileInfo: {
    marginLeft: 16,
  },
  profileName: {
    ...TYPOGRAPHY.headingSmall,
    color: THEME.textPrimary,
  },
  profileEmail: {
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.textSecondary,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.headingSmall,
    color: THEME.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: THEME.textSecondary,
  },
  divider: {
    width: 1,
    backgroundColor: THEME.lightGray,
    marginHorizontal: 8,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headingSmall,
    color: THEME.textPrimary,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionCard: {
    width: '48%',
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOWS.small,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    ...TYPOGRAPHY.bodyMedium,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: 16,
  },
  signOutText: {
    color: THEME.danger,
    fontWeight: '600',
    ...TYPOGRAPHY.bodyMedium,
  },
  devToolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  devToolsText: {
    ...TYPOGRAPHY.bodySmall,
    color: THEME.textSecondary,
    marginLeft: 8,
  },
  signedOutContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 500,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  signedOutTitle: {
    ...TYPOGRAPHY.headingLarge,
    color: THEME.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  signedOutSubtitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  primaryButtonText: {
    color: THEME.white,
    fontWeight: '600',
    ...TYPOGRAPHY.bodyLarge,
  },
  secondaryButton: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  secondaryButtonText: {
    color: THEME.primary,
    fontWeight: '600',
    ...TYPOGRAPHY.bodyLarge,
  },
});
