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
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCountries } from '@/lib/appwrite';
import { Models } from 'appwrite';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, interpolate, withTiming } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface Country extends Models.Document {
  name: string;
  flag: string;
  playerCount?: number;
}

const TournamentScreen = () => {
  const router = useRouter();
  const [currentPhase, setCurrentPhase] = useState(1);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);

  // Animation values
  const headerOpacity = useSharedValue(0);
  const listOpacity = useSharedValue(0);

  // Use this function to navigate to Dev Tools if no data
  const goToDevTools = () => {
    router.push('/components/dev-tools');
  };

  const fetchCountries = async (retry = false) => {
    try {
      setLoading(true);
      
      const countriesData = await getCountries();
      // Type casting the documents to our Country interface
      setCountries(countriesData as unknown as Country[]);
      setError(null);
      
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

  useEffect(() => {
    fetchCountries();
  }, []);

  // Get flags by country code
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

  if (loading) {
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
          renderItem={({ item, index }) => (
            <AnimatedTouchable 
              style={styles.countryCard}
              onPress={() => router.push(`/tournament/${item.name}`)}
              entering={FadeInDown.delay(100 * index).duration(400)}
            >
              <Image 
                source={{ uri: getFlagUrl(item.flag) }} 
                style={styles.countryFlag}
                resizeMode="cover"
              />
              <View style={styles.countryInfo}>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.matchCount}>{item.playerCount || 0} participants</Text>
              </View>
              <View style={styles.arrowContainer}>
                <Ionicons name="chevron-forward" size={20} color={THEME.textSecondary} />
              </View>
            </AnimatedTouchable>
          )}
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
