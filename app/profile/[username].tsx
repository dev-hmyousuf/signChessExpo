import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Animated,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getPlayerByUsername,
  databases,
  APPWRITE_DATABASE_ID,
  COLLECTION_USERS,
  COLLECTION_PLAYERS,
  STORAGE_BUCKET_ID,
  APPWRITE_PROJECT_ID,
} from '@/lib/appwrite';
import { Query } from 'react-native-appwrite';
import { THEME, SPACING, SHADOWS, BORDER_RADIUS } from '@/app/utils/theme';

const { width } = Dimensions.get('window');

// Mapping for dynasties/countries
const COUNTRIES_MAP: {[key: string]: {name: string, flag: string}} = {
  "us": { name: "United States", flag: "🇺🇸" },
  "gb": { name: "United Kingdom", flag: "🇬🇧" },
  "ca": { name: "Canada", flag: "🇨🇦" },
  "au": { name: "Australia", flag: "🇦🇺" },
  "fr": { name: "France", flag: "🇫🇷" },
  "de": { name: "Germany", flag: "🇩🇪" },
  "jp": { name: "Japan", flag: "🇯🇵" },
  "cn": { name: "China", flag: "🇨🇳" },
  "in": { name: "India", flag: "🇮🇳" },
  "br": { name: "Brazil", flag: "🇧🇷" },
  "mx": { name: "Mexico", flag: "🇲🇽" },
  "ru": { name: "Russia", flag: "🇷🇺" },
  "kr": { name: "South Korea", flag: "🇰🇷" },
  "za": { name: "South Africa", flag: "🇿🇦" },
  "es": { name: "Spain", flag: "🇪🇸" },
  "it": { name: "Italy", flag: "🇮🇹" },
  "sg": { name: "Singapore", flag: "🇸🇬" },
  "nz": { name: "New Zealand", flag: "🇳🇿" },
  "nl": { name: "Netherlands", flag: "🇳🇱" },
  "bd": { name: "Bangladesh", flag: "🇧🇩" },
  "pk": { name: "Pakistan", flag: "🇵🇰" },
  "ng": { name: "Nigeria", flag: "🇳🇬" }
};

// Interface for user data
interface UserProfile {
  $id: string;
  clerkId: string;
  name: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  countryId?: string;
  countryName?: string;
  countryFlag?: string;
  dynastyId?: string;
  dynastyName?: string;
  dynastyFlag?: string;
  rating?: number;
  achievements?: string[];
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    website?: string;
  };
  joinedDate?: string;
  role?: string;
  title?: string;
  isCurrentUser: boolean;
}

// Get dynasty info by dynastyId
const getDynastyInfo = (dynastyId?: string): {name: string, flag: string} | null => {
  if (!dynastyId) return null;
  
  // Check if dynasty value is already a full country code
  const countryCode = dynastyId.toLowerCase();
  
  // Try to find country info in our map
  return COUNTRIES_MAP[countryCode] || null;
};

