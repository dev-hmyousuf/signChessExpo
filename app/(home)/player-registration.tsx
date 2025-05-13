import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  FlatList,
  Animated
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCountries, createPlayer, getFlagEmoji } from '@/lib/appwrite';
import { useIsLoggedIn } from '@/lib/clerkAuth';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { THEME, BORDER_RADIUS } from '@/app/utils/theme';

const { width, height } = Dimensions.get('window');

// Animation components fallbacks
const AnimView = Animatable.View || View;
const AnimText = Animatable.Text || Text;

interface Country {
  $id: string;
  name: string;
  flag: string;
}

const PlayerRegistrationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryData, setCountryData] = useState<any>(null);
  const [hasCountries, setHasCountries] = useState(true);
  const { isLoggedIn, isLoading: authLoading } = useIsLoggedIn();
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  
  // Registration form states
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [twitterUsername, setTwitterUsername] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Country selection states
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const windowHeight = Dimensions.get('window').height;
  const sheetMaxHeight = windowHeight * 0.7; // 70% of screen height
  
  // Get the country parameter from params
  const countryName = (params.country as string) || '';

  // Get the user data from Clerk
  useEffect(() => {
    const initializeUserData = async () => {
      if (clerkLoaded && clerkUser) {
        // Set user ID from Clerk
        setUserId(clerkUser.id);
        
        // Auto-fill name from Clerk user data (non-editable)
        const fullName = clerkUser.fullName || clerkUser.username || '';
        setName(fullName);
        
        // Set avatar from Clerk user data
        setAvatarUrl(clerkUser.imageUrl);
      }
    };

    initializeUserData();
  }, [clerkLoaded, clerkUser]);

  useEffect(() => {
    const checkAuthAndCountries = async () => {
      try {
        // Check if user is authenticated with Clerk
        if (!isLoggedIn) {
          router.replace('/(auth)/sign-in');
          return;
        }

        // Check if countries exist
        const countriesData = await getCountries();
        
        if (!countriesData || !Array.isArray(countriesData) || countriesData.length === 0) {
          console.log("No countries found in database");
          setHasCountries(false);
        } else {
          console.log("Countries found:", countriesData.length);
          
          // Convert document data to Country type with type safety
          const typedCountries = countriesData.map((country: any) => ({
            $id: country.$id,
            name: (country as any).name || '',
            flag: getFlagEmoji((country as any).flag || '')
          }));
          
          setCountries(typedCountries);
          setFilteredCountries(typedCountries);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error checking authentication:', err);
        setError('Failed to verify authentication');
        setLoading(false);
      }
    };

    // Only check countries after authentication check is complete
    if (!authLoading) {
      checkAuthAndCountries();
    }
  }, [authLoading, isLoggedIn]);

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

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[THEME.primary, '#F02E65', '#FF5B7F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingContainer}
        >
          <AnimView animation="pulse" iterationCount="infinite" duration={1500}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </AnimView>
          <AnimText animation="fadeIn" delay={300} style={styles.loadingText}>
            Preparing registration...
          </AnimText>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={['#FF6B6B', '#FF8080', '#FF9B9B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.errorContainer}
        >
          <AnimView animation="bounceIn" duration={800}>
            <Ionicons name="alert-circle" size={64} color="#FFFFFF" />
          </AnimView>
          <AnimText animation="fadeIn" delay={300} style={styles.errorTitle}>
            Oops! Something went wrong
          </AnimText>
          <AnimText animation="fadeIn" delay={500} style={styles.errorText}>
            {error || 'An unexpected error occurred. Please try again later.'}
          </AnimText>
          <AnimView animation="fadeIn" delay={700}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </AnimView>
        </LinearGradient>
      </SafeAreaView>
    );
  }
  
  if (!hasCountries) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#4D66D6', '#5D7CE4', '#7B97F5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.noCountriesPageContainer}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backBtn}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Player Registration</Text>
          </View>
          
          <ScrollView contentContainerStyle={styles.noCountriesScrollContent}>
            <AnimView animation="fadeIn" duration={800} style={styles.noCountriesContainer}>
              <AnimView animation="pulse" iterationCount={3} duration={2000}>
                <Ionicons name="globe-outline" size={80} color="#FFFFFF" />
              </AnimView>
              
              <AnimText animation="fadeInUp" delay={400} style={styles.noCountriesTitle}>
                Countries Required
              </AnimText>
              
              <AnimText animation="fadeInUp" delay={600} style={styles.noCountriesText}>
                To register as a player, you need to select your country. However, no countries have been added to the database yet.
              </AnimText>
              
              <AnimView animation="fadeInUp" delay={800}>
                <TouchableOpacity 
                  style={styles.addDataButton}
                  onPress={() => router.push('/dev-tools')}
                >
                  <LinearGradient
                    colors={['#F02E65', '#FF5B7F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.addDataButtonText}>Add Demo Data</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.backLinkButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backLinkText}>Return to Home</Text>
                </TouchableOpacity>
              </AnimView>
            </AnimView>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const handleSubmit = async () => {
    // Validation
    if (!bio.trim()) {
      setFormError('Please provide a short bio about yourself');
      return;
    }

    if (!selectedCountry) {
      setFormError('Please select a country you want to represent');
      return;
    }

    if (!userId) {
      setFormError('You must be logged in to register');
      return;
    }

    // Check if user has a username
    if (!clerkUser?.username) {
      setFormError('You need to set up a username before registering as a player');
      Alert.alert(
        'Username Required',
        'Please set up a username in your profile before registering as a player.',
        [{ text: 'OK' }]
      );
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      await createPlayer({
        userId: userId,
        clerkId: userId,
        username: clerkUser.username,
        name: name.trim(),
        countryId: selectedCountry.$id,
        avatarUrl: avatarUrl || undefined,
        bio: bio.trim(),
        twitterUsername: twitterUsername.trim(),
      });

      // Player creation successful
      console.log("Player registration successful!");
      
      setSubmitSuccess(true);
    } catch (err: any) {
      console.error('Error submitting player registration:', err);
      setFormError(err.message || 'Failed to submit registration. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const openBottomSheet = () => {
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

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity 
      style={[
        styles.countryItem,
        selectedCountry && selectedCountry.$id === item.$id ? styles.countryItemSelected : null
      ]}
      onPress={() => {
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.mainContainer}>
        <LinearGradient
          colors={[THEME.primary, '#F0315C', '#FF5B7F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Player Registration</Text>
            <Text style={styles.headerSubtitle}>Join the sign chess community</Text>
          </View>
          
          <View style={styles.headerRight}>
            {/* Chess icon */}
            <AnimView animation="bounceIn" duration={1200} delay={300}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="trophy-outline" size={22} color="#FFFFFF" />
              </View>
            </AnimView>
          </View>
        </LinearGradient>
        
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <AnimView animation="fadeInUp" duration={800} delay={200}>
            <TouchableOpacity 
              style={styles.infoCard}
              activeOpacity={0.8}
              onPress={() => setIsInfoExpanded(!isInfoExpanded)}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.infoCardGradient}
              >
                <View style={styles.infoHeader}>
                  <View style={styles.infoIconContainer}>
                    <Ionicons name="information-circle" size={20} color="#ffffff" />
                  </View>
                  <Text style={styles.infoTitle}>About Registration</Text>
                  <View style={styles.expandIconContainer}>
                    <AnimView
                      animation={isInfoExpanded ? "rotate" : ""}
                      duration={300}
                      style={styles.expandIconCircle}
                    >
                      <Ionicons 
                        name="chevron-down" 
                        size={18} 
                        color="#ffffff" 
                        style={{ 
                          transform: [{ rotate: isInfoExpanded ? '180deg' : '0deg' }],
                        }}
                      />
                    </AnimView>
                  </View>
                </View>
                
                {isInfoExpanded && (
                  <AnimView animation="fadeIn" duration={300} style={styles.infoContentContainer}>
                    <View style={styles.divider} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoText}>
                        Complete this form to join as a registered player. Your profile will require admin approval before you can participate in tournaments.
                      </Text>
                      <View style={styles.infoPoints}>
                        <View style={styles.infoPoint}>
                          <View style={styles.pointDot} />
                          <Text style={styles.pointText}>Your information is secure with us</Text>
                        </View>
                        <View style={styles.infoPoint}>
                          <View style={styles.pointDot} />
                          <Text style={styles.pointText}>Approval typically takes 24-48 hours</Text>
                        </View>
                      </View>
                    </View>
                  </AnimView>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </AnimView>
          
          <AnimView animation="fadeInUp" duration={800} delay={400}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <View style={styles.formContainer}>
                {/* Header */}
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Player Information</Text>
                </View>

                {/* Avatar Section - Read-only from Clerk */}
                <AnimView animation="fadeInDown" duration={800} delay={200} style={styles.avatarSection}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarEmoji}>🏏</Text>
                    </View>
                  )}
                </AnimView>

                {/* Name field - Read-only from Clerk */}
                <AnimView animation="fadeInLeft" duration={800} delay={300} style={styles.inputContainer}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person" size={18} color={THEME.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.disabledInput]}
                      value={name}
                      editable={false}
                      placeholder="Your full name"
                    />
                  </View>
                  <Text style={styles.inputNote}>Name from your account profile</Text>
                </AnimView>
                
                {/* Country selection */}
                <AnimView animation="fadeInRight" duration={800} delay={400} style={styles.inputContainer}>
                  <Text style={styles.label}>Country</Text>
                  <TouchableOpacity
                    style={styles.countrySelector}
                    onPress={openBottomSheet}
                    activeOpacity={0.8}
                  >
                    {selectedCountry ? (
                      <View style={styles.selectedCountry}>
                        <AnimView animation="bounceIn" duration={1000}>
                          <View style={styles.selectedCountryFlag}>
                            <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                          </View>
                        </AnimView>
                        <Text style={styles.countryName}>{selectedCountry.name}</Text>
                      </View>
                    ) : (
                      <View style={styles.placeholderContainer}>
                        <Ionicons name="earth" size={18} color={THEME.primary} style={styles.inputIcon} />
                        <Text style={styles.placeholderText}>Select your country</Text>
                      </View>
                    )}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.1)']}
                      style={styles.chevronContainer}
                    >
                      <Ionicons name="chevron-down" size={18} color={THEME.darkGray} />
                    </LinearGradient>
                  </TouchableOpacity>
                </AnimView>
                
                {/* Bio field */}
                <AnimView animation="fadeInLeft" duration={800} delay={500} style={styles.inputContainer}>
                  <Text style={styles.label}>Bio</Text>
                  <View style={styles.textAreaWrapper}>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Write a short bio about yourself..."
                      multiline={true}
                      numberOfLines={Platform.OS === 'ios' ? undefined : 3}
                      textAlignVertical="top"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                </AnimView>

                {/* Twitter field */}
                <AnimView animation="fadeInRight" duration={800} delay={600} style={styles.inputContainer}>
                  <Text style={styles.label}>Twitter Username <Text style={styles.optionalText}>(Optional)</Text></Text>
                  <View style={styles.twitterInputContainer}>
                    <View style={styles.twitterPrefixContainer}>
                      <Text style={styles.twitterPrefix}>@</Text>
                    </View>
                    <TextInput
                      style={styles.twitterInput}
                      value={twitterUsername}
                      onChangeText={setTwitterUsername}
                      placeholder="twitter_handle"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                </AnimView>

                {/* Error message */}
                {formError && (
                  <AnimView animation="shake" duration={500} style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color={THEME.danger} />
                    <Text style={styles.error}>{formError}</Text>
                  </AnimView>
                )}

                {/* Submit button */}
                <AnimView animation="fadeInUp" duration={800} delay={700} style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={formLoading}
                    activeOpacity={0.8}
                    style={styles.submitButtonContainer}
                  >
                    <LinearGradient
                      colors={['#F02E65', '#FF5B7F']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitButton}
                    >
                      {formLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.submitButtonText}>Submit Registration</Text>
                          <AnimView 
                            animation="pulse" 
                            iterationCount="infinite" 
                            duration={2000}
                            style={styles.submitButtonIconContainer}
                          >
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                          </AnimView>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </AnimView>
              </View>
            </KeyboardAvoidingView>
          </AnimView>
        </ScrollView>
      </View>

      {/* Success Modal - Kept separate from the ScrollView */}
      <Modal
        visible={submitSuccess}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <AnimView animation="fadeIn" duration={300} style={styles.successModalContainer}>
            <AnimView animation="zoomIn" duration={500}>
              <LinearGradient
                colors={['#ffffff', '#f8f8ff']}
                style={styles.successModal}
              >
                <AnimView animation="bounceIn" duration={800} delay={300}>
                  <LinearGradient
                    colors={[THEME.success, '#0ea371']}
                    style={styles.successIconCircle}
                  >
                    <Ionicons name="checkmark" size={48} color="#FFFFFF" />
                  </LinearGradient>
                </AnimView>
                
                <AnimText animation="fadeIn" delay={500} style={styles.successTitle}>
                  Registration Submitted
                </AnimText>
                
                <AnimText animation="fadeIn" delay={600} style={styles.successText}>
                  Your player registration has been submitted and is pending administrator approval.
                  You will be notified once approved.
                </AnimText>
                
                <AnimView animation="fadeIn" delay={800}>
                  <TouchableOpacity
                    style={styles.returnButton}
                    onPress={() => router.replace('/')}
                  >
                    <LinearGradient
                      colors={[THEME.primary, '#F02E85']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.returnButtonGradient}
                    >
                      <Text style={styles.returnButtonText}>Return to Home</Text>
                      <Ionicons name="home-outline" size={18} color="#FFFFFF" style={{marginLeft: 8}} />
                    </LinearGradient>
                  </TouchableOpacity>
                </AnimView>
              </LinearGradient>
            </AnimView>
          </AnimView>
        </View>
      </Modal>
      
      {/* Country Selector Modal */}
      {countryModalVisible && (
        <View style={styles.bottomSheetOverlay}>
          <Animated.View 
            style={[
              styles.bottomSheetBackdrop,
              {
                opacity: bottomSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
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
            
            <LinearGradient
              colors={['#ffffff', '#f8fbff']}
              style={styles.bottomSheetContent}
            >
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Select Your Country</Text>
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
                      router.push('/dev-tools');
                    }}
                  >
                    <Text style={styles.modalActionButtonText}>Go to Developer Tools</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.bottomSheetContentContainer}>
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
                  
                  <View style={styles.countryListContainer}>
                    <FlatList
                      data={filteredCountries}
                      keyExtractor={(item) => item.$id}
                      style={styles.countryList}
                      contentContainerStyle={styles.countryListContent}
                      showsVerticalScrollIndicator={true}
                      renderItem={({ item, index }) => (
                        <AnimView 
                          key={item.$id} 
                          animation="fadeInUp" 
                          duration={500} 
                          delay={index * 50}
                          style={[
                            styles.countryItem,
                            selectedCountry && selectedCountry.$id === item.$id ? styles.countryItemSelected : null
                          ]}
                        >
                          <TouchableOpacity 
                            style={styles.countryButton}
                            onPress={() => {
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
                        </AnimView>
                      )}
                      ListEmptyComponent={() => (
                        <View style={styles.noResultsContainer}>
                          <Ionicons name="search-outline" size={48} color={THEME.textSecondary} />
                          <Text style={styles.noResultsText}>No countries found</Text>
                          <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                        </View>
                      )}
                    />
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.primary,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  headerRight: {
    width: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
  },
  infoCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  infoCardGradient: {
    borderRadius: 16,
    padding: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  expandIconContainer: {
    padding: 4,
  },
  expandIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContentContainer: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 12,
  },
  infoContent: {
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
  },
  infoPoints: {
    marginTop: 4,
  },
  infoPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  pointText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  error: {
    color: THEME.danger,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 30,
    maxWidth: '80%',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonIcon: {
    marginRight: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  noCountriesPageContainer: {
    flex: 1,
  },
  noCountriesScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  noCountriesContainer: {
    padding: 24,
    alignItems: 'center',
  },
  noCountriesTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  noCountriesText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    maxWidth: '90%',
  },
  addDataButton: {
    width: width * 0.7,
    maxWidth: 300,
    marginBottom: 16,
    borderRadius: 30,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  addDataButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
  backLinkButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  backLinkText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Form styles
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
  },
  container: {
    flex: 1,
  },
  formContainer: {
    paddingVertical: 10,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: THEME.lightGray,
    marginBottom: 10,
    borderWidth: 4,
    borderColor: 'rgba(240, 46, 101, 0.2)',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 46, 101, 0.1)',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  inputContainer: {
    marginBottom: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 46, 101, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 46, 101, 0.1)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  disabledInput: {
    color: THEME.darkGray,
  },
  inputNote: {
    fontSize: 12,
    color: THEME.darkGray,
    marginTop: 4,
    fontStyle: 'italic',
    marginLeft: 2,
  },
  textAreaWrapper: {
    backgroundColor: 'rgba(240, 46, 101, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 46, 101, 0.1)',
    paddingHorizontal: 12,
    height: 150,
    overflow: 'hidden',
  },
  textArea: {
    height: 150,
    minHeight: 150,
    textAlignVertical: 'top',
    paddingTop: 14,
    paddingBottom: 10,
    ...Platform.select({
      ios: {
        paddingTop: 16,
        height: 140,
      }
    }),
  },
  countrySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 46, 101, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 46, 101, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedCountryFlag: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  countryFlag: {
    fontSize: 22,
    textAlign: 'center',
  },
  countryName: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  placeholderText: {
    fontSize: 16,
    color: '#A0AEC0',
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  twitterInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 46, 101, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 46, 101, 0.1)',
  },
  twitterPrefixContainer: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  twitterPrefix: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  twitterInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.textPrimary,
  },
  optionalText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '400',
  },
  buttonContainer: {
    marginTop: 10,
  },
  successModalContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModal: {
    backgroundColor: THEME.white,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 340,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.success,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  returnButton: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  returnButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  returnButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 16,
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
    backgroundColor: 'rgba(0, 0, 0, 1)',
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
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 20,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetDragHandle: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: THEME.white,
  },
  bottomSheetDragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetContentContainer: {
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
  countryListContainer: {
    height: 350,
    flex: 1,
  },
  countryList: {
    flex: 1,
    maxHeight: 350,
  },
  countryListContent: {
    paddingBottom: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  countryItemSelected: {
    backgroundColor: 'rgba(240, 46, 101, 0.1)',
    borderRadius: 12,
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
    borderColor: 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontWeight: '600',
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
    fontWeight: '500',
  },
  modalSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  modalActionButton: {
    backgroundColor: THEME.primary,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalActionButtonText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    position: 'absolute',
    zIndex: 1000,
  },
  submitButtonContainer: {
    borderRadius: 30,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: THEME.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  submitButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: THEME.white,
    fontWeight: '700',
    fontSize: 18,
  },
  submitButtonIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countriesContainer: {
    paddingBottom: 16,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});

export default PlayerRegistrationScreen; 