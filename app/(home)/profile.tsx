import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/app/components/Button';
import { Ionicons, MaterialCommunityIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { 
  getPlayerById, 
  getPlayerByUserId,
  updateUserProfile,
  COLLECTION_PLAYERS,
  APPWRITE_DATABASE_ID
} from '@/lib/appwrite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, BORDER_RADIUS, SPACING } from '@/app/utils/theme';
import Animated, { 
  FadeIn, 
  FadeInDown,
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  Easing,
  SlideInUp
} from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { useCompleteUser } from '@/lib/clerkAuth';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function ProfilePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [playerData, setPlayerData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Clerk and Appwrite user data
  const { clerkUser, appwriteUser, isLoaded: isUserLoaded, isSignedIn } = useCompleteUser();
  const { signOut } = useAuth();

  // Animation values
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const avatarScale = useSharedValue(0.8);
  const infoCardTranslateY = useSharedValue(50);
  const actionButtonsTranslateY = useSharedValue(30);
  const slideAnim = useSharedValue(40);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!isUserLoaded || !isSignedIn || !clerkUser) {
          return;
        }
        
        // Try to get player profile
        try {
          const player = await getPlayerByUserId(clerkUser.id);
          if (player) {
            setPlayerData(player);
            setBio(player.bio || '');
          } else {
            console.log("No player profile found");
          }
        } catch (error) {
          console.log("Error fetching player profile:", error);
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      } finally {
        setIsLoaded(true);
        
        // Sequenced animations
        headerOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
        fadeAnim.value = withTiming(1, { duration: 800 });
        
        setTimeout(() => {
          avatarScale.value = withSpring(1, { damping: 12, stiffness: 100 });
        }, 200);
        
        setTimeout(() => {
          infoCardTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
          contentOpacity.value = withTiming(1, { duration: 800 });
          slideAnim.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
        }, 400);
        
        setTimeout(() => {
          actionButtonsTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
        }, 600);
      }
    };

    loadUserData();
  }, [isUserLoaded, isSignedIn, clerkUser]);

  // Animation styles
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }]
  }));

  const infoCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: infoCardTranslateY.value }],
    opacity: contentOpacity.value,
  }));

  const actionButtonsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: actionButtonsTranslateY.value }],
    opacity: contentOpacity.value,
  }));

  const fadeInAnimStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const slideAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
    opacity: fadeAnim.value,
  }));

  const saveChanges = async () => {
    if (!playerData || !clerkUser) return;

    setIsSaving(true);
    
    try {
      // Only update the bio, since the name and avatar should come from Clerk
      await updateUserProfile(playerData.$id, {
        bio: bio,
      });
      
      // Update the player data
      setPlayerData({
        ...playerData,
        bio: bio,
      });
      
      setIsEditing(false);
      Alert.alert("Profile Updated", "Your profile has been updated successfully.");
    } catch (error) {
      console.error("Failed to update profile:", error);
      Alert.alert("Update Failed", "There was a problem updating your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  // If not loaded, show loading state
  if (!isLoaded || !isUserLoaded) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </SafeAreaView>
    );
  }

  // If no user is found, show error
  if (!clerkUser) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Please sign in to view your profile</Text>
        <Button label="Go to Sign In" onPress={() => router.replace('/(auth)/sign-in')} />
      </SafeAreaView>
    );
  }

  const playerStatus = playerData ? (
                  playerData.status === 'approved' 
                    ? 'Approved Player' 
                    : playerData.status === 'pending' 
                      ? 'Pending Approval'
                      : 'User'
  ) : 'User';

  // Determine which role badge colors to use
  const getRoleColors = () => {
    if (!playerData) return ['#FF8C3D', THEME.primary] as const;
    
    const role = playerData.role || 'user';
    switch(role) {
      case 'organizer':
        return ['#4F46E5', '#7C3AED'] as const;
      case 'dynasty_admin':
        return ['#10B981', '#059669'] as const;
      case 'admin':
        return ['#4F46E5', '#7C3AED'] as const;
      case 'moderator':
        return ['#0EA5E9', '#0284C7'] as const;
      case 'player':
        return ['#F59E0B', '#D97706'] as const;
      default:
        return [THEME.primary, '#FF8C3D'] as const;
    }
  };

  // Get role icon name
  const getRoleIcon = () => {
    if (!playerData) return 'person';
    
    const role = playerData.role || 'user';
    switch(role) {
      case 'organizer':
        return 'shield';
      case 'dynasty_admin':
        return 'flag';
      case 'admin':
        return 'shield';
      case 'moderator':
        return 'shield-half';
      case 'player':
        return 'trophy';
      default:
        return 'person';
    }
  };

  // Format role display text
  const getRoleText = () => {
    if (!playerData) return 'User';
    
    const role = playerData.role || 'user';
    switch(role) {
      case 'organizer':
        return 'Organizer';
      case 'dynasty_admin':
        return playerData.countryName ? `Dynasty Admin ${playerData.countryFlag} ${playerData.countryName}` : 'Dynasty Admin';
      case 'admin':
        return 'Administrator';
      case 'moderator':
        return 'Moderator';
      case 'player':
        return 'Player';
      default:
        return 'User';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Header with Gradient */}
        <AnimatedLinearGradient
          colors={getRoleColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerBackground, headerAnimatedStyle]}
        >
          {/* Decorative Elements */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          {/* Edit Button */}
          {playerData && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(!isEditing)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                style={styles.editButtonGradient}
              >
                <Ionicons 
                  name={isEditing ? "close" : "pencil"} 
                  size={20} 
                  color="#fff" 
                />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </AnimatedLinearGradient>
        
        {/* Profile Content */}
        <View style={styles.profileContent}>
          {/* Avatar Container */}
          <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
            <Image 
              source={{ uri: clerkUser.imageUrl }} 
              style={styles.avatar} 
            />
            {playerData && (
              <View style={styles.badgeContainer}>
                <LinearGradient
                  colors={getRoleColors()}
                  style={styles.badgeGradient}
                >
                  <Ionicons name={getRoleIcon()} size={16} color="#fff" />
                </LinearGradient>
            </View>
            )}
          </Animated.View>
            
          {/* User Info Card */}
          <Animated.View style={[styles.userInfoCard, infoCardAnimatedStyle]}>
            <Text style={styles.userName}>{clerkUser.fullName}</Text>
            <Text style={styles.username}>@{clerkUser.username}</Text>
            
            {/* Country Badge if available */}
            {playerData && playerData.countryName && (
              <View style={styles.countryContainer}>
                <Text style={styles.countryFlag}>{playerData.countryFlag || '🏳️'}</Text>
                <Text style={styles.countryName}>{playerData.countryName}</Text>
              </View>
            )}
            
            {/* Role Badge */}
            {playerData && (
              <View style={styles.roleBadgeContainer}>
                <LinearGradient
                  colors={getRoleColors()}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.roleBadgeGradient}
                >
                  <Ionicons name={getRoleIcon()} size={14} color="#fff" style={{marginRight: 4}} />
                  <Text style={styles.roleBadgeText}>{getRoleText()}</Text>
                </LinearGradient>
              </View>
            )}
            
            <View style={styles.emailContainer}>
              <Feather name="mail" size={16} color={THEME.textSecondary} style={styles.emailIcon} />
            <Text style={styles.emailText}>{clerkUser.primaryEmailAddress?.emailAddress}</Text>
          </View>
            
            {/* Player Stats Row */}
            {playerData && (
              <Animated.View style={[styles.statsContainer, slideAnimStyle]}>
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <LinearGradient
                      colors={[THEME.primary, THEME.primaryLight]}
                      style={styles.statIconGradient}
                    >
                      <FontAwesome5 name="chart-line" size={16} color="#fff" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.statValue}>{playerData.rating || 0}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.statIconGradient}
                    >
                      <FontAwesome5 name="trophy" size={16} color="#fff" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.statValue}>{playerData.victories || 0}</Text>
                  <Text style={styles.statLabel}>Wins</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <LinearGradient
                      colors={['#8B5CF6', '#A855F7']}
                      style={styles.statIconGradient}
                    >
                      <FontAwesome5 name="medal" size={16} color="#fff" />
                    </LinearGradient>
                  </View>
                  <Text style={styles.statValue}>{playerData.defeats || 0}</Text>
                  <Text style={styles.statLabel}>Losses</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>

          {/* Player Info Section */}
          {playerData && (
            <Animated.View style={[styles.bioCard, slideAnimStyle]}>
              <LinearGradient
                colors={['#ffffff', '#fafafa']}
                style={styles.cardGradient}
              >
              <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle" size={22} color={THEME.primary} />
                <Text style={styles.sectionTitle}>About</Text>
                  
                {!isEditing && (
                  <TouchableOpacity 
                      style={styles.editButton2} 
                    onPress={() => setIsEditing(true)}
                  >
                    <Feather name="edit-2" size={16} color={THEME.primary} />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Bio */}
              <View style={styles.fieldContainer}>
                {isEditing ? (
                  <TextInput
                    style={styles.bioInput}
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    numberOfLines={4}
                    placeholder="Tell us about yourself"
                  />
                ) : (
                  <Text style={styles.bioText}>
                    {playerData.bio || 'No bio provided. Tap the edit button to add your bio.'}
                  </Text>
                )}
              </View>

                {/* Action Buttons for editing */}
              {isEditing && (
                <View style={styles.actionButtons}>
                  <Button
                    label="Save Changes"
                    onPress={saveChanges}
                    loading={isSaving}
                    disabled={isSaving}
                    style={styles.saveButton}
                  />
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsEditing(false);
                      // Reset form data
                      setBio(playerData.bio || '');
                    }}
                    disabled={isSaving}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
              </LinearGradient>
            </Animated.View>
          )}

          {/* Details Section */}
          <Animated.View style={[styles.detailsCard, slideAnimStyle]}>
            <LinearGradient
              colors={['#ffffff', '#fafafa']}
              style={styles.cardGradient}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="list" size={22} color={THEME.primary} />
                <Text style={styles.sectionTitle}>Details</Text>
              </View>
              
              {/* Role */}
              {playerData && (
                <View style={styles.detailItem}>
                  <View style={[
                    styles.detailIconContainer, 
                    playerData.role === 'organizer' ? styles.organizerRoleBadge :
                    playerData.role === 'dynasty_admin' ? styles.dynastyAdminRoleBadge :
                    playerData.role === 'admin' ? styles.adminRoleBadge : 
                    playerData.role === 'moderator' ? styles.modRoleBadge : styles.userRoleBadge
                  ]}>
                    <Ionicons name={getRoleIcon()} size={18} color="#fff" />
                  </View>
                  <Text style={styles.detailText}>
                    Role: <Text style={styles.roleText}>{getRoleText()}</Text>
                  </Text>
                </View>
              )}

              {/* Country */}
              {playerData && playerData.countryName && (
                <View style={styles.detailItem}>
                  <View style={[styles.detailIconContainer, {backgroundColor: '#10B981'}]}>
                    <MaterialCommunityIcons name="earth" size={18} color="#fff" />
                  </View>
                  <Text style={styles.detailText}>
                    Country: <Text style={styles.roleText}>{playerData.countryName} {playerData.countryFlag || '🏳️'}</Text>
                  </Text>
                </View>
              )}

              {/* Joined Date */}
              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="calendar" size={18} color="#fff" />
                </View>
                <Text style={styles.detailText}>
                  Joined {playerData && playerData.registrationDate 
                    ? new Date(playerData.registrationDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : clerkUser?.createdAt ? new Date(clerkUser.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'Unknown'}
                </Text>
              </View>
              
              {/* Email (visible to user only) */}
              <View style={styles.detailItem}>
                <View style={[styles.detailIconContainer, {backgroundColor: '#10B981'}]}>
                  <Ionicons name="mail" size={18} color="#fff" />
                </View>
                <Text style={styles.detailText}>
                  Email: <Text style={{color: THEME.textPrimary, fontWeight: '500'}}>{clerkUser.primaryEmailAddress?.emailAddress}</Text>
                  <Text style={{color: THEME.textSecondary, fontSize: 12}}> (Only visible to you)</Text>
                </Text>
              </View>
              
              {/* Activity Status */}
              <View style={styles.detailItem}>
                <View style={[styles.detailIconContainer, {backgroundColor: '#8B5CF6'}]}>
                  <Ionicons name="stats-chart" size={18} color="#fff" />
                </View>
                <Text style={styles.detailText}>
                  Activity Status: <Text style={{color: '#10B981', fontWeight: '600'}}>Active</Text>
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Account Actions */}
          <Animated.View style={[styles.accountActions, actionButtonsAnimatedStyle]}>
            {!playerData && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/player-registration')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[THEME.primary, '#FF8C3D']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.actionGradient}
                >
                  <FontAwesome5 name="user-plus" size={16} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.actionText}>Register as Player</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#f43f5e', '#e11d48']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.actionGradient}
              >
                <Ionicons name="log-out-outline" size={20} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.actionText}>Sign Out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    color: THEME.danger,
    marginBottom: 20,
    textAlign: 'center',
  },
  headerBackground: {
    height: 200,
    width: '100%',
    position: 'relative',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  decorCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    position: 'absolute',
    top: 10, 
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    zIndex: 10,
  },
  backButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
  editButton: {
    position: 'absolute',
    top: 10,
    right: 16,
    overflow: 'hidden',
    borderRadius: 22,
    zIndex: 10,
  },
  editButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginTop: -60,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 10,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'white',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeGradient: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfoCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginTop: 70,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  countryFlag: {
    fontSize: 16,
    marginRight: 8,
  },
  countryName: {
    fontSize: 14,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  roleBadgeContainer: {
    overflow: 'hidden',
    borderRadius: 20,
    marginBottom: 12,
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
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emailIcon: {
    marginRight: 6,
  },
  emailText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
  },
  statItem: {
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignSelf: 'center',
  },
  bioCard: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailsCard: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardGradient: {
    borderRadius: 20,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginLeft: 10,
    flex: 1,
  },
  editButton2: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    position: 'absolute',
    right: 0,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.primary,
    marginLeft: 4,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 16,
    color: THEME.textPrimary,
    lineHeight: 24,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    fontSize: 16,
    color: THEME.textPrimary,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailText: {
    fontSize: 16,
    color: THEME.textPrimary,
    flex: 1,
  },
  organizerRoleBadge: {
    backgroundColor: '#4F46E5', // Purple for organizer
  },
  dynastyAdminRoleBadge: {
    backgroundColor: '#10B981', // Green for dynasty admin
  },
  adminRoleBadge: {
    backgroundColor: '#4F46E5', // Purple for admin
  },
  modRoleBadge: {
    backgroundColor: '#0EA5E9', // Blue for moderator
  },
  userRoleBadge: {
    backgroundColor: THEME.primary, // Default orange for regular users
  },
  roleText: {
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  actionButtons: {
    marginTop: 20,
  },
  saveButton: {
    borderRadius: 12,
    height: 48,
  },
  cancelButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  accountActions: {
    marginTop: 20,
    marginBottom: 30,
  },
  actionButton: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

