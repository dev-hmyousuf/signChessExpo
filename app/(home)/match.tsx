import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const MatchPage = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = params.matchId as string;

  // Animation values
  const headerOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.9);

  useEffect(() => {
    // Animate elements when component mounts
    headerOpacity.value = withTiming(1, { duration: 600 });
    cardScale.value = withTiming(1, { duration: 800 });
  }, []);

  // Animated styles
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
    };
  });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [{ scale: cardScale.value }],
    };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <AnimatedTouchable 
          style={styles.backButton}
          onPress={() => router.back()}
          entering={FadeIn.delay(200).duration(400)}
        >
          <Ionicons name="chevron-back" size={24} color={THEME.primary} />
          <Text style={styles.backText}>Tournament</Text>
        </AnimatedTouchable>
      </Animated.View>
      
      <View style={styles.content}>
        <Animated.Text 
          style={styles.title}
          entering={FadeInDown.delay(300).duration(500)}
        >
          Match Details
        </Animated.Text>
        
        <Animated.View 
          style={[styles.card, cardAnimatedStyle]}
        >
          <Text style={styles.matchId}>Match ID: {matchId || 'No match selected'}</Text>
          
          <Text style={styles.infoText}>
            Loading specific match information...
          </Text>
          
          <AnimatedTouchable 
            style={styles.returnButton} 
            onPress={() => router.back()}
            entering={FadeInUp.delay(800).duration(500)}
          >
            <Text style={styles.returnButtonText}>Back to Tournament</Text>
          </AnimatedTouchable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
  },
  header: {
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.primary,
    marginLeft: SPACING.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  matchId: {
    fontSize: 18,
    color: THEME.textPrimary,
    marginBottom: SPACING.lg,
  },
  infoText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  returnButton: {
    backgroundColor: THEME.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  returnButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MatchPage; 