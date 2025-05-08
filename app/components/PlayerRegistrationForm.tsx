import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { useRouter } from 'expo-router';
import { 
  COLLECTION_PLAYERS, 
  createDocumentWithPermissions, 
  account, 
  databases, 
  APPWRITE_DATABASE_ID,
  getCountries
} from '@/lib/appwrite';
import { THEME, BORDER_RADIUS } from '@/app/utils/theme';

interface PlayerRegistrationProps {
  countryId?: string; // Make countryId optional
  onComplete?: () => void;
}

interface Country {
  $id: string;
  name: string;
  flag: string;
}

// Helper function to get flag emojis that will display correctly
const getFlagEmoji = (code: string) => {
  // Map of country codes to flag emojis that are known to render properly
  const flagEmojis: { [key: string]: string } = {
    'bd': '🇧🇩',
    'ng': '🇳🇬',
    'pk': '🇵🇰',
    'in': '🇮🇳',
    'pl': '🇵🇱',
    'ph': '🇵🇭',
    'kr': '🇰🇷',
    'jp': '🇯🇵',
    'tr': '🇹🇷',
    // Add more countries as needed
  };
  
  return flagEmojis[code.toLowerCase()] || '🏳️';
};

const PlayerRegistrationForm = ({ 
  countryId,
  onComplete
}: PlayerRegistrationProps) => {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [twitterUsername, setTwitterUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Country selection states
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const windowHeight = Dimensions.get('window').height;
  const sheetMaxHeight = windowHeight * 0.6; // 60% of screen height

  // Get the user ID from Appwrite account
  useEffect(() => {
    const getUserId = async () => {
      try {
        const user = await account.get();
        setUserId(user.$id);
      } catch (err) {
        console.error('Failed to get user ID:', err);
        setError('Authentication error. Please try logging in again.');
      }
    };

    getUserId();
  }, []);

  // Fetch available countries
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        console.log("Starting to fetch countries...");
        setCountriesLoading(true);
        const countriesData = await getCountries();
        console.log("Countries data received:", JSON.stringify(countriesData));
        
        // Convert document data to Country type
        const typedCountries = countriesData.map(country => ({
          $id: country.$id,
          name: country.name as string,
          flag: getFlagEmoji(country.flag as string) // Use direct emoji mapping
        }));
        
        console.log("Typed countries with emoji flags:", JSON.stringify(typedCountries));
        setCountries(typedCountries);
        setFilteredCountries(typedCountries);
        
        // If countryId was provided, set the selected country
        if (countryId) {
          console.log("Looking for country with ID:", countryId);
          const preSelectedCountry = typedCountries.find(country => country.$id === countryId);
          if (preSelectedCountry) {
            console.log("Found pre-selected country:", JSON.stringify(preSelectedCountry));
            setSelectedCountry(preSelectedCountry);
          }
        }
      } catch (err) {
        console.error("Failed to fetch countries:", err);
        setError('Failed to load countries. Please try again.');
      } finally {
        setCountriesLoading(false);
      }
    };

    fetchCountries();
  }, [countryId]);

  // Effect for filtering countries based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCountries(countries);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = countries.filter(country => 
      country.name.toLowerCase().includes(query)
    );
    
    setFilteredCountries(filtered);
  }, [searchQuery, countries]);

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!bio.trim()) {
      setError('Please provide a short bio about yourself');
      return;
    }

    if (!selectedCountry) {
      setError('Please select a country you want to represent');
      return;
    }

    if (!userId) {
      setError('You must be logged in to register');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create player registration request in database with proper permissions
      await createDocumentWithPermissions(
        COLLECTION_PLAYERS,
        {
          name: name.trim(),
          bio: bio.trim(),
          countryId: selectedCountry.$id,
          userId: userId,
          twitterUsername: twitterUsername.trim().replace('@', ''), // Remove @ if user included it
          rating: 1500, // Default rating
          status: 'pending', // Pending admin approval
          createdAt: new Date().toISOString(),
          avatar: '🏏' // Default avatar
        },
        userId
      );

      // Show success message
      setSubmitSuccess(true);

      // Success
      Alert.alert(
        'Registration Submitted',
        'Your player registration has been submitted for approval. You will be notified once approved by an administrator.',
        [{ 
          text: 'OK',
          onPress: () => {
            if (onComplete) {
              onComplete();
            }
          }
        }]
      );
    } catch (err) {
      console.error('Registration error:', err);
      setError('Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openBottomSheet = () => {
    console.log("Opening bottom sheet, countries count:", countries.length);
    setSearchQuery(''); // Reset search when opening
    setFilteredCountries(countries);
    setCountryModalVisible(true);
    
    // Animate bottom sheet up
    setTimeout(() => {
      Animated.spring(bottomSheetAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    }, 10);
  };
  
  const closeBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCountryModalVisible(false);
    });
  };

  const handleCountryPress = () => {
    openBottomSheet();
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity 
      style={[
        styles.countryItem,
        selectedCountry && selectedCountry.$id === item.$id ? styles.countryItemSelected : null
      ]}
      onPress={() => {
        console.log("Selected country:", item.name);
        setSelectedCountry(item);
        closeBottomSheet();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.countryFlagContainer}>
        <Text style={styles.countryItemFlag}>{item.flag}</Text>
      </View>
      <Text style={styles.countryItemName}>{item.name}</Text>
      {selectedCountry && selectedCountry.$id === item.$id && (
        <Ionicons name="checkmark-circle" size={22} color={THEME.success} style={styles.countrySelectedIcon} />
      )}
    </TouchableOpacity>
  );

  if (submitSuccess) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={64} color={THEME.success} />
        <Text style={styles.successTitle}>Registration Submitted</Text>
        <Text style={styles.successText}>
          Your player registration has been submitted and is pending administrator approval.
          You will be notified once approved.
        </Text>
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => {
            if (onComplete) {
              onComplete();
            } else {
              router.replace('/');
            }
          }}
        >
          <Text style={styles.returnButtonText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.formContent}>
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={18} color={THEME.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />
          <Text style={styles.helperText}>This will be displayed in tournaments</Text>
        </View>

        {/* Country Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Representing Country <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity 
            style={[
              styles.input, 
              styles.countrySelector,
              selectedCountry ? styles.selectedCountryField : null
            ]}
            onPress={handleCountryPress}
            disabled={loading || countriesLoading}
            activeOpacity={0.7}
          >
            {selectedCountry ? (
              <View style={styles.selectedCountry}>
                <View style={styles.selectedCountryFlag}>
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                </View>
                <Text style={styles.selectedCountryName}>{selectedCountry.name}</Text>
              </View>
            ) : countriesLoading ? (
              <View style={styles.countryLoading}>
                <ActivityIndicator size="small" color={THEME.primary} />
                <Text style={styles.countryPlaceholder}>Loading countries...</Text>
              </View>
            ) : (
              <View style={styles.unselectedCountry}>
                <View style={styles.emptyFlagContainer}>
                  <Ionicons name="flag-outline" size={18} color={THEME.textSecondary} />
                </View>
                <Text style={styles.countryPlaceholder}>Select your country</Text>
              </View>
            )}
            <View style={styles.selectorIconContainer}>
              <Ionicons name="chevron-down" size={18} color={THEME.textPrimary} />
            </View>
          </TouchableOpacity>
          {selectedCountry ? (
            <Text style={styles.helperText}>You will represent {selectedCountry.name} in tournaments</Text>
          ) : (
            <Text style={styles.helperText}>Select the country you wish to represent</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>X/Twitter Username</Text>
          <TextInput
            style={styles.input}
            placeholder="@username (without the @)"
            value={twitterUsername}
            onChangeText={setTwitterUsername}
            autoCapitalize="none"
            editable={!loading}
          />
          <Text style={styles.helperText}>Optional - Will be displayed on your player profile</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Player Bio <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about yourself, your experience and achievements"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            editable={!loading}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>Include your experience, achievements, and playing style</Text>
        </View>

        <View style={styles.adminReviewCard}>
          <View style={styles.adminReviewHeader}>
            <Ionicons name="information-circle" size={20} color={THEME.primary} />
            <Text style={styles.adminReviewTitle}>Admin Review Required</Text>
          </View>
          <Text style={styles.adminReviewText}>
            Your registration will be reviewed by administrators before being approved.
            This may take 24-48 hours.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={loading ? "Submitting..." : "Submit Registration"}
            onPress={handleSubmit}
            disabled={loading || !selectedCountry}
            loading={loading}
            style={styles.submitButton}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {countryModalVisible && (
        <View style={styles.bottomSheetOverlay}>
          <Animated.View 
            style={[
              styles.bottomSheetBackdrop,
              {
                opacity: bottomSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={closeBottomSheet}
            />
          </Animated.View>
          
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: bottomSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [sheetMaxHeight, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                maxHeight: sheetMaxHeight,
              },
            ]}
          >
            <View style={styles.bottomSheetDragHandle}>
              <View style={styles.bottomSheetDragIndicator} />
            </View>
            
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Country</Text>
              <TouchableOpacity 
                onPress={closeBottomSheet}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                style={styles.closeButton}
              >
                <Ionicons name="close-circle" size={28} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {countriesLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.modalLoadingText}>Loading countries...</Text>
              </View>
            ) : countries.length === 0 ? (
              <View style={styles.modalLoading}>
                <Ionicons name="warning-outline" size={48} color={THEME.primary} />
                <Text style={styles.modalLoadingText}>No countries found</Text>
                <Text style={styles.modalSubtext}>
                  Countries are required for player registration.
                  Please add countries from the Developer Tools section first.
                </Text>
                <TouchableOpacity 
                  style={styles.modalActionButton}
                  onPress={() => {
                    closeBottomSheet();
                    router.push('/add-data');
                  }}
                >
                  <Text style={styles.modalActionButtonText}>Go to Developer Tools</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bottomSheetContent}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color={THEME.textSecondary} style={styles.searchIcon} />
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="Search countries"
                    placeholderTextColor={THEME.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity 
                      onPress={() => setSearchQuery('')}
                      style={styles.clearSearch}
                    >
                      <Ionicons name="close-circle" size={18} color={THEME.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                
                {filteredCountries.length > 0 && (
                  <Text style={styles.resultCount}>
                    {filteredCountries.length} {filteredCountries.length === 1 ? 'country' : 'countries'} available
                  </Text>
                )}
                
                <FlatList
                  data={filteredCountries}
                  renderItem={renderCountryItem}
                  keyExtractor={(item) => item.$id}
                  style={styles.countryList}
                  contentContainerStyle={styles.countryListContent}
                  showsVerticalScrollIndicator={true}
                  initialNumToRender={10}
                  ListEmptyComponent={() => (
                    <View style={styles.noResultsContainer}>
                      <Ionicons name="search-outline" size={48} color={THEME.textSecondary} />
                      <Text style={styles.noResultsText}>No countries found</Text>
                      <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                    </View>
                  )}
                />
              </View>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  formContent: {
    padding: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: THEME.danger,
    fontSize: 14,
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  required: {
    color: THEME.danger,
  },
  input: {
    backgroundColor: THEME.light,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  countrySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectedCountryField: {
    backgroundColor: THEME.primaryTransparent,
    borderColor: THEME.primaryLight,
  },
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedCountryFlag: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  emptyFlagContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12, 
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  unselectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  countryFlag: {
    fontSize: 22,
    textAlign: 'center',
  },
  selectedCountryName: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  countryPlaceholder: {
    fontSize: 16,
    color: THEME.textSecondary,
  },
  countryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorIconContainer: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  adminReviewCard: {
    backgroundColor: THEME.primaryTransparent,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginVertical: 16,
  },
  adminReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  adminReviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
    marginLeft: 6,
  },
  adminReviewText: {
    fontSize: 13,
    color: THEME.primaryDark,
    lineHeight: 18,
  },
  actions: {
    marginTop: 24,
  },
  submitButton: {
    marginBottom: 12,
    backgroundColor: THEME.primary,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  successContainer: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.success,
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  returnButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.md,
  },
  returnButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
  },
  bottomSheetOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 1000,
  },
  bottomSheetBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    width: '100%',
    height: '100%',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 10,
  },
  bottomSheetDragHandle: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  bottomSheetDragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: THEME.lightGray,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resultCount: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  countryList: {
    flex: 1,
  },
  countryListContent: {
    paddingBottom: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  countryItemSelected: {
    backgroundColor: THEME.primaryTransparent,
  },
  countryFlagContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    overflow: 'hidden',
  },
  countryItemFlag: {
    fontSize: 26,
    textAlign: 'center',
  },
  countryItemName: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  countrySelectedIcon: {
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  clearSearch: {
    padding: 4,
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.textPrimary,
    marginTop: 12, 
  },
  noResultsSubtext: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  modalLoading: {
    padding: 32,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textPrimary,
  },
  modalSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  modalActionButton: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  modalActionButtonText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PlayerRegistrationForm; 