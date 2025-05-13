import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Image, 
  StatusBar,
  ActivityIndicator,
  GestureResponderEvent,
  Alert,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCountries, getPlayersByCountry } from '@/lib/appwrite';
import { Models } from 'react-native-appwrite';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, interpolate, withTiming } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface Country extends Models.Document {
  name?: string;
  flag?: string;
  playerCount?: number;
  approvedPlayerCount?: number;
  flagEmoji?: string;
}

interface Player extends Models.Document {
  status?: string;
}

// Helper function to convert country code to flag emoji
const getFlagEmoji = (countryCode?: string) => {
  if (!countryCode) return '🏳️';
  
  // If the input starts with a flag emoji, return it as is
  if (countryCode.startsWith('🇦') || 
      countryCode.startsWith('🇧') || 
      countryCode.startsWith('🇨') || 
      countryCode.startsWith('🇩') || 
      countryCode.startsWith('🇪') || 
      countryCode.startsWith('🇫') || 
      countryCode.startsWith('🇬') || 
      countryCode.startsWith('🇭') || 
      countryCode.startsWith('🇮') || 
      countryCode.startsWith('🇯') || 
      countryCode.startsWith('🇰') || 
      countryCode.startsWith('🇱') || 
      countryCode.startsWith('🇲') || 
      countryCode.startsWith('🇳') || 
      countryCode.startsWith('🇴') || 
      countryCode.startsWith('🇵') || 
      countryCode.startsWith('🇶') || 
      countryCode.startsWith('🇷') || 
      countryCode.startsWith('🇸') || 
      countryCode.startsWith('🇹') || 
      countryCode.startsWith('🇺') || 
      countryCode.startsWith('🇻') || 
      countryCode.startsWith('🇼') || 
      countryCode.startsWith('🇽') || 
      countryCode.startsWith('🇾') || 
      countryCode.startsWith('🇿')) {
    return countryCode; // Already a flag emoji
  }
  
  // Check if it looks like a complete flag emoji (two regional indicators together)
  if (countryCode.length >= 4 && countryCode.includes('')) {
    return countryCode; // Already a flag emoji string
  }
  
  // Handle special cases or commonly problematic codes
  const specialCases: {[key: string]: string} = {
    'en': '🇬🇧', // English -> UK flag as fallback
    'us': '🇺🇸',
    'uk': '🇬🇧',
    'gb': '🇬🇧',
    'ca': '🇨🇦',
    'au': '🇦🇺',
    'in': '🇮🇳',
    'jp': '🇯🇵',
    'cn': '🇨🇳',
    'de': '🇩🇪',
    'fr': '🇫🇷',
    'it': '🇮🇹',
    'ru': '🇷🇺',
    'br': '🇧🇷',
    'mx': '🇲🇽',
    'es': '🇪🇸',
  };
  
  // Normalize code (strip spaces, lowercase)
  const normalizedCode = countryCode.trim().toLowerCase();
  
  // Check if it's a special case
  if (specialCases[normalizedCode]) {
    return specialCases[normalizedCode];
  }
  
  // Check if it's a URL instead of a code
  if (normalizedCode.includes('/') || normalizedCode.includes('.')) {
    console.log('Country code appears to be a URL:', normalizedCode);
    return '🏳️';
  }
  
  // Only use the first two characters if it's longer
  const codeToUse = normalizedCode.length > 2 ? normalizedCode.substring(0, 2) : normalizedCode;
  
  try {
    // Convert country code to flag emoji
    const codePoints = codeToUse
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    console.error('Error converting country code to emoji:', countryCode, e);
    return '🏳️'; // Default flag as fallback
  }
};

