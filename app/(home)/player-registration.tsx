import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import PlayerRegistrationForm from '@/app/components/PlayerRegistrationForm';
import { getCountries, isLoggedIn } from '@/lib/appwrite';
import { Ionicons } from '@expo/vector-icons';

const PlayerRegistrationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryData, setCountryData] = useState<any>(null);
  const [hasCountries, setHasCountries] = useState(true);
  
  // Get the country parameter from params
  const countryName = (params.country as string) || '';

  useEffect(() => {
    const checkAuthAndCountries = async () => {
      try {
        // Check if user is authenticated with Appwrite
        const authenticated = await isLoggedIn();
        
        if (!authenticated) {
          router.replace('/(auth)/sign-in');
          return;
        }

        // Check if countries exist
        const countries = await getCountries();
        console.log("Countries found:", countries.length);
        
        if (!countries || countries.length === 0) {
          console.log("No countries found in database");
          setHasCountries(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error checking authentication:', err);
        setError('Failed to verify authentication');
        setLoading(false);
      }
    };

    checkAuthAndCountries();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F02E65" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error || 'Something went wrong'}</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  if (!hasCountries) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Player Registration</Text>
        </View>
        
        <View style={styles.noCountriesContainer}>
          <Ionicons name="globe-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noCountriesTitle}>No Countries Available</Text>
          <Text style={styles.noCountriesText}>
            Before you can register as a player, you need to add some countries to the database.
          </Text>
          
          <TouchableOpacity 
            style={styles.addDataButton}
            onPress={() => router.push('/add-data')}
          >
            <Text style={styles.addDataButtonText}>Add Demo Data</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Player Registration</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text style={styles.infoTitle}>Registration Process</Text>
          </View>
          <Text style={styles.infoText}>
            Register as a player to participate in tournaments. Select your country and provide your information.
            Your registration will be reviewed by tournament administrators before approval.
          </Text>
        </View>
        
        <PlayerRegistrationForm 
          onComplete={() => router.replace('/')}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  noCountriesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noCountriesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noCountriesText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: '80%',
    lineHeight: 20,
  },
  addDataButton: {
    backgroundColor: '#F02E65',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addDataButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginRight: 8,
  },
});

export default PlayerRegistrationScreen; 