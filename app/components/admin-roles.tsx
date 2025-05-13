import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import appwrite, { 
  databases, 
  COLLECTION_COUNTRIES, 
  APPWRITE_DATABASE_ID,
  COLLECTION_USERS,
  account,
  getCurrentSession,
  getCountries,
  ID,
  STORAGE_BUCKET_ID,
  APPWRITE_PROJECT_ID,
} from '@/lib/appwrite';
import { 
  isOrganizer,
  COLLECTION_ADMIN_ROLES,
  AdminRoleType,
  AdminRole,
  addAdminRoleByUsername,
  deleteAdminRole,
  updateAdminRole,
} from '@/lib/permissionsHelper';
import { Query } from 'react-native-appwrite';
import { Role, Permission } from 'react-native-appwrite';
import { useUser } from '@clerk/clerk-expo';
import { THEME, SHADOWS, SPACING, BORDER_RADIUS } from '@/app/utils/theme';

// Interface for country data
interface Country {
  $id: string;
  name: string;
  flag: string;
  playerCount?: number;
  $collectionId?: string;
  $databaseId?: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
}

// Interface for user data (basic info)
interface User {
  $id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl?: string;
  clerkId: string;
}

// Extended AdminRole with userName
export interface ExtendedAdminRole extends AdminRole {
  userName?: string;
  avatarUrl?: string;
}

