import React, { useState, useEffect } from 'react';
import { Link, useRouter } from 'expo-router';
import { 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Platform,
  Dimensions,
  StatusBar,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';
import { useIsLoggedIn, useCompleteUser } from '@/lib/clerkAuth';
import { useAuth } from '@clerk/clerk-expo';
import { getCountries, databases, APPWRITE_DATABASE_ID, COLLECTION_USERS, COLLECTION_PLAYERS, getPlayerById } from '@/lib/appwrite';
import { Query } from 'react-native-appwrite';

const { width, height } = Dimensions.get('window');

// Add these at the top level after imports
const ROLE_COLORS = {
  organizer: {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    tertiary: '#8B5CF6'
  },
  dynasty_admin: {
    primary: '#10B981',
    secondary: '#059669',
    tertiary: '#047857'
  },
  admin: {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    tertiary: '#8B5CF6'
  },
  moderator: {
    primary: '#0EA5E9',
    secondary: '#0284C7',
    tertiary: '#0369A1'
  },
  default: {
    primary: THEME.primary,
    secondary: '#FF8C3D',
    tertiary: '#FFA366'
  }
};

// Add interface for player data
interface Player {
  $id: string;
  name: string;
  rating: number;
  avatarUrl?: string;
}

export default function Page() {
  const [hasCountries, setHasCountries] = useState(true);
  const [userStats, setUserStats] = useState({
    rating: 0,
    matches: 0,
    wins: 0
  });
  const [isPlayer, setIsPlayer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { isLoggedIn, isLoading } = useIsLoggedIn();
  const { clerkUser, appwriteUser, isLoaded: clerkIsLoaded } = useCompleteUser();
  const { signOut } = useAuth();

  // Add a function to fetch user stats
  const fetchUserStats = async () => {
    if (!clerkUser?.id || !isLoggedIn) return;
    
    try {
      // First get the user data to find the username or userId needed for players collection
      const userDocs = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_USERS,
        [Query.equal('clerkId', clerkUser.id)]
      );
      
      if (userDocs.documents.length > 0) {
        const userData = userDocs.documents[0];
        const userId = userData.$id;
        
        // Now query the players collection using userId
        const playerDocs = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          [Query.equal('userId', userId)]
        );
        
        if (playerDocs.documents.length > 0) {
          // User is a player
          setIsPlayer(true);
          const playerData = playerDocs.documents[0];
          setUserStats({
            rating: playerData.rating || 0,
            matches: playerData.matches || 0,
            wins: playerData.wins || 0
          });
        } else {
          // Not a player
          setIsPlayer(false);
        }
      }
    } catch (error) {
      console.error("Error fetching player stats:", error);
      setIsPlayer(false);
    }
  };

  // Add a function to handle refresh
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchUserStats();
      if (isLoggedIn) {
        const countries = await getCountries() as Array<any>;
        setHasCountries(Array.isArray(countries) && countries.length > 0);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const checkCountries = async () => {
      if (isLoggedIn) {
        try {
          const countries = await getCountries() as Array<any>;
          setHasCountries(Array.isArray(countries) && countries.length > 0);
        } catch (error) {
          console.error("Error checking countries:", error);
        }
      }
    };
    
    checkCountries();
  }, [isLoggedIn]);
  
  // Add effect to fetch user stats when logged in
  useEffect(() => {
    if (isLoggedIn && clerkIsLoaded && clerkUser) {
      fetchUserStats();
    }
  }, [isLoggedIn, clerkIsLoaded, clerkUser]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Render authenticated user view
  const renderAuthenticatedView = () => {
    // Animation fallback components in case modules aren't ready
    const AnimView = Animatable.View || View;
    const Gradient = LinearGradient || View;
    
    // Get role from Clerk or Appwrite user data
    const userRole = appwriteUser?.role || 'user';
    const roleColorSet = 
      userRole === 'organizer' ? ROLE_COLORS.organizer :
      userRole === 'dynasty_admin' ? ROLE_COLORS.dynasty_admin :
      userRole === 'admin' ? ROLE_COLORS.admin :
      userRole === 'moderator' ? ROLE_COLORS.moderator :
      ROLE_COLORS.default;
    
    return (
      <ScrollView 
        contentContainerStyle={styles.authenticatedContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={THEME.primary}
            colors={[THEME.primary]}
            progressViewOffset={20}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        <StatusBar barStyle="light-content" />
        
        {/* Hero Section with Gradient Background */}
        <Gradient
          colors={[roleColorSet.primary, roleColorSet.secondary, roleColorSet.tertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <AnimView 
            animation="fadeIn" 
            duration={800} 
            style={styles.profileHeader}
          >
            {/* Main row with space-between */}
            <View style={styles.profileRow}>
              {/* Avatar on the left */}
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ 
                    uri: clerkUser?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(clerkUser?.fullName || '')}&background=random&color=fff`
                  }}
                  style={styles.avatar}
                />
                
                {/* Role badge on avatar */}
                {userRole && userRole !== 'user' && (
                  <View style={styles.badgeContainer}>
                    <Gradient
                      colors={[roleColorSet.primary, roleColorSet.secondary]}
                      style={styles.badgeGradient}
                    >
                      <Ionicons 
                        name={
                          userRole === 'organizer' ? 'shield-checkmark' :
                          userRole === 'dynasty_admin' ? 'flag' :
                          userRole === 'admin' ? 'shield' :
                          userRole === 'moderator' ? 'shield-half' :
                          'person'
                        } 
                        size={14} 
                        color="#fff" 
                      />
                    </Gradient>
                  </View>
                )}
              </View>

              {/* Name and role badge stacked vertically on the right */}
              <View style={styles.nameContainer}>
                {/* Name */}
                <Text style={styles.nameText}>
                  {clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || 'Cricket Fan'}
                </Text>
                
                {/* Role badge below name */}
                {userRole && userRole !== 'user' && (
                  <View style={styles.roleBadgeContainer}>
                    <Gradient
                      colors={[roleColorSet.primary, roleColorSet.secondary]}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 0}}
                      style={styles.roleBadgeGradient}
                    >
                      <Ionicons 
                        name={
                          userRole === 'organizer' ? 'shield' :
                          userRole === 'dynasty_admin' ? 'flag' :
                          userRole === 'admin' ? 'shield' :
                          userRole === 'moderator' ? 'shield-half' :
                          'person'
                        }
                        size={14}
                        color="#fff"
                        style={{marginRight: 4}}
                      />
                      <Text style={styles.roleBadgeText}>
                        {userRole === 'organizer' ? 'Organizer' :
                         userRole === 'dynasty_admin' ? 'Dynasty Admin' :
                         userRole === 'admin' ? 'Admin' :
                         userRole === 'moderator' ? 'Moderator' :
                         'Player'}
                      </Text>
                    </Gradient>
                  </View>
                )}
              </View>
            </View>
          </AnimView>
        </Gradient>
        
        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Setup Required Banner */}
          {!hasCountries && (
            <AnimView animation="fadeInUp" duration={500} delay={200}>
              <TouchableOpacity 
                style={styles.noDataBanner}
                onPress={() => router.push('/dev-tools')}
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
            </AnimView>
          )}
          
          {/* Stats Cards Row - Only show if user is a player */}
          {isPlayer ? (
            <AnimView 
              animation="fadeInUp" 
              duration={600} 
              delay={300}
              style={styles.statsContainer}
            >
              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Ionicons name="trophy-outline" size={20} color={THEME.primary} />
                </View>
                <Text style={styles.statValue}>{userStats.rating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              
              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="game-controller-outline" size={20} color={THEME.warning} />
                </View>
                <Text style={styles.statValue}>{userStats.matches}</Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
              
              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="ribbon-outline" size={20} color={THEME.success} />
                </View>
                <Text style={styles.statValue}>{userStats.wins}</Text>
                <Text style={styles.statLabel}>Wins</Text>
              </View>
            </AnimView>
          ) : null}
          
          {/* Quick Actions Section */}
          <AnimView 
            animation="fadeInUp" 
            duration={700} 
            delay={400}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.actionGrid}>
              <Link href="/tournament" asChild>
                <TouchableOpacity style={styles.actionCard}>
                  <Gradient
                    colors={[roleColorSet.primary, roleColorSet.secondary]}
                    style={styles.actionIconCircle}
                  >
                    <Ionicons name="trophy" size={24} color={THEME.white} />
                  </Gradient>
                  <Text style={[styles.actionTitle, {color: roleColorSet.primary}]}>Tournaments</Text>
                  <Text style={styles.actionSubtitle}>View all matches</Text>
                </TouchableOpacity>
              </Link>
              
              <Link href="/chess" asChild>
                <TouchableOpacity style={styles.actionCard}>
                  <Gradient
                    colors={userRole === 'user' ? ['#F59E0B', '#D97706'] : [roleColorSet.secondary, roleColorSet.tertiary]}
                    style={styles.actionIconCircle}
                  >
                    <Ionicons name="game-controller" size={24} color={THEME.white} />
                  </Gradient>
                  <Text style={[styles.actionTitle, {color: userRole === 'user' ? '#F59E0B' : roleColorSet.secondary}]}>Games</Text>
                  <Text style={styles.actionSubtitle}>Play online</Text>
                </TouchableOpacity>
              </Link>
              
              <Link href="/chat" asChild>
                <TouchableOpacity style={styles.actionCard}>
                  <Gradient
                    colors={userRole === 'user' ? ['#10B981', '#059669'] : [roleColorSet.tertiary, roleColorSet.primary]}
                    style={styles.actionIconCircle}
                  >
                    <Ionicons name="chatbubble-ellipses" size={24} color={THEME.white} />
                  </Gradient>
                  <Text style={[styles.actionTitle, {color: userRole === 'user' ? '#10B981' : roleColorSet.tertiary}]}>Chat</Text>
                  <Text style={styles.actionSubtitle}>Message players</Text>
                </TouchableOpacity>
              </Link>
              
              <Link href="/profile" asChild>
                <TouchableOpacity style={styles.actionCard}>
                  <Gradient
                    colors={[roleColorSet.secondary, roleColorSet.primary]}
                    style={styles.actionIconCircle}
                  >
                    <Ionicons name="person" size={24} color={THEME.white} />
                  </Gradient>
                  <Text style={[styles.actionTitle, {color: roleColorSet.secondary}]}>Profile</Text>
                  <Text style={styles.actionSubtitle}>Edit details</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </AnimView>
          
          {/* Account Section */}
          <AnimView 
            animation="fadeInUp" 
            duration={800} 
            delay={500}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
            
            <View style={[styles.accountCard, {borderLeftWidth: 3, borderLeftColor: roleColorSet.primary}]}>
              <View style={styles.accountInfo}>
                <View style={{position: 'relative'}}>
                  <Image 
                    source={{ 
                      uri: clerkUser?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(clerkUser?.fullName || '')}&background=random&color=fff`
                    }}
                    style={styles.accountAvatar}
                  />
                  {userRole && userRole !== 'user' && (
                    <View style={styles.accountBadge}>
                      <Gradient 
                        colors={[roleColorSet.primary, roleColorSet.secondary]}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 10,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <Ionicons 
                          name={
                            userRole === 'organizer' ? 'shield-checkmark' :
                            userRole === 'dynasty_admin' ? 'flag' :
                            userRole === 'admin' ? 'shield' :
                            userRole === 'moderator' ? 'shield-half' : 
                            'trophy'
                          }
                          size={12} 
                          color="#fff" 
                        />
                      </Gradient>
                    </View>
                  )}
                </View>
                <View style={styles.accountDetails}>
                  <Text style={styles.accountName}>{clerkUser?.fullName}</Text>
                  <Text style={styles.accountEmail}>{clerkUser?.primaryEmailAddress?.emailAddress}</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <Ionicons name="log-out-outline" size={20} color={THEME.danger} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </AnimView>
          
          {/* Developer Tools Section */}
          <AnimView 
            animation="fadeIn" 
            duration={500} 
            delay={700}
          >
            <Link href="../components/dev-tools" asChild>
              <TouchableOpacity style={styles.devToolsButton}>
                <Ionicons name="construct-outline" size={16} color={THEME.textPrimary} />
                <Text style={styles.devToolsText}>Developer Tools</Text>
              </TouchableOpacity>
            </Link>
          </AnimView>
        </View>
      </ScrollView>
    );
  };

  // Render non-authenticated view
  const renderSignedOutView = () => {
    // Animation fallback components in case modules aren't ready  
    const AnimView = Animatable.View || View;
    const AnimImage = Animatable.Image || Image;
    const Gradient = LinearGradient || View;
    
    // Use default colors for non-authenticated users
    const defaultColors = ROLE_COLORS.default;
    
    return (
      <View style={styles.signedOutContainer}>
        <StatusBar barStyle="light-content" />
        
        <Gradient
          colors={[defaultColors.primary, defaultColors.secondary, defaultColors.tertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.signedOutGradient}
        >
          <AnimView 
            animation="fadeIn" 
            duration={1000} 
            style={styles.signedOutContent}
          >
            <AnimImage 
              animation="pulse" 
              iterationCount="infinite" 
              duration={2000}
              source={require('@/assets/images/icon.png')}
              style={styles.appLogo}
              resizeMode="contain"
            />
            
            <AnimView animation="fadeInUp" delay={300} duration={800}>
              <Text style={styles.appTitle}>Cricket Dynasty</Text>
              <Text style={styles.appSubtitle}>
                Welcome to the premier cricket tournament management platform
              </Text>
            </AnimView>
            
            <AnimView animation="fadeInUp" delay={600} duration={800}>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity style={styles.primaryButton}>
                  <Ionicons name="logo-google" size={20} color={THEME.white} style={{marginRight: 10}} />
                  <Text style={styles.primaryButtonText}>Continue with Google</Text>
                </TouchableOpacity>
              </Link>
              
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={[styles.secondaryButtonText, {color: defaultColors.primary}]}>Sign in with Email</Text>
                </TouchableOpacity>
              </Link>
            </AnimView>
          </AnimView>
        </Gradient>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : isLoggedIn ? (
        renderAuthenticatedView()
      ) : (
        renderSignedOutView()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.light,
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
    fontSize: 16,
    fontWeight: '500',
  },
  // Authenticated View Styles
  authenticatedContainer: {
    paddingBottom: 30,
  },
  heroSection: {
    paddingTop: 30,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileHeader: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarContainer: {
    position: 'relative',
  },
  nameContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeGradient: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.white,
    textAlign: 'right',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  noDataBanner: {
    backgroundColor: THEME.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: THEME.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
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
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  noDataBannerDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    width: '30%',
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: THEME.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  actionCard: {
    width: '48%',
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: THEME.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  accountCard: {
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: THEME.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 16,
  },
  accountAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: THEME.danger,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  devToolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 10,
  },
  devToolsText: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginLeft: 8,
  },
  // Signed Out View Styles
  signedOutContainer: {
    flex: 1,
  },
  signedOutGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  signedOutContent: {
    alignItems: 'center',
    width: '100%',
  },
  appLogo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: '90%',
  },
  primaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: width * 0.8,
    maxWidth: 320,
  },
  primaryButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: THEME.white,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: width * 0.8,
    maxWidth: 320,
  },
  secondaryButtonText: {
    color: THEME.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  roleBadgeContainer: {
    marginTop: 8,
    overflow: 'hidden',
    borderRadius: 20,
  },
  roleBadgeGradient: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  accountBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
