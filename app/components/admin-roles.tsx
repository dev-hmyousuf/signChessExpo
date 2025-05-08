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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import appwrite, { 
  databases, 
  COLLECTION_COUNTRIES, 
  APPWRITE_DATABASE_ID, 
  account,
  getCurrentSession,
  getCountries,
  ID,
} from '@/lib/appwrite';
import { 
  isOrganizer,
  COLLECTION_ADMIN_ROLES,
  AdminRoleType,
  AdminRole
} from '@/lib/permissionsHelper';
import { Query } from 'appwrite';
import { Role, Permission } from 'appwrite';

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
}

// Extended AdminRole with userName
interface ExtendedAdminRole extends AdminRole {
  userName?: string;
}

export default function AdminRolesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminRoles, setAdminRoles] = useState<ExtendedAdminRole[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<ExtendedAdminRole | null>(null);
  
  // Form state
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AdminRoleType>(AdminRoleType.DYNASTY_ADMIN);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date('2026-01-01T00:00:00'));

  useEffect(() => {
    checkAccess();
  }, []);

  // Check if the current user is an organizer
  const checkAccess = async () => {
    try {
      const session = await getCurrentSession();
      if (!session) {
        Alert.alert("Not Authenticated", "Please log in to access this page");
        router.replace('/');
        return;
      }

      const userData = await account.get();
      const currentUserId = userData.$id;
      
      const isUserOrganizer = await isOrganizer(currentUserId);
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
      
      // Use stored userName or fall back to userId if not available
      const enrichedRoles = response.documents.map((role: any) => {
        return {
          ...role,
          // Use the stored userName if available, otherwise fall back to userId
          userName: role.userName || role.userId || 'Unknown User'
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
      if (!userId) {
        Alert.alert("Error", "Please enter a user ID");
        return;
      }
      
      if (selectedRole === AdminRoleType.DYNASTY_ADMIN && !selectedCountryId) {
        Alert.alert("Error", "Please select a country for the dynasty admin");
        return;
      }
      
      setLoading(true);
      
      const roleData: any = {
        userId,
        role: selectedRole,
        userName: userName || 'Unknown User', // Save the user name
      };
      
      // Only include dynastyId for dynasty admins
      if (selectedRole === AdminRoleType.DYNASTY_ADMIN) {
        roleData.dynastyId = selectedCountryId;
      }
      
      if (editingRole) {
        // Update existing role
        await databases.updateDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_ADMIN_ROLES,
          editingRole.$id,
          roleData
        );
        
        Alert.alert("Success", "Admin role updated successfully");
      } else {
        // Create new role with appropriate permissions
        const newRole = await databases.createDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_ADMIN_ROLES,
          ID.unique(),
          roleData,
          [
            Permission.read(Role.any()),
            Permission.write(Role.team('681a3dde00205f693d9d')),
            Permission.update(Role.team('681a3dde00205f693d9d')),
            Permission.delete(Role.team('681a3dde00205f693d9d'))
          ]
        );
        
        Alert.alert("Success", "Admin role created successfully");
      }
      
      // Reset form and close modal
      resetForm();
      setModalVisible(false);
      
      // Refresh the list
      loadAdminRoles();
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
        `Are you sure you want to remove admin role for ${role.userName || role.userId}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setLoading(true);
              
              await databases.deleteDocument(
                APPWRITE_DATABASE_ID,
                COLLECTION_ADMIN_ROLES,
                role.$id
              );
              
              Alert.alert("Success", "Admin role deleted successfully");
              loadAdminRoles();
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error deleting admin role:", error);
      Alert.alert("Error", "Failed to delete admin role");
      setLoading(false);
    }
  };

  // Reset form state
  const resetForm = () => {
    setEditingRole(null);
    setUserId('');
    setUserEmail('');
    setUserName('');
    setSelectedRole(AdminRoleType.DYNASTY_ADMIN);
    setSelectedCountryId(null);
    setScheduledDate(new Date('2026-01-01T00:00:00'));
  };

  // Open modal for editing
  const openEditModal = (role: ExtendedAdminRole) => {
    setEditingRole(role);
    setUserId(role.userId);
    setUserName(role.userName || '');
    setSelectedRole(role.role as AdminRoleType);
    setSelectedCountryId(role.dynastyId || null);
    setModalVisible(true);
  };

  // Find country name by ID
  const getCountryName = (countryId: string) => {
    const country = countries.find(c => c.$id === countryId);
    return country ? `${country.flag} ${country.name}` : 'Unknown Country';
  };

  // Filter admin roles based on search query
  const getFilteredRoles = () => {
    if (!searchQuery.trim()) return adminRoles;
    
    return adminRoles.filter(role => 
      (role.userName && role.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      role.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (role.dynastyId && getCountryName(role.dynastyId).toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  // Disable the lookup functionality
  const lookupUserByEmail = async (email: string) => {
    Alert.alert("Feature Disabled", "User lookup by email has been disabled.");
  };

  // Render role card
  const renderRoleCard = ({ item: role }: { item: ExtendedAdminRole }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.roleInfo}>
            <Text style={styles.roleName}>{role.userName || 'Unknown User'}</Text>
            <Text style={styles.userId}>ID: {role.userId}</Text>
            
            <View style={styles.badgeContainer}>
              <Text 
                style={[
                  styles.roleBadge,
                  { 
                    backgroundColor: 
                      role.role === AdminRoleType.ORGANIZER ? '#3b82f6' : '#10b981'
                  }
                ]}
              >
                {role.role === AdminRoleType.ORGANIZER ? 'Organizer' : 'Dynasty Admin'}
              </Text>
              
              {role.role === AdminRoleType.DYNASTY_ADMIN && role.dynastyId && (
                <Text style={styles.countryText}>
                  {getCountryName(role.dynastyId)}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f3f4f6' }]}
            onPress={() => openEditModal(role)}
          >
            <Ionicons name="pencil-outline" size={18} color="#4b5563" />
            <Text style={[styles.actionButtonText, { color: '#4b5563' }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
            onPress={() => handleDeleteRole(role)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
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
          <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.searchIcon} />
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
            colors={['#3b82f6']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No admin roles found</Text>
          </View>
        }
      />
      
      {/* Add button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={24} color="white" />
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
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              {/* User ID Field */}
              <Text style={styles.inputLabel}>User ID (Required)</Text>
              <TextInput
                style={styles.input}
                value={userId}
                onChangeText={setUserId}
                placeholder="Enter Appwrite User ID"
                editable={!editingRole} // Can't change user ID when editing
              />
              
              {/* User Name Field */}
              <Text style={styles.inputLabel}>User Name</Text>
              <TextInput
                style={styles.input}
                value={userName}
                onChangeText={setUserName}
                placeholder="Enter user's display name"
              />
              
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
              
              {/* Country Selection (for Dynasty Admins) */}
              {selectedRole === AdminRoleType.DYNASTY_ADMIN && (
                <>
                  <Text style={styles.inputLabel}>Country/Dynasty</Text>
                  <ScrollView 
                    style={styles.countryListContainer}
                    contentContainerStyle={styles.countryList}
                  >
                    {countries.map(country => (
                      <TouchableOpacity
                        key={country.$id}
                        style={[
                          styles.countryOption,
                          selectedCountryId === country.$id && styles.selectedCountryOption
                        ]}
                        onPress={() => setSelectedCountryId(country.$id)}
                      >
                        <Text style={styles.countryOptionText}>
                          {country.flag} {country.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              
              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSaveRole}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingRole ? 'Update Admin Role' : 'Add Admin Role'}
                  </Text>
                )}
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
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4b5563',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#1f2937',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Extra space for the add button
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
    marginBottom: 4,
  },
  countryText: {
    fontSize: 14,
    color: '#4b5563',
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
    borderRadius: 6,
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
    color: '#6b7280',
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    color: '#4b5563',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  emailContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  emailInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  lookupButton: {
    backgroundColor: '#3b82f6',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  lookupButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  lookupButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  selectedRoleOption: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  selectedRoleOptionText: {
    color: 'white',
  },
  countryListContainer: {
    maxHeight: 160,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  countryList: {
    padding: 8,
  },
  countryOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedCountryOption: {
    backgroundColor: '#dbeafe',
  },
  countryOptionText: {
    fontSize: 14,
    color: '#1f2937',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  userInfoText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontWeight: '500',
  },
}); 