const TournamentScreen = () => {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState(1);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const headerOpacity = useSharedValue(0);
  const listOpacity = useSharedValue(0);

  // Use this function to navigate to Dev Tools if no data
  const goToDevTools = () => {
    router.push('/dev-tools');
  };

  const fetchCountries = async (retry = false) => {
    try {
      setLoading(true);
      
      const countriesData = await getCountries();
      
      // Debug: Inspect the first country object to understand its structure
      if (__DEV__ && countriesData.length > 0) {
        console.log('Sample country data structure:', JSON.stringify(countriesData[0], null, 2));
      }
      
      // Fetch player counts for each country (approved only)
      const countriesWithPlayerCounts = await Promise.all(
        countriesData.map(async (country: any) => {
          try {
            // Fetch all players for the country
            const players = await getPlayersByCountry(country.$id) as Player[];
            
            // Count only approved players
            const approvedPlayers = players.filter(player => player.status === 'approved');
            
            // Generate flag emoji from country code
            const flagEmoji = getFlagEmoji(country.flag);
            
            return {
              ...country,
              approvedPlayerCount: approvedPlayers.length,
              flagEmoji
            };
          } catch (err) {
            console.error(`Error fetching players for country ${country.name || country.$id}:`, err);
            return {
              ...country,
              approvedPlayerCount: 0,
              flagEmoji: getFlagEmoji(country.flag)
            };
          }
        })
      );
      
      // Type casting the documents to our Country interface
      setCountries(countriesWithPlayerCounts as Country[]);
      setError(null);
      
      // Debug: Check if flag emojis were properly generated
      if (__DEV__) {
        console.log('Countries with flags:', countriesWithPlayerCounts.map(c => ({
          id: c.$id,
          name: c.name,
          flag: c.flag,
          flagEmoji: c.flagEmoji
        })));
      }
      
      // If no countries found, offer to go to dev tools
      if (countriesData.length === 0 && !retry) {
        Alert.alert(
          'No Countries Found',
          'Would you like to set up test data using the Developer Tools?',
          [
            { text: 'No', style: 'cancel' },
            { text: 'Yes', onPress: goToDevTools }
          ]
        );
      }
    } catch (err: unknown) {
      console.error('Failed to fetch countries:', err);
      
      // If we haven't retried yet and got an auth error, try once with anonymous session
      if (!retry && !retried && err instanceof Error && err.toString().includes('not authorized')) {
        console.log('Retrying...');
        setRetried(true);
        return fetchCountries(true);
      }
      
      setError('Failed to load countries. Please check Appwrite permissions or try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Animate in the UI elements
      headerOpacity.value = withTiming(1, { duration: 500 });
      listOpacity.value = withTiming(1, { duration: 800 });
    }
  };
  
  // Handle retry button click
  const handleRetry = (_event: GestureResponderEvent) => {
    setRetried(false);
    fetchCountries();
  };
  
  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCountries();
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  // Get flags by country code - for image URL (backup approach)
  const getFlagUrl = (countryCode: string): string => {
    return `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`;
  };

  // Animation styles
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [{ translateY: interpolate(headerOpacity.value, [0, 1], [-20, 0]) }],
    };
  });

  const listAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: listOpacity.value,
      transform: [{ translateY: interpolate(listOpacity.value, [0, 1], [20, 0]) }],
    };
  });

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Loading tournaments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={THEME.danger} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorDescription}>{error}</Text>
          <View style={styles.errorButtons}>
            <AnimatedTouchable 
              style={styles.retryButton}
              onPress={handleRetry}
              entering={FadeIn.delay(300).duration(500)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </AnimatedTouchable>
            <AnimatedTouchable 
              style={styles.setupButton}
              onPress={goToDevTools}
              entering={FadeIn.delay(500).duration(500)}
            >
              <Text style={styles.setupButtonText}>Set Up Data</Text>
            </AnimatedTouchable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <Text style={styles.headerTitle}>Tournament Management</Text>
        <Text style={styles.headerSubtitle}>Choose a country to view matches</Text>
      </Animated.View>

      <Animated.View style={[styles.phaseSelector, headerAnimatedStyle]}>
        <TouchableOpacity 
          style={[styles.phaseTab, currentPhase === 1 && styles.activePhaseTab]}
          onPress={() => setCurrentPhase(1)}
        >
          <Text style={[styles.phaseText, currentPhase === 1 && styles.activePhaseText]}>Phase 1</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.phaseTab, currentPhase === 2 && styles.activePhaseTab]}
          onPress={() => setCurrentPhase(2)}
        >
          <Text style={[styles.phaseText, currentPhase === 2 && styles.activePhaseText]}>Phase 2</Text>
        </TouchableOpacity>
      </Animated.View>

      {currentPhase === 1 && (
      <Animated.View style={[{ flex: 1 }, listAnimatedStyle]}>
        <FlatList
          data={countries}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[THEME.primary, THEME.primaryDark]}
              tintColor={THEME.primary}
              title="Pull to refresh"
              titleColor={THEME.textSecondary}
            />
          }
          renderItem={({ item, index }) => {
            // Validate flag data for debugging
            if (__DEV__ && (!item.flagEmoji || item.flagEmoji === '🏳️')) {
              console.log(`Country ${item.name || item.$id} has missing or invalid flag data:`, item.flag);
            }
            
            return (
              <AnimatedTouchable 
                style={styles.countryCard}
                onPress={() => router.push(`/tournament/${item.name || item.$id}`)}
                entering={FadeInDown.delay(100 * index).duration(400)}
              >
                <View style={styles.flagContainer}>
                  <Text style={styles.flagEmoji}>{item.flagEmoji || '🏳️'}</Text>
                </View>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryName}>{item.name || 'Unknown Country'}</Text>
                  <Text style={styles.matchCount}>
                    <Text style={styles.approvedCount}>{item.approvedPlayerCount || 0}</Text> approved participants
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={20} color={THEME.textSecondary} />
                </View>
              </AnimatedTouchable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No countries available</Text>
            </View>
          }
        />
      </Animated.View>
      )}

      {currentPhase === 2 && (
        <Animated.View style={[styles.emptyState, listAnimatedStyle]}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3309/3309960.png' }}
            style={styles.emptyStateImage}
            resizeMode="contain"
          />
          <Text style={styles.emptyStateTitle}>Phase 2 Coming Soon</Text>
          <Text style={styles.emptyStateDescription}>
            The grand finale phase will be available after all Phase 1 matches are completed.
          </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
    color: THEME.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.headingSmall.fontSize,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  errorDescription: {
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  retryButton: {
    backgroundColor: THEME.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  retryButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
  },
  setupButton: {
    backgroundColor: THEME.warning,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  setupButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
  },
  header: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.headingMedium.fontSize,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
    color: THEME.textSecondary,
  },
  phaseSelector: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: THEME.primaryTransparent,
    padding: SPACING.xs,
  },
  phaseTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  activePhaseTab: {
    backgroundColor: THEME.white,
    ...SHADOWS.small,
  },
  phaseText: {
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  activePhaseText: {
    color: THEME.primary,
    fontWeight: '600',
  },
  listContainer: {
    padding: SPACING.md,
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.white,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  flagContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.light,
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  flagEmoji: {
    fontSize: 30,
  },
  countryFlag: {
    width: 48,
    height: 32,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.md,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  matchCount: {
    fontSize: TYPOGRAPHY.bodySmall.fontSize,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  approvedCount: {
    fontWeight: '700',
    color: THEME.primary,
  },
  arrowContainer: {
    padding: SPACING.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    marginBottom: SPACING.xl,
    opacity: 0.6,
  },
  emptyStateTitle: {
    fontSize: TYPOGRAPHY.headingSmall.fontSize,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyStateDescription: {
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
    color: THEME.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.bodyMedium.fontSize,
    color: THEME.textSecondary,
  },
});

export default TournamentScreen;