export default function AdminRolesPage() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminRoles, setAdminRoles] = useState<ExtendedAdminRole[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<ExtendedAdminRole | null>(null);
  
  // Form state
  const [clerkId, setClerkId] = useState('');
  const [username, setUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminRoleType>(AdminRoleType.DYNASTY_ADMIN);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [addByUsername, setAddByUsername] = useState(true);
  
  useEffect(() => {
    checkAccess();
  }, []);

  // Check if the current user is an organizer
  const checkAccess = async () => {
    try {
      if (!clerkUser) {
        Alert.alert("Not Authenticated", "Please log in to access this page");
        router.replace('/');
        return;
      }

      const currentClerkId = clerkUser.id;
      
      const isUserOrganizer = await isOrganizer(currentClerkId);
      if (!isUserOrganizer) {
        Alert.alert(
          "Access Denied", 
          "You don't have permission to manage admin roles",
          [{ text: "OK", onPress: () => router.replace('/') }]
        );
        return;
      }
      
      // Load admin roles and countries
      await Promise.all([
        loadAdminRoles(),
        loadCountries()
      ]);
    } catch (error) {
      console.error("Error checking access:", error);
      Alert.alert("Error", "Failed to verify admin status");
    }
  };

  // Load all admin roles
  const loadAdminRoles = async () => {
    try {
      setLoading(true);
      
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES
      );
      
      // Get all clerk IDs from admin roles
      const clerkIds = response.documents.map((role: any) => role.clerkId);
      
      // Batch fetch all users in one query (much more efficient)
      const usersResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_USERS,
        [
          Query.equal('clerkId', clerkIds),
          Query.limit(100)
        ]
      );
      
      // Create a map of clerkId -> userData for quick lookups
      const userDataMap: {[key: string]: any} = {};
      usersResponse.documents.forEach(user => {
        userDataMap[user.clerkId] = user;
      });
      
      console.log(`Found ${usersResponse.documents.length} user records for ${clerkIds.length} admin roles`);
      
      // Enrich admin roles with user data
      const enrichedRoles = response.documents.map((role: any) => {
        const userData = userDataMap[role.clerkId];
        
        // Log avatar info for debugging
        if (userData?.avatarUrl) {
          console.log(`Avatar for ${userData.username || role.username}: ${userData.avatarUrl}`);
        }
        
        return {
          ...role,
          userName: role.name || (userData?.name) || 'Unknown User',
          username: role.username || (userData?.username) || 'unknown',
          avatarUrl: userData?.avatarUrl || null,
        };
      });
      
      setAdminRoles(enrichedRoles);
    } catch (error) {
      console.error("Error loading admin roles:", error);
      Alert.alert("Error", "Failed to load admin roles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load all countries
  const loadCountries = async () => {
    try {
      const countriesData = await getCountries();
      setCountries(countriesData as Country[]);
    } catch (error) {
      console.error("Error loading countries:", error);
      Alert.alert("Error", "Failed to load countries");
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadAdminRoles();
  };

  // Handle role creation/update
  const handleSaveRole = async () => {
    try {
      if (addByUsername) {
        // Add admin by username
        if (!username) {
          Alert.alert("Error", "Please enter a username");
          return;
        }
        
        if (selectedRole === AdminRoleType.DYNASTY_ADMIN && !selectedCountryId) {
          Alert.alert("Error", "Please select a country for the dynasty admin");
          return;
        }
        
        setLoading(true);
        
        // Use the addAdminRoleByUsername function from permissionsHelper
        const result = await addAdminRoleByUsername(
          username, 
          selectedRole, 
          selectedRole === AdminRoleType.DYNASTY_ADMIN ? selectedCountryId || undefined : undefined
        );
        
        if (result.success) {
          Alert.alert("Success", result.message);
          resetForm();
          setModalVisible(false);
          loadAdminRoles();
        } else {
          Alert.alert("Error", result.message);
        }
      } else {
        // Traditional method using Clerk ID
        if (!clerkId) {
          Alert.alert("Error", "Please enter a Clerk User ID");
          return;
        }
        
        if (selectedRole === AdminRoleType.DYNASTY_ADMIN && !selectedCountryId) {
          Alert.alert("Error", "Please select a country for the dynasty admin");
          return;
        }
        
        setLoading(true);
        
        const roleData: {
          clerkId: string;
          role: AdminRoleType;
          name: string;
          dynastyId?: string;
          username?: string;
        } = {
          clerkId,
          role: selectedRole,
          name: foundUser?.name || 'Unknown User',
        };
        
        // Add username if available
        if (foundUser?.username) {
          roleData.username = foundUser.username;
        }
        
        // Only include dynastyId for dynasty admins
        if (selectedRole === AdminRoleType.DYNASTY_ADMIN && selectedCountryId) {
          roleData.dynastyId = selectedCountryId;
        }
        
        if (editingRole) {
          // Update existing role using the proper function
          const result = await updateAdminRole(
            editingRole.$id,
            selectedRole,
            selectedRole === AdminRoleType.DYNASTY_ADMIN ? selectedCountryId || undefined : undefined
          );
          
          if (result.success) {
            Alert.alert("Success", result.message);
          } else {
            Alert.alert("Error", result.message);
          }
        } else {
          // Create new role
          const newRole = await databases.createDocument(
            APPWRITE_DATABASE_ID,
            COLLECTION_ADMIN_ROLES,
            ID.unique(),
            roleData,
            [
              Permission.read(Role.any()) // Everyone can read
            ]
          );
          
          Alert.alert("Success", "Admin role created successfully");
        }
        
        // Reset form and close modal
        resetForm();
        setModalVisible(false);
        
        // Refresh the list
        loadAdminRoles();
      }
    } catch (error) {
      console.error("Error saving admin role:", error);
      Alert.alert("Error", "Failed to save admin role");
    } finally {
      setLoading(false);
    }
  };

  // Handle role deletion
  const handleDeleteRole = async (role: ExtendedAdminRole) => {
    try {
      Alert.alert(
        "Confirm Deletion",
        `Are you sure you want to remove admin role for ${role.userName || role.clerkId}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setLoading(true);
              
              const result = await deleteAdminRole(role.$id);
              
              if (result.success) {
                Alert.alert("Success", result.message);
              } else {
                Alert.alert("Error", result.message);
              }
              
              loadAdminRoles();
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error deleting admin role:", error);
      Alert.alert("Error", "Failed to delete admin role");
    } finally {
      setLoading(false);
    }
  };

  // Reset the form state
  const resetForm = () => {
    setClerkId("");
    setUsername("");
    setUserEmail("");
    setFoundUser(null);
    setSelectedRole(AdminRoleType.DYNASTY_ADMIN);
    setSelectedCountryId(null);
    setEditingRole(null);
  };

  // Open edit modal with pre-filled data
  const openEditModal = (role: ExtendedAdminRole) => {
    setEditingRole(role);
    setClerkId(role.clerkId);
    setUsername(role.username || '');
    setSelectedRole(role.role as AdminRoleType);
    setSelectedCountryId(role.dynastyId || null);
    setModalVisible(true);
    setAddByUsername(false); // Default to Clerk ID when editing
  };

  // Get country name by ID
  const getCountryName = (countryId: string) => {
    const country = countries.find((c) => c.$id === countryId);
    return country ? `${country.flag} ${country.name}` : countryId;
  };

  // Filter roles based on search
  const getFilteredRoles = () => {
    if (!searchQuery) return adminRoles;
    
    return adminRoles.filter((role) => {
      const countryName = role.dynastyId ? getCountryName(role.dynastyId).toLowerCase() : "";
      return (
        role.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.clerkId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        countryName.includes(searchQuery.toLowerCase())
      );
    });
  };

  // Lookup user by username
  const lookupUserByUsername = async () => {
    if (!username) {
      Alert.alert("Error", "Please enter a username to look up");
      return;
    }
    
    try {
      setLookupLoading(true);
      
      // Look up the user by username in the users collection
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_USERS,
        [Query.equal('username', username)]
      );
      
      if (response.documents.length === 0) {
        Alert.alert("User Not Found", `No user found with username: ${username}`);
        setFoundUser(null);
        return;
      }
      
      const user = response.documents[0];
      
      // Set the form fields with the user data
      setClerkId(user.clerkId || '');
      setUserEmail(user.email || '');
      
      // Store the full user data
      setFoundUser(user as unknown as User);
    } catch (error) {
      console.error("Error looking up user:", error);
      Alert.alert("Error", "Failed to look up user");
      setFoundUser(null);
    } finally {
      setLookupLoading(false);
    }
  };

  // Render role card
  const renderRoleCard = ({ item: role }: { item: ExtendedAdminRole }) => {
    // Handle different avatar URL formats
    let avatarUrl;
    if (role.avatarUrl) {
      // If it's already a full URL, use it as is
      if (role.avatarUrl.startsWith('http')) {
        avatarUrl = role.avatarUrl;
      } 
      // If it's a storage file ID, construct the proper Appwrite storage URL
      else {
        avatarUrl = `https://cloud.appwrite.io/v1/storage/buckets/${STORAGE_BUCKET_ID}/files/${role.avatarUrl}/view?project=${APPWRITE_PROJECT_ID}`;
      }
    } else {
      // Fallback to a generated avatar from UI Avatars
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(role.userName || 'Admin')}&background=f97316&color=fff&size=150`;
    }
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: avatarUrl }} 
              style={styles.avatar} 
            />
          </View>
          
          <View style={styles.roleInfo}>
            <Text style={styles.roleName}>{role.userName || 'Unknown User'}</Text>
            <Text style={styles.userUsername}>@{role.username || 'username'}</Text>
            <Text style={styles.userId}>ID: {role.clerkId}</Text>
            
            <View style={styles.badgeContainer}>
              <View 
                style={[
                  styles.roleBadgeWrapper,
                  { 
                    backgroundColor: 
                      role.role === AdminRoleType.ORGANIZER 
                        ? `${THEME.primary}20`
                        : `${THEME.success}20` 
                  }
                ]}
              >
                <Ionicons 
                  name={role.role === AdminRoleType.ORGANIZER ? "shield" : "flag"} 
                  size={14} 
                  color={role.role === AdminRoleType.ORGANIZER ? THEME.primary : THEME.success} 
                  style={styles.badgeIcon}
                />
                <Text 
                  style={[
                    styles.roleBadge,
                    { 
                      color: role.role === AdminRoleType.ORGANIZER ? THEME.primary : THEME.success
                    }
                  ]}
                >
                  {role.role === AdminRoleType.ORGANIZER ? 'Organizer' : 'Dynasty Admin'}
                </Text>
              </View>
              
              {role.role === AdminRoleType.DYNASTY_ADMIN && role.dynastyId && (
                <View style={styles.countryBadge}>
                  <Text style={styles.countryText}>
                    {getCountryName(role.dynastyId)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: THEME.lightGray }]}
            onPress={() => openEditModal(role)}
          >
            <Ionicons name="pencil-outline" size={18} color={THEME.textPrimary} />
            <Text style={[styles.actionButtonText, { color: THEME.textPrimary }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: THEME.danger + '20' }]}
            onPress={() => handleDeleteRole(role)}
          >
            <Ionicons name="trash-outline" size={18} color={THEME.danger} />
            <Text style={[styles.actionButtonText, { color: THEME.danger }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading admin roles...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Roles Management</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={THEME.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by user or country..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      {/* Admin roles list */}
      <FlatList
        data={getFilteredRoles()}
        renderItem={renderRoleCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={64} color={THEME.lightGray} />
            <Text style={styles.emptyText}>No admin roles found</Text>
          </View>
        }
      />
      
      {/* Add button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setAddByUsername(true); // Default to username lookup when adding new admin
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={24} color={THEME.white} />
      </TouchableOpacity>
      
      {/* Add/Edit modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRole ? 'Edit Admin Role' : 'Add New Admin'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              {!editingRole && (
                <View style={styles.methodToggle}>
                  <TouchableOpacity
                    style={[
                      styles.methodOption,
                      addByUsername && styles.methodOptionSelected
                    ]}
                    onPress={() => setAddByUsername(true)}
                  >
                    <Text style={[
                      styles.methodOptionText,
                      addByUsername && styles.methodOptionTextSelected
                    ]}>
                      By Username
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.methodOption,
                      !addByUsername && styles.methodOptionSelected
                    ]}
                    onPress={() => setAddByUsername(false)}
                  >
                    <Text style={[
                      styles.methodOptionText,
                      !addByUsername && styles.methodOptionTextSelected
                    ]}>
                      By Clerk ID
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {addByUsername && !editingRole ? (
                /* Username lookup form */
                <View>
                  <Text style={styles.inputLabel}>Username</Text>
                  <View style={styles.lookupContainer}>
                    <TextInput
                      style={styles.lookupInput}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Enter username"
                    />
                    <TouchableOpacity
                      style={[
                        styles.lookupButton,
                        (!username || lookupLoading) && styles.lookupButtonDisabled
                      ]}
                      onPress={lookupUserByUsername}
                      disabled={lookupLoading || !username}
                    >
                      {lookupLoading ? (
                        <ActivityIndicator size="small" color={THEME.white} />
                      ) : (
                        <Text style={styles.lookupButtonText}>Verify</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  {/* User info card after verification */}
                  {foundUser && (
                    <View style={styles.userCard}>
                      <View style={styles.userCardHeader}>
                        <Image 
                          source={{ 
                            uri: foundUser.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(foundUser.name || foundUser.username) 
                          }} 
                          style={styles.userAvatar} 
                        />
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{foundUser.name || 'No Name'}</Text>
                          <Text style={styles.userUsername}>@{foundUser.username}</Text>
                          {foundUser.email && (
                            <Text style={styles.userEmail}>
                              <MaterialIcons name="email" size={14} color={THEME.textSecondary} /> {foundUser.email}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.userMeta}>
                        <Text style={styles.userClerkId}>
                          <MaterialIcons name="verified-user" size={14} color={THEME.primary} /> Clerk ID: {foundUser.clerkId}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                /* Clerk ID form */
                <>
                  <Text style={styles.inputLabel}>Clerk User ID (Required)</Text>
                  <TextInput
                    style={styles.input}
                    value={clerkId}
                    onChangeText={setClerkId}
                    placeholder="Enter Clerk User ID"
                    editable={!editingRole} // Can't change user ID when editing
                  />
                </>
              )}
              
              {/* Role Selection */}
              <Text style={styles.inputLabel}>Role Type</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    selectedRole === AdminRoleType.ORGANIZER && styles.selectedRoleOption
                  ]}
                  onPress={() => setSelectedRole(AdminRoleType.ORGANIZER)}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === AdminRoleType.ORGANIZER && styles.selectedRoleOptionText
                    ]}
                  >
                    Organizer
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    selectedRole === AdminRoleType.DYNASTY_ADMIN && styles.selectedRoleOption
                  ]}
                  onPress={() => setSelectedRole(AdminRoleType.DYNASTY_ADMIN)}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === AdminRoleType.DYNASTY_ADMIN && styles.selectedRoleOptionText
                    ]}
                  >
                    Dynasty Admin
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Country Selection (only for Dynasty Admins) */}
              {selectedRole === AdminRoleType.DYNASTY_ADMIN && (
                <>
                  <Text style={styles.inputLabel}>Country (Required for Dynasty Admin)</Text>
                  <ScrollView 
                    style={styles.countriesList}
                    nestedScrollEnabled={true}
                    contentContainerStyle={styles.countriesListContent}
                  >
                    {countries.map((country) => (
                      <TouchableOpacity
                        key={country.$id}
                        style={[
                          styles.countryOption,
                          selectedCountryId === country.$id && styles.selectedCountryOption
                        ]}
                        onPress={() => setSelectedCountryId(country.$id)}
                      >
                        <Text style={styles.countryOptionFlag}>{country.flag}</Text>
                        <View style={styles.countryDetails}>
                          <Text style={styles.countryOptionName}>{country.name}</Text>
                          {country.playerCount !== undefined && (
                            <Text style={styles.countryOptionCount}>
                              {country.playerCount} players
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              
              {/* Submit button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (
                    (addByUsername && !foundUser) || 
                    (!addByUsername && !clerkId) ||
                    (selectedRole === AdminRoleType.DYNASTY_ADMIN && !selectedCountryId)
                  ) ? styles.submitButtonDisabled : {}
                ]}
                onPress={handleSaveRole}
                disabled={
                  (addByUsername && !foundUser) || 
                  (!addByUsername && !clerkId) ||
                  (selectedRole === AdminRoleType.DYNASTY_ADMIN && !selectedCountryId)
                }
              >
                <Text style={styles.submitButtonText}>
                  {editingRole ? 'Update Admin Role' : 'Add Admin Role'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.light,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.textSecondary,
  },
  header: {
    backgroundColor: THEME.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.light,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Extra space for the add button
  },
  card: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.small
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.lightGray,
    borderWidth: 2,
    borderColor: THEME.primary + '30',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: THEME.primary,
    marginBottom: 2,
  },
  userId: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  roleBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    marginRight: 8,
    marginBottom: 4,
  },
  badgeIcon: {
    marginRight: 4,
  },
  roleBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  countryBadge: {
    backgroundColor: THEME.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: 4,
  },
  countryText: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: THEME.light,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    color: THEME.textPrimary,
  },
  methodToggle: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  methodOption: {
    flex: 1,
    padding: 12,
    backgroundColor: THEME.light,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    alignItems: 'center',
  },
  methodOptionSelected: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  methodOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  methodOptionTextSelected: {
    color: THEME.white,
  },
  lookupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.light,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    marginBottom: 16,
  },
  lookupInput: {
    flex: 1,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  lookupButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: 8,
  },
  lookupButtonDisabled: {
    backgroundColor: THEME.mediumGray,
    opacity: 0.7,
  },
  lookupButtonText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '500',
  },
  userCard: {
    backgroundColor: THEME.primaryTransparent,
    borderWidth: 1,
    borderColor: THEME.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: THEME.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: THEME.textSecondary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMeta: {
    borderTopWidth: 1,
    borderTopColor: THEME.primaryLight,
    paddingTop: 8,
  },
  userClerkId: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    padding: 12,
    backgroundColor: THEME.light,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    alignItems: 'center',
  },
  selectedRoleOption: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  selectedRoleOptionText: {
    color: THEME.white,
  },
  countryOption: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedCountryOption: {
    backgroundColor: THEME.primaryTransparent,
    borderColor: THEME.primary,
  },
  countryOptionFlag: {
    fontSize: 20,
    marginRight: 10,
  },
  countryDetails: {
    flex: 1,
  },
  countryOptionName: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  countryOptionCount: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  countriesList: {
    maxHeight: 250,
    height: 250,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 16,
  },
  countriesListContent: {
    padding: 8,
  },
  submitButton: {
    backgroundColor: THEME.primary,
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: THEME.lightGray,
    opacity: 0.7,
  },
  submitButtonText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
  },
}); 