import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/app/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { 
  account, 
  logout, 
  getCurrentSession, 
  getPlayerById, 
  getPlayerByUserId,
  updateUserProfile,
  createDocumentWithPermissions,
  COLLECTION_PLAYERS,
  storage,
  ID,
  createNameChangeRequest,
  STORAGE_BUCKET_ID,
  verifyStorageBucket,
  APPWRITE_PROJECT_ID,
  APPWRITE_ENDPOINT,
  uploadImageBase64,
  uploadProfileImageFromUri,
  getFileUrl
} from '@/lib/appwrite';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@/app/utils/theme';
import { downloadFileFromAnyBucket, migrateFile, LEGACY_BUCKET_IDS } from '@/app/utils/fileMigration';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
// Import custom image server utilities
import { uploadProfileImage as uploadServerProfileImage, isServerAvailable } from '@/app/utils/imageServer';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ProfilePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [playerData, setPlayerData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [originalName, setOriginalName] = useState(''); // To track name changes
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isNameChangeRequested, setIsNameChangeRequested] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [isServerMode, setIsServerMode] = useState(false);

  // Animation values
  const profileOpacity = useSharedValue(0);
  const avatarScale = useSharedValue(0.8);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = await getCurrentSession();
        if (session) {
          const userData = await account.get();
          setUser(userData);
          
          // Set initial values from user account
          setFullName(userData.name);
          setOriginalName(userData.name);
          setUsername(userData.name.replace(/\s+/g, '').toLowerCase()); // Default username from name
          
          // Check if user has avatar from authentication
          if (userData.prefs?.avatarUrl) {
            setAvatarUri(userData.prefs.avatarUrl);
          }

          // Try to get player profile by userId instead of doc ID
          try {
            const player = await getPlayerByUserId(userData.$id);
            if (player) {
              setPlayerData(player);
              setFullName(player.name || userData.name);
              setOriginalName(player.name || userData.name);
              setUsername(player.username || userData.name.replace(/\s+/g, '').toLowerCase());
              setBio(player.bio || '');
              
              // If player has avatar, load it properly
              if (player.avatar) {
                const imageUrl = await loadProfileImage(player.avatar);
                if (imageUrl) {
                  setAvatarUri(imageUrl);
                } else {
                  // If we can't load the image, use a random avatar
                  setAvatarUri(generateRandomAvatarUrl(player.name || userData.name));
                }
              }
            } else {
              console.log("No player profile found, using account data");
            }
          } catch (error) {
            console.log("Error fetching player profile, using account data:", error);
          }

          // Check if custom server is available
          try {
            const serverAvailable = await isServerAvailable();
            setIsServerMode(serverAvailable);
            console.log("Custom image server available:", serverAvailable);
          } catch (error) {
            console.log("Error checking server availability:", error);
            setIsServerMode(false);
          }
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      } finally {
        setIsLoaded(true);
        // Animate in the profile
        profileOpacity.value = withTiming(1, { duration: 800 });
        avatarScale.value = withSpring(1);
      }
    };

    loadUser();
  }, []);

  // Animation styles
  const profileAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: profileOpacity.value,
    };
  });

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: avatarScale.value }
      ]
    };
  });

  const pickImage = async () => {
    try {
      // Request permission to access media library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photo library to set a profile picture');
        return;
      }
      
      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        
        // Show a temporary local preview while uploading
        const selectedImageUri = result.assets[0].uri;
        setAvatarUri(selectedImageUri);
        
        try {
          console.log("Starting avatar upload process...");
          
          // Determine whether to use custom server or Appwrite
          let imageUrl;
          
          if (isServerMode) {
            // Use custom image server
            console.log("Using custom image server for upload");
            imageUrl = await uploadServerProfileImage(selectedImageUri);
            
            if (!imageUrl) {
              throw new Error("Custom server upload failed");
            }
            
            console.log("Custom server upload successful:", imageUrl);
          } else {
            // Use Appwrite storage as fallback
            console.log("Using Appwrite storage for upload (server not available)");
            
            // Check if storage bucket is accessible
            const isBucketValid = await verifyStorageBucket();
            if (!isBucketValid) {
              throw new Error("Storage bucket not accessible");
            }
            
            // Try the base64 upload approach first (most reliable for React Native)
            let fileId;
            try {
              console.log("Attempting Base64 upload to Appwrite...");
              fileId = await uploadImageBase64(selectedImageUri);
            } catch (base64Error) {
              console.error("Base64 upload failed:", base64Error);
              console.log("Falling back to standard upload method...");
              fileId = await uploadProfileImageFromUri(selectedImageUri);
            }
            
            if (!fileId) {
              throw new Error("Appwrite upload failed - no file ID returned");
            }
            
            console.log("File uploaded to Appwrite with ID:", fileId);
            
            // Get the preview URL for display
            imageUrl = getFileUrl(fileId);
          }
          
          // Update the avatar URI state
          setAvatarUri(imageUrl);
          console.log("Avatar preview URL set:", imageUrl);
          
          // Update the profile data with the new avatar
          if (playerData) {
            await updateUserProfile(playerData.$id, {
              avatar: imageUrl // Store full URL instead of just fileId
            });
            console.log("Player profile updated with new avatar URL");
            Alert.alert("Success", "Profile picture updated successfully");
          } else {
            // If we don't have player data yet, we'll update it when saving the profile
            console.log("No player data to update yet, will save avatar with profile");
            Alert.alert("Success", "Profile picture will be saved with your profile");
          }
        } catch (error) {
          console.error("Avatar upload failed:", error);
          Alert.alert(
            "Upload Failed", 
            "We couldn't upload your profile picture. Please try again later.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Try Again", onPress: pickImage }
            ]
          );
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error("Error with image picker:", error);
      setIsUploading(false);
      
      // Provide fallback options
      Alert.alert(
        "Profile Photo",
        "There was a problem selecting your photo. Would you like to use an alternative?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Use Random Avatar", onPress: generateRandomAvatar },
          { text: "Try Again", onPress: pickImage }
        ]
      );
    }
  };

  const generateRandomAvatar = () => {
    // Generate a random avatar using ui-avatars API with a random background
    const randomColor = Math.floor(Math.random()*16777215).toString(16);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=${randomColor}&color=fff`;
    setAvatarUri(avatarUrl);
  };

  const handleNameChange = async (newName: string, oldName: string) => {
    if (isNameChangeRequested) return;
    
    try {
      setIsNameChangeRequested(true);
      
      if (playerData) {
        // Create a name change request
        await createNameChangeRequest(playerData.$id, oldName, newName);
        console.log(`Name change request created: ${oldName} → ${newName}`);
        
        // Update UI to reflect pending status
        Alert.alert(
          "Name Change Requested", 
          "Your name change has been requested and is pending approval. It may take some time to be processed."
        );
      }
    } catch (error) {
      console.error("Failed to request name change:", error);
      Alert.alert("Error", "Failed to request name change. Please try again later.");
    } finally {
      setIsNameChangeRequested(false);
    }
  };

  const saveChanges = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      // Create or update player profile
      const playerProfileData = {
        name: fullName,
        username: username,
        bio: bio || '',
        userId: user.$id, // Link to the Appwrite user ID
        avatar: avatarUri, // Store the avatar URL directly instead of just file ID
        countryId: playerData?.countryId || '', // Include the required countryId field
        status: playerData?.status || 'pending',
        rating: playerData?.rating || 1200,
        createdAt: playerData?.createdAt || new Date().toISOString(), // Add the required createdAt field
      };
      
      // If we're updating an existing profile
      if (playerData) {
        await updateUserProfile(playerData.$id, playerProfileData);
        console.log("Profile updated successfully");
        
        // Check if name was changed
        if (fullName !== originalName) {
          await handleNameChange(fullName, originalName);
        }
      } else {
        // Create new player profile
        const newPlayer = await createDocumentWithPermissions(
          COLLECTION_PLAYERS,
          playerProfileData,
          user.$id // Pass user ID to set appropriate permissions
        );
        
        console.log("New player profile created:", newPlayer.$id);
        setPlayerData(newPlayer);
        setOriginalName(fullName); // Set original name after creation
      }

      Alert.alert("Success", "Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const success = await logout();
      if (success) {
        router.replace('/');
      } else {
        Alert.alert("Error", "Failed to sign out. Please try again.");
      }
    } catch (error) {
      console.error("Sign out error:", error);
      Alert.alert("Error", "An unexpected error occurred while signing out.");
    }
  };

  // Add a function to handle profile image loading with error handling
  const loadProfileImage = async (avatarId: string) => {
    if (!avatarId) return null;
    
    // If it's already a full URL (from custom server), return it directly
    if (avatarId.startsWith('http')) {
      return avatarId;
    }
    
    try {
      // Get the file URL and set the avatar URI
      console.log(`Loading profile image with ID: ${avatarId}`);
      
      // Try to get a direct file URL first
      const avatarUrl = getFileUrl(avatarId);
      console.log(`Using direct avatar URL: ${avatarUrl}`);
      
      // Check if the URL is accessible with a head request
      try {
        const headResponse = await fetch(avatarUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          return avatarUrl;
        } else {
          console.error(`Direct URL returned ${headResponse.status}`);
        }
      } catch (headError) {
        console.error('Error checking direct URL:', headError);
      }
      
      // If direct file access fails, try migration
      console.log(`Attempting to migrate file from legacy buckets...`);
      
      try {
        // Try to migrate the file
        const newFileId = await migrateFile(avatarId);
        
        if (newFileId) {
          console.log(`File migrated successfully to ${newFileId}`);
          
          // Update the player's avatar ID to the new file ID
          if (playerData) {
            await updateUserProfile(playerData.$id, {
              avatar: newFileId
            });
            console.log(`Player profile updated with new avatar ID: ${newFileId}`);
            
            // Show migration notice
            setMigrationNotice(`Your profile image was automatically migrated to a new storage location (ID: ${newFileId.substring(0, 8)}...)`);
            
            // Clear the notice after 5 seconds
            setTimeout(() => {
              setMigrationNotice(null);
            }, 5000);
          }
          
          // Return the URL for the new file
          return getFileUrl(newFileId);
        }
      } catch (migrationError) {
        console.error(`File migration failed:`, migrationError);
      }
      
      // Try legacy buckets directly
      for (const bucketId of LEGACY_BUCKET_IDS) {
        try {
          const legacyUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${avatarId}/view?project=${APPWRITE_PROJECT_ID}`;
          console.log(`Trying legacy bucket URL: ${legacyUrl}`);
          
          const legacyResponse = await fetch(legacyUrl, { method: 'HEAD' });
          if (legacyResponse.ok) {
            console.log(`Legacy URL is accessible`);
            return legacyUrl;
          }
        } catch (legacyError) {
          console.log(`Legacy bucket ${bucketId} error:`, legacyError);
        }
      }
      
      // As a last resort, use a random avatar
      console.log(`Using random avatar as fallback`);
      return generateRandomAvatarUrl(fullName);
      
    } catch (error) {
      console.error(`Error loading profile image:`, error);
      return null;
    }
  };

  // Generate a consistent random avatar URL based on name
  const generateRandomAvatarUrl = (name: string) => {
    // Generate a consistent random color based on the name
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const randomColor = Math.abs(hash).toString(16).substring(0, 6).padEnd(6, '0');
    
    // Use UI Avatars service to generate a nice avatar
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${randomColor}&color=fff&size=256`;
    return avatarUrl;
  };

  if (!isLoaded) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.noUserText}>No user data found.</Text>
        <Button label="Go to Login" onPress={() => router.replace('/')} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!isLoaded ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          ) : (
            <Animated.View style={[styles.profileContainer, profileAnimatedStyle]}>
              <View style={styles.headerContainer}>
                <AnimatedTouchable
                  style={styles.backButton}
                  onPress={() => router.back()}
                  entering={FadeIn.delay(200)}
                >
                  <Ionicons name="arrow-back" size={24} color={THEME.textPrimary} />
                </AnimatedTouchable>
                
                <Text style={styles.headerTitle}>Profile</Text>
                
                {!isEditing ? (
                  <AnimatedTouchable 
                    style={styles.editButton} 
                    onPress={() => setIsEditing(true)}
                    entering={FadeIn.delay(300)}
                  >
                    <Ionicons name="create-outline" size={24} color={THEME.primary} />
                  </AnimatedTouchable>
                ) : (
                  <AnimatedTouchable
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsEditing(false);
                      // Reset fields to original values
                      if (playerData) {
                        setFullName(playerData.name || user.name);
                        setUsername(playerData.username || user.name.replace(/\s+/g, '').toLowerCase());
                        setBio(playerData.bio || '');
                      } else if (user) {
                        setFullName(user.name);
                        setUsername(user.name.replace(/\s+/g, '').toLowerCase());
                      }
                    }}
                    entering={FadeIn.delay(300)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </AnimatedTouchable>
                )}
              </View>

              <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
                {isUploading ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator size="large" color={THEME.white} />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={isEditing ? pickImage : undefined} 
                    disabled={!isEditing || isUploading}
                    style={styles.avatarTouchable}
                    activeOpacity={0.7}
                  >
                    {avatarUri ? (
        <Image
                        source={{ uri: avatarUri }}
          style={styles.avatar}
                        onError={(e) => {
                          console.error("Error loading avatar image:", e.nativeEvent.error);
                          // If image fails to load, try a different approach or show placeholder
                          if (playerData?.avatar) {
                            // Try with a random avatar instead
                            const randomAvatar = generateRandomAvatarUrl(fullName);
                            console.log("Falling back to random avatar:", randomAvatar);
                            setAvatarUri(randomAvatar);
                          } else {
                            // Show placeholder if all approaches fail
                            setAvatarUri(null);
                          }
                        }}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={40} color={THEME.textSecondary} />
      </View>
                    )}
                    {isEditing && (
                      <Animated.View 
                        style={styles.editAvatarBadge}
                        entering={FadeIn.delay(300)}
                      >
                        <Ionicons name="camera" size={18} color={THEME.white} />
                      </Animated.View>
                    )}
                  </TouchableOpacity>
                )}
              </Animated.View>

              {isEditing ? (
                <View style={styles.editFieldContainer}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput 
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                  />
                  
                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput 
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Your username (no spaces)"
                    autoCapitalize="none"
                  />
                  
                  <Text style={styles.fieldLabel}>Bio</Text>
                  <TextInput 
                    style={[styles.input, styles.bioInput]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    multiline
                    numberOfLines={4}
                  />
                </View>
              ) : (
                <>
                  <Text style={styles.nameText}>{fullName || user.name}</Text>
                  {isNameChangeRequested && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingText}>Name change pending</Text>
                    </View>
                  )}
                  <Text style={styles.usernameText}>@{username || user.name.replace(/\s+/g, '').toLowerCase()}</Text>
                  <Text style={styles.emailText}>{user.email}</Text>
                  {playerData?.bio && <Text style={styles.bioText}>{playerData.bio}</Text>}
                </>
              )}

      {/* Actions */}
      <View style={styles.actionsSection}>
                {isEditing ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.saveButton]}
                      onPress={saveChanges}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Ionicons name="save-outline" size={20} color="white" />
                          <Text style={[styles.actionText, { color: 'white' }]}>Save Changes</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      <Ionicons name="close-outline" size={20} color="#333" />
                      <Text style={styles.actionText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
        <TouchableOpacity
          style={styles.actionButton}
                    onPress={() => setIsEditing(true)}
        >
          <Ionicons name="pencil-outline" size={20} color="#333" />
          <Text style={styles.actionText}>Edit Profile</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/test-upload')}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#333" />
                  <Text style={styles.actionText}>Test Upload Tool</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
                  onPress={() => router.push('/dev-tools')}
                >
                  <Ionicons name="code-working-outline" size={20} color="#333" />
                  <Text style={styles.actionText}>Developer Tools</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.signoutButton]}
          onPress={() =>
            Alert.alert("Confirm Logout", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign Out",
                style: "destructive",
                        onPress: handleSignOut,
              },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={20} color="red" />
          <Text style={[styles.actionText, { color: 'red' }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

              {migrationNotice && (
                <Animated.View 
                  style={styles.migrationNotice}
                  entering={FadeIn.duration(300)}
                >
                  <Text style={styles.migrationText}>{migrationNotice}</Text>
                </Animated.View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.white,
  },
  noUserText: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.white,
  },
  profileContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.primary,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarTouchable: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'visible',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: THEME.primary,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.lightGray,
    borderWidth: 3,
    borderColor: THEME.primary,
  },
  avatarLoading: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 3,
    borderColor: THEME.primary,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.white,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  pendingBadge: {
    backgroundColor: THEME.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  pendingText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  usernameText: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  emailText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  actionsSection: {
    marginTop: 40,
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.light,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  actionText: {
    marginLeft: 8,
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: THEME.primary,
  },
  signoutButton: {
    marginTop: 16,
  },
  editFieldContainer: {
    width: '100%',
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: THEME.light,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: THEME.textPrimary,
    marginBottom: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: THEME.textPrimary,
    marginTop: 12,
  },
  uploadingText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  migrationNotice: {
    backgroundColor: THEME.info,
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  migrationText: {
    color: THEME.white,
    fontSize: 12,
    textAlign: 'center',
  },
});