export default function PlayerProfileScreen() {
  const { username } = useLocalSearchParams();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showEditBioModal, setShowEditBioModal] = useState(false);
  const navigation = useNavigation();
  const router = useRouter();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const avatarScale = useRef(new Animated.Value(0.8)).current;
  const headerHeight = useRef(new Animated.Value(0)).current;

  // Get dynasty info for current profile
  const dynastyInfo = profile?.role === 'dynasty_admin' && profile?.dynastyId ? 
    getDynastyInfo(profile.dynastyId) : null;

  // Function to handle going back
  const goBack = useCallback(() => {
    console.log("Attempting to navigate back");
    // First try router navigation
    try {
      router.back();
    } catch (error) {
      console.log("Router back failed:", error);
      // Then try explicit navigation
      router.push("/(home)");
    }
  }, [router]);

  // Set dynamic header title based on username


  // Start animations when profile loads
  useEffect(() => {
    if (profile) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(avatarScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(headerHeight, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [profile]);

  // Load player profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!username || typeof username !== 'string') {
        setError('Invalid username');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get user data from the users collection
        const userDocs = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_USERS,
          // username is case sensitive in Appwrite, so we need an exact match
          [Query.equal('username', username.toString())]
        );
        
        if (userDocs.documents.length === 0) {
          setError(`User @${username} not found`);
          setLoading(false);
          return;
        }
        
        const userData = userDocs.documents[0];
        
        // Get player data from the players collection to get the bio
        const playerDocs = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          [Query.equal('username', username.toString())]
        );
        
        // Get bio from player data if available
        const playerData = playerDocs.documents.length > 0 ? playerDocs.documents[0] : null;
        const playerBio = playerData?.bio || '';
        
        console.log('Raw userData:', {
          role: userData.role,
          dynastyId: userData.dynastyId,
          dynastyName: userData.dynastyName
        });
        
        console.log('Player data found:', !!playerData, 'Bio:', playerBio);
        
        // Check if this is the current user's profile
        const isCurrentUser = isClerkLoaded && clerkUser ? 
          (userData.clerkId === clerkUser.id) : false;
        
        // Format data for the profile
        const formattedProfile: UserProfile = {
          $id: userData.$id,
          clerkId: userData.clerkId,
          name: userData.name || '',
          username: userData.username,
          email: isCurrentUser ? userData.email : undefined, // Only show email for current user
          avatarUrl: userData.avatarUrl,
          bio: playerBio, // Use bio from player collection
          countryId: userData.countryId,
          countryName: userData.countryName,
          countryFlag: userData.countryFlag,
          dynastyId: userData.role === 'dynasty_admin' ? userData.dynastyId : undefined,
          dynastyName: userData.role === 'dynasty_admin' ? userData.dynastyName : undefined, 
          dynastyFlag: userData.role === 'dynasty_admin' ? userData.dynastyFlag : undefined,
          rating: playerData?.rating || userData.rating || 0, // Use player rating if available
          joinedDate: userData.$createdAt,
          role: userData.role,
          title: userData.title || 'Player',
          isCurrentUser
        };
        
        console.log('Formatted profile bio:', formattedProfile.bio);
        
        setProfile(formattedProfile);
      } catch (error) {
        console.error('Error loading profile:', error);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (isClerkLoaded) {
      loadProfile();
    }
  }, [username, isClerkLoaded, clerkUser]);

  // Toggle edit mode (only available for current user)
  const toggleEditMode = () => {
    if (profile?.isCurrentUser) {
      if (!isEditMode) {
        // Set the current bio as the initial value for editing
        setEditBio(profile.bio || '');
        setShowEditBioModal(true);
      }
      setIsEditMode(!isEditMode);
    }
  };

  // Save bio to players collection
  const saveBio = async () => {
    if (!profile || !profile.isCurrentUser) return;
    
    try {
      setIsSaving(true);
      
      // Find player document by username
      const playerDocs = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        [Query.equal('username', profile.username)]
      );
      
      if (playerDocs.documents.length === 0) {
        Alert.alert('Error', 'Could not find your player profile');
        setIsSaving(false);
        return;
      }
      
      const playerId = playerDocs.documents[0].$id;
      
      // Update the bio in the players collection
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        playerId,
        { bio: editBio }
      );
      
      // Update local profile state
      setProfile({
        ...profile,
        bio: editBio
      });
      
      // Close modal and exit edit mode
      setShowEditBioModal(false);
      setIsEditMode(false);
      Alert.alert('Success', 'Your bio has been updated');
    } catch (error) {
      console.error('Error saving bio:', error);
      Alert.alert('Error', 'Failed to save bio. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle avatar URL formatting
  const getAvatarUrl = (profile: UserProfile | null) => {
    if (!profile || !profile.avatarUrl) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent((profile?.name || username || 'User') as string)}&background=f97316&color=fff&size=200`;
    }

    // If it's a full URL already, use it
    if (profile.avatarUrl.startsWith('http')) {
      return profile.avatarUrl;
    }
    
    // If it's a file ID, construct Appwrite storage URL
    return `https://cloud.appwrite.io/v1/storage/buckets/${STORAGE_BUCKET_ID}/files/${profile.avatarUrl}/view?project=${APPWRITE_PROJECT_ID}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={64} color={THEME.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={64} color={THEME.lightGray} />
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Additional Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={goBack}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.white} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        {/* Animated Header with Gradient */}
        <Animated.View style={[
          styles.headerContainer,
          { opacity: fadeAnim }
        ]}>
          <LinearGradient
            colors={
              profile.role === 'organizer' ? ['#4F46E5', '#7C3AED', '#8B5CF6'] :
              profile.role === 'dynasty_admin' ? ['#10B981', '#059669', '#047857'] :
              [THEME.primary, '#FF8C3D', '#FFA366']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            {/* Decorative Elements */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            
            {/* Avatar */}
            <Animated.View style={[
              styles.avatarWrapper,
              { transform: [{ scale: avatarScale }] }
            ]}>
              <Image
                source={{ uri: getAvatarUrl(profile) }}
                style={styles.avatar}
              />
              {(profile.role === 'organizer' || profile.role === 'dynasty_admin' || profile.role === 'admin') && (
                <View style={styles.badgeContainer}>
                  <LinearGradient
                    colors={
                      profile.role === 'organizer' ? ['#4F46E5', '#7C3AED'] :
                      profile.role === 'dynasty_admin' ? ['#10B981', '#059669'] :
                      ['#4F46E5', '#7C3AED'] // default admin colors
                    }
                    style={styles.badgeGradient}
                  >
                    <Ionicons 
                      name={
                        profile.role === 'organizer' ? 'shield-checkmark' :
                        profile.role === 'dynasty_admin' ? 'flag' :
                        'shield-checkmark'
                      } 
                      size={16} 
                      color="#fff" 
                    />
                  </LinearGradient>
                </View>
              )}
            </Animated.View>
            
            {/* Basic Info */}
            <Animated.View style={[
              styles.infoContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              
              {/* Country Flag */}
              {profile.countryFlag && profile.countryName && (
                <View style={styles.countryContainer}>
                  <Text style={styles.countryFlag}>{profile.countryFlag}</Text>
                  <Text style={styles.countryName}>{profile.countryName}</Text>
                </View>
              )}
              
              {/* Dynasty information for admin with flag */}
              {profile.role === 'dynasty_admin' && dynastyInfo && (
                <View style={styles.dynastyContainer}>
                  <Text style={styles.dynastyFlag}>{dynastyInfo.flag}</Text>
                  <Text style={styles.dynastyName}>{dynastyInfo.name}</Text>
                </View>
              )}
              
              {/* Role Badge */}
              <View style={styles.roleBadgeContainer}>
                <LinearGradient
                  colors={
                    profile.role === 'organizer' ? ['#4F46E5', '#7C3AED'] :
                    profile.role === 'dynasty_admin' ? ['#10B981', '#059669'] :
                    profile.role === 'admin' ? ['#4F46E5', '#7C3AED'] :
                    profile.role === 'moderator' ? ['#0EA5E9', '#0284C7'] :
                    profile.role === 'player' ? ['#F59E0B', '#D97706'] :
                    ['#94A3B8', '#64748B'] // default for regular users
                  }
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.roleBadgeGradient}
                >
                  <Ionicons 
                    name={
                      profile.role === 'organizer' ? 'shield' :
                      profile.role === 'dynasty_admin' ? 'flag' :
                      profile.role === 'admin' ? 'shield' :
                      profile.role === 'moderator' ? 'shield-half' :
                      profile.role === 'player' ? 'trophy' :
                      'person'
                    }
                    size={14}
                    color="#fff"
                    style={{marginRight: 4}}
                  />
                  <Text style={styles.roleBadgeText}>
                    {profile.role === 'organizer' ? 'Organizer' :
                     profile.role === 'dynasty_admin' && dynastyInfo ? 
                      `Dynasty Admin ${dynastyInfo.flag} ${dynastyInfo.name || ''}` :
                     profile.role === 'dynasty_admin' && profile.dynastyFlag ? 
                      `Dynasty Admin ${profile.dynastyFlag} ${profile.dynastyName || ''}` :
                     profile.role === 'dynasty_admin' ? 'Dynasty Admin' :
                     profile.role === 'admin' ? 'Admin' :
                     profile.role === 'moderator' ? 'Moderator' :
                     profile.role === 'player' ? 'Player' :
                     'User'}
                  </Text>
                </LinearGradient>
              </View>
            </Animated.View>
            
            {/* Edit Button (only for current user) */}
            {profile.isCurrentUser && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={toggleEditMode}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.editButtonGradient}
                >
                  <Ionicons 
                    name={isEditMode ? "close" : "pencil"} 
                    size={20} 
                    color="#fff" 
                  />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </Animated.View>
        
        {/* Stats Section */}
        <Animated.View 
          style={[
            styles.statsCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#ffffff', '#fafafa']}
            style={styles.statsGradient}
          >
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <LinearGradient
                    colors={[THEME.primary, THEME.primaryLight]}
                    style={styles.statIconGradient}
                  >
                    <FontAwesome5 name="chart-line" size={16} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.statValue}>{profile.rating || 0}</Text>
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
                <Text style={styles.statValue}>0</Text>
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
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Tournaments</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        
        {/* Bio Section */}
        <Animated.View 
          style={[
            styles.bioCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#ffffff', '#fafafa']}
            style={styles.cardGradient}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={22} color={THEME.primary} />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            
            {profile.bio ? (
              <View style={styles.bioTextContainer}>
                <Text style={styles.bioText}>
                  {profile.bio}
                </Text>
                {profile.isCurrentUser && (
                  <TouchableOpacity 
                    style={styles.editBioButton}
                    onPress={() => {
                      setEditBio(profile.bio || '');
                      setShowEditBioModal(true);
                    }}
                  >
                    <Ionicons name="pencil" size={16} color={THEME.white} />
                    <Text style={styles.editBioButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.noBioContainer}>
                <Ionicons name="person-outline" size={40} color={THEME.textSecondary} />
                <Text style={styles.noBioText}>
                  No bio provided yet
                  {profile.isCurrentUser && "\nTap the edit button to add your bio"}
                </Text>
                {profile.isCurrentUser && (
                  <TouchableOpacity 
                    style={styles.addBioButton}
                    onPress={() => {
                      setEditBio('');
                      setShowEditBioModal(true);
                    }}
                  >
                    <Text style={styles.addBioButtonText}>Add Bio</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </LinearGradient>
        </Animated.View>
        
        {/* Other Details Section */}
        <Animated.View 
          style={[
            styles.detailsCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#ffffff', '#fafafa']}
            style={styles.cardGradient}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={22} color={THEME.primary} />
              <Text style={styles.sectionTitle}>Details</Text>
            </View>
            
            <View style={styles.detailItem}>
              <View style={[
                styles.detailIconContainer, 
                profile.role === 'organizer' ? styles.organizerRoleBadge :
                profile.role === 'dynasty_admin' ? styles.dynastyAdminRoleBadge :
                profile.role === 'admin' ? styles.adminRoleBadge : 
                profile.role === 'moderator' ? styles.modRoleBadge : styles.userRoleBadge
              ]}>
                <Ionicons 
                  name={
                    profile.role === 'organizer' ? 'shield' : 
                    profile.role === 'dynasty_admin' ? 'flag' : 
                    profile.role === 'admin' ? 'shield' : 
                    profile.role === 'moderator' ? 'shield-half' : 'person'
                  } 
                  size={18} 
                  color="#fff" 
                />
              </View>
              <Text style={styles.detailText}>
                Role: <Text style={styles.roleText}>
                  {profile.role === 'organizer' ? 'Organizer' :
                   profile.role === 'dynasty_admin' && dynastyInfo ? 
                    `Dynasty Admin ${dynastyInfo.flag} ${dynastyInfo.name || ''}` :
                   profile.role === 'dynasty_admin' && profile.dynastyFlag ? 
                    `Dynasty Admin ${profile.dynastyFlag} ${profile.dynastyName || ''}` :
                   profile.role === 'dynasty_admin' ? 'Dynasty Admin' :
                   profile.role === 'admin' ? 'Administrator' : 
                   profile.role === 'moderator' ? 'Moderator' : 
                   profile.role || 'Regular User'}
                </Text>
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="calendar" size={18} color="#fff" />
              </View>
              <Text style={styles.detailText}>
                Joined {profile.joinedDate ? new Date(profile.joinedDate).toLocaleDateString() : 'Unknown'}
              </Text>
            </View>
            
            {/* Only show email to the user themselves */}
            {profile.isCurrentUser && profile.email && (
              <View style={styles.detailItem}>
                <View style={[styles.detailIconContainer, {backgroundColor: '#10B981'}]}>
                  <Ionicons name="mail" size={18} color="#fff" />
                </View>
                <Text style={styles.detailText}>
                  Email: <Text style={{color: THEME.textPrimary, fontWeight: '500'}}>{profile.email}</Text>
                  <Text style={{color: THEME.textSecondary, fontSize: 12}}> (Only visible to you)</Text>
                </Text>
              </View>
            )}
            
            {/* Remove separate Dynasty Flag display since it's now included in the role badge */}
            {profile.role === 'dynasty_admin' && profile.dynastyName && !dynastyInfo && (
              <View style={styles.dynastyContainer}>
                <Ionicons name="flag" size={16} color="#fff" style={{marginRight: 6}} />
                <Text style={styles.dynastyName}>Dynasty: {profile.dynastyName}</Text>
              </View>
            )}
            
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
        
        {/* Action Buttons */}
        <Animated.View 
          style={[
            styles.actionsContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {!profile.isCurrentUser && (
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.9}>
              <LinearGradient
                colors={[THEME.primary, THEME.primaryLight]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.actionGradient}
              >
                <FontAwesome5 name="user-plus" size={16} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.actionText}>Follow</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.9}>
            <LinearGradient
              colors={['#3b82f6', '#60a5fa']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.actionGradient}
            >
              <FontAwesome5 name="chess-knight" size={16} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.actionText}>Challenge</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      
      {/* Edit Bio Modal */}
      <Modal
        visible={showEditBioModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowEditBioModal(false);
          setIsEditMode(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Bio</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditBioModal(false);
                  setIsEditMode(false);
                }}
              >
                <Ionicons name="close" size={24} color={THEME.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.bioInput}
              multiline
              placeholder="Write something about yourself..."
              value={editBio}
              onChangeText={setEditBio}
              maxLength={500}
            />
            
            <Text style={styles.charCount}>
              {editBio.length}/500 characters
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditBioModal(false);
                  setIsEditMode(false);
                }}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveBio}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={THEME.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 50,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: THEME.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: SPACING.lg,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  errorButtonText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 30,
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
  headerGradient: {
    paddingTop: SPACING.xl * 2,
    paddingBottom: SPACING.xl * 2.5,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
  avatarWrapper: {
    marginBottom: SPACING.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
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
  infoContainer: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  username: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    color: '#fff',
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
  editButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    overflow: 'hidden',
    borderRadius: 22,
  },
  editButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    marginTop: -50,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statsGradient: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
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
    marginTop: SPACING.xl,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
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
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
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
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginLeft: 10,
  },
  bioTextContainer: {
    position: 'relative',
    width: '100%',
  },
  bioText: {
    fontSize: 16,
    color: THEME.textPrimary,
    lineHeight: 24,
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
    flex: 1,
  },
  editBioButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: THEME.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBioButtonText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  detailText: {
    fontSize: 16,
    color: THEME.textPrimary,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  actionButton: {
    flex: 1,
    maxWidth: 150,
    marginHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
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
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    zIndex: 10,
  },
  backButtonText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: SPACING.md,
  },
  topSpacer: {
    height: 0,
  },
  dynastyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  dynastyFlag: {
    fontSize: 16,
    marginRight: 8,
  },
  dynastyName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  noBioContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: SPACING.md,
  },
  noBioText: {
    color: THEME.textSecondary,
    fontSize: 16,
    marginTop: SPACING.md,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  addBioButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    ...SHADOWS.small,
  },
  addBioButtonText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  bioInput: {
    height: 200,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: THEME.textSecondary,
    borderRadius: BORDER_RADIUS.md,
  },
  charCount: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginTop: SPACING.sm,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: THEME.textSecondary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  cancelButtonText: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: THEME.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  saveButtonText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
  },
}); 