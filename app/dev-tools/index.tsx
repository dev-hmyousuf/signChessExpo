import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Linking,
  SafeAreaView,
  Animated,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { databases, APPWRITE_DATABASE_ID, COLLECTION_USERS } from '@/lib/appwrite';
import { Query } from 'react-native-appwrite';
import { createProfileLink, openProfile, parseProfileLink } from '@/app/utils/linkUtils';
import { THEME, SPACING, SHADOWS, BORDER_RADIUS } from '@/app/utils/theme';

const { width } = Dimensions.get('window');

export default function ProfileTester() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [username, setUsername] = useState('');
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileLink, setProfileLink] = useState('');
  const [httpsLink, setHttpsLink] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Start entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Button press animation
  const animateButtonPress = (toValue: number) => {
    Animated.spring(buttonScale, {
      toValue,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Load a few users from the database for easy testing
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const response = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_USERS,
          [Query.limit(10)]
        );
        
        setUserProfiles(response.documents || []);
      } catch (error) {
        console.error('Error loading users:', error);
        Alert.alert('Error', 'Failed to load user profiles');
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, []);

  // Generate profile links when username changes
  useEffect(() => {
    if (username) {
      const appLink = createProfileLink(username);
      const webLink = createProfileLink(username, true);
      setProfileLink(appLink);
      setHttpsLink(webLink);
    } else {
      setProfileLink('');
      setHttpsLink('');
    }
  }, [username]);

  // Handle navigation to a profile
  const navigateToProfile = () => {
    if (!username) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    
    openProfile(router, username);
  };

  // Handle opening profile with deep link
  const openDeepLink = async () => {
    if (!profileLink) {
      Alert.alert('Error', 'Please enter a username to generate a link');
      return;
    }
    
    try {
      // Test if the link can be opened
      const canOpen = await Linking.canOpenURL(profileLink);
      
      if (canOpen) {
        await Linking.openURL(profileLink);
      } else {
        // If can't open directly, use router navigation as fallback
        const parsedUsername = parseProfileLink(profileLink);
        if (parsedUsername) {
          openProfile(router, parsedUsername);
        } else {
          Alert.alert('Error', 'Invalid profile link');
        }
      }
    } catch (error) {
      console.error('Error opening deep link:', error);
      Alert.alert(
        'Deep Link Error', 
        'Could not open the deep link directly. Navigating with router instead.'
      );
      // Fallback to router
      navigateToProfile();
    }
  };

  // Open current user's profile
  const openCurrentUserProfile = () => {
    if (clerkUser?.username) {
      openProfile(router, clerkUser.username);
    } else {
      Alert.alert('Error', 'You do not have a username set');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f8fafc', '#e0f2fe']}
        style={styles.gradientBackground}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <LinearGradient 
              colors={[THEME.primary, '#FF8C3D']}
              start={{x: 0, y: 0}} 
              end={{x: 1, y: 0}}
              style={styles.headerGradient}
            >
              <Text style={styles.headerTitle}>Profile Testing Tools</Text>
              <Text style={styles.headerSubtitle}>Test user profile navigation and deep linking</Text>
              
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push('/dev-tools')}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.backButtonGradient}
                  start={{x: 0, y: 0}} 
                  end={{x: 1, y: 1}}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Quick Profile Navigation Form */}
          <Animated.View 
            style={[
              styles.quickFormSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#ffffff', '#f8fafc']}
              style={styles.quickFormGradient}
            >
              <View style={styles.quickFormWrapper}>
                <Ionicons name="search" size={20} color={THEME.mediumGray} style={styles.searchIcon} />
                <TextInput
                  style={styles.quickInput}
                  placeholder="Enter username and press Enter"
                  placeholderTextColor={THEME.mediumGray}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                  onSubmitEditing={navigateToProfile}
                  returnKeyType="go"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.quickButton,
                    !username && styles.quickButtonDisabled
                  ]}
                  onPress={navigateToProfile}
                  disabled={!username}
                  onPressIn={() => animateButtonPress(0.92)}
                  onPressOut={() => animateButtonPress(1)}
                  activeOpacity={0.8}
                >
                  <Animated.View style={{transform: [{scale: buttonScale}]}}>
                    <LinearGradient
                      colors={username ? [THEME.primary, '#FF8C3D'] : ['#9ca3af', '#6b7280']}
                      style={styles.goButtonGradient}
                    >
                      <Ionicons 
                        name="arrow-forward" 
                        size={24} 
                        color="#fff" 
                      />
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Current User Profile */}
          <Animated.View 
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#ffffff', '#f8fafc']}
              style={styles.sectionGradient}
            >
              <Text style={styles.sectionTitle}>Your Profile</Text>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={openCurrentUserProfile}
                onPressIn={() => animateButtonPress(0.95)}
                onPressOut={() => animateButtonPress(1)}
                activeOpacity={0.8}
              >
                <Animated.View style={{transform: [{scale: buttonScale}], width: '100%'}}>
                  <LinearGradient 
                    colors={[THEME.primary, '#FF8C3D']}
                    start={{x: 0, y: 0}} 
                    end={{x: 1, y: 0}}
                    style={styles.actionButtonGradient}
                  >
                    <Ionicons name="person" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>View Your Profile</Text>
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
              
              {clerkUser?.username && (
                <View style={styles.infoContainer}>
                  <Ionicons name="at" size={16} color={THEME.primary} style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Your username: <Text style={styles.usernameHighlight}>@{clerkUser.username}</Text>
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* Deep Link Testing */}
          <Animated.View 
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#ffffff', '#f8fafc']}
              style={styles.sectionGradient}
            >
              <Text style={styles.sectionTitle}>Deep Link Testing</Text>
              
              {profileLink ? (
                <>
                  <View style={styles.linkContainer}>
                    <Text style={styles.linkLabel}>App Deep Link:</Text>
                    <View style={styles.linkTextContainer}>
                      <Text style={styles.linkText} selectable>{profileLink}</Text>
                      <LinearGradient
                        colors={['rgba(255,255,255,0)', '#FFE0CC']}
                        start={{x: 0, y: 0.5}}
                        end={{x: 1, y: 0.5}}
                        style={styles.linkFade}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.linkContainer}>
                    <Text style={styles.linkLabel}>Web Link:</Text>
                    <View style={styles.linkTextContainer}>
                      <Text style={styles.linkText} selectable>{httpsLink}</Text>
                      <LinearGradient
                        colors={['rgba(255,255,255,0)', '#FFE0CC']}
                        start={{x: 0, y: 0.5}}
                        end={{x: 1, y: 0.5}}
                        style={styles.linkFade}
                      />
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={openDeepLink}
                    onPressIn={() => animateButtonPress(0.95)}
                    onPressOut={() => animateButtonPress(1)}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={{transform: [{scale: buttonScale}], width: '100%'}}>
                      <LinearGradient 
                        colors={[THEME.accent, THEME.primary]}
                        start={{x: 0, y: 0}} 
                        end={{x: 1, y: 0}}
                        style={styles.actionButtonGradient}
                      >
                        <Ionicons name="link" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Test Deep Link</Text>
                      </LinearGradient>
                    </Animated.View>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="link-outline" size={40} color={THEME.mediumGray} />
                  <Text style={styles.placeholderText}>
                    Enter a username above to generate test links
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* Sample Users List */}
          <Animated.View 
            style={[
              styles.section,
              styles.lastSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#ffffff', '#f8fafc']}
              style={styles.sectionGradient}
            >
              <Text style={styles.sectionTitle}>Sample Users</Text>
              <Text style={styles.infoText}>
                Tap on a user to view their profile:
              </Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Ionicons name="sync" size={24} color={THEME.primary} style={styles.loadingIcon} />
                  <Text style={styles.loadingText}>Loading users...</Text>
                </View>
              ) : userProfiles.length > 0 ? (
                userProfiles.map((user, index) => (
                  <TouchableOpacity
                    key={user.$id}
                    style={[
                      styles.userItem,
                      index === userProfiles.length - 1 && styles.lastUserItem
                    ]}
                    onPress={() => {
                      setUsername(user.username);
                      setTimeout(() => navigateToProfile(), 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#ffffff', '#f8fafc']}
                      style={styles.userItemGradient}
                    >
                      <View style={styles.userAvatarContainer}>
                        <LinearGradient
                          colors={[THEME.primary, '#FF8C3D']}
                          style={styles.userAvatarGradient}
                        >
                          <Text style={styles.userInitial}>
                            {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name || 'No Name'}</Text>
                        <Text style={styles.userUsername}>@{user.username}</Text>
                      </View>
                      <View style={styles.userArrow}>
                        <Ionicons name="chevron-forward" size={20} color={THEME.primary} />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="people-outline" size={40} color={THEME.mediumGray} />
                  <Text style={styles.placeholderText}>No users found</Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.white,
  },
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.xl * 2,
  },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerGradient: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: SPACING.md,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    borderRadius: 22,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  section: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  lastSection: {
    marginBottom: SPACING.xl,
  },
  sectionGradient: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.md,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  infoIcon: {
    marginRight: SPACING.sm,
  },
  infoText: {
    fontSize: 16,
    color: THEME.textPrimary,
  },
  usernameHighlight: {
    color: THEME.primary,
    fontWeight: '600',
  },
  actionButton: {
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  actionButtonDisabled: {
    backgroundColor: THEME.lightGray,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  quickFormSection: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  quickFormGradient: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  quickFormWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: SPACING.md,
    zIndex: 1,
  },
  quickInput: {
    flex: 1,
    backgroundColor: THEME.light,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingLeft: SPACING.xl * 2,
    paddingRight: SPACING.md,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  quickButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  goButtonGradient: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  quickButtonDisabled: {
    opacity: 0.9,
  },
  linkContainer: {
    marginBottom: SPACING.md,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  linkTextContainer: {
    position: 'relative',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  linkText: {
    fontSize: 14,
    color: THEME.primary,
    padding: SPACING.sm,
    backgroundColor: THEME.primaryTransparent,
    borderRadius: BORDER_RADIUS.sm,
  },
  linkFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 40,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  placeholderText: {
    fontSize: 16,
    color: THEME.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingIcon: {
    marginRight: SPACING.sm,
  },
  loadingText: {
    fontSize: 16,
    color: THEME.textPrimary,
    textAlign: 'center',
  },
  userItem: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  lastUserItem: {
    marginBottom: 0,
  },
  userItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: BORDER_RADIUS.md,
  },
  userAvatarContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  userAvatarGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  userUsername: {
    fontSize: 14,
    color: THEME.primary,
  },
  userArrow: {
    backgroundColor: THEME.primaryTransparent,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 