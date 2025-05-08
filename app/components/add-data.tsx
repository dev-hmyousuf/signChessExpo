import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { databases, ID, APPWRITE_DATABASE_ID, COLLECTION_COUNTRIES, COLLECTION_PLAYERS } from '@/lib/appwrite';
import { router } from 'expo-router';

export default function AddDataScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  // Function to add demo countries
  const addDemoCountries = async () => {
    setIsLoading(true);
    setResult('Adding countries...\n');
    
    const countries = [
      { name: "Bangladesh", flag: "🇧🇩" },
      { name: "India", flag: "🇮🇳" },
      { name: "United States", flag: "🇺🇸" },
      { name: "United Kingdom", flag: "🇬🇧" },
      { name: "Australia", flag: "🇦🇺" },
      { name: "Japan", flag: "🇯🇵" },
      { name: "New Zealand", flag: "🇳🇿" },
      { name: "Pakistan", flag: "🇵🇰" },
    ];
    
    const createdCountries = [];
    
    for (const country of countries) {
      try {
        // Create country document directly without custom permissions
        const result = await databases.createDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_COUNTRIES,
          ID.unique(),
          {
            name: country.name,
            flag: country.flag,
            playerCount: 0
          }
        );
        
        const message = `Created country: ${country.name} with ID: ${result.$id}\n`;
        setResult(prev => prev + message);
        createdCountries.push(result);
      } catch (error: any) {
        // Check if error is because country already exists
        if (error.message && error.message.includes('unique')) {
          const message = `Country ${country.name} already exists, skipping...\n`;
          setResult(prev => prev + message);
        } else {
          const message = `Error creating country ${country.name}: ${error.message}\n`;
          setResult(prev => prev + message);
        }
      }
    }
    
    setIsLoading(false);
    return createdCountries;
  };

  // Function to add demo players
  const addDemoPlayers = async () => {
    setIsLoading(true);
    setResult('Adding players...\n');
    
    // Fetch countries first
    let countries;
    try {
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_COUNTRIES
      );
      countries = response.documents;
      setResult(prev => prev + `Found ${countries.length} countries\n`);
    } catch (error: any) {
      setResult(prev => prev + `Error fetching countries: ${error.message}\n`);
      setIsLoading(false);
      return;
    }
    
    if (!countries || countries.length === 0) {
      setResult(prev => prev + "No countries found, cannot add players\n");
      setIsLoading(false);
      return;
    }
    
    // Map to store countryId by country name
    const countryMap: Record<string, string> = {};
    countries.forEach((country: any) => {
      countryMap[country.name] = country.$id;
    });
    
    const players = [
      { name: "Shakib Al Hasan", country: "Bangladesh", rating: 2850, bio: "All-rounder from Bangladesh", avatar: "🏏" },
      { name: "Tamim Iqbal", country: "Bangladesh", rating: 2750, bio: "Opening batsman from Bangladesh", avatar: "🏏" },
      { name: "Virat Kohli", country: "India", rating: 2900, bio: "Legendary batsman from India", avatar: "🏏" },
      { name: "Rohit Sharma", country: "India", rating: 2800, bio: "Explosive opener from India", avatar: "🏏" },
      { name: "Joe Root", country: "United Kingdom", rating: 2850, bio: "England's top-order batsman", avatar: "🏏" },
      { name: "Steve Smith", country: "Australia", rating: 2880, bio: "Former captain of Australia", avatar: "🏏" },
      { name: "Kane Williamson", country: "New Zealand", rating: 2830, bio: "New Zealand captain", avatar: "🏏" },
      { name: "Babar Azam", country: "Pakistan", rating: 2800, bio: "Pakistan's rising star", avatar: "🏏" },
    ];
    
    for (const player of players) {
      const countryId = countryMap[player.country];
      
      if (!countryId) {
        const message = `Country not found for player ${player.name}, skipping...\n`;
        setResult(prev => prev + message);
        continue;
      }
      
      try {
        const result = await databases.createDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          ID.unique(),
          {
            name: player.name,
            countryId: countryId,
            rating: player.rating,
            bio: player.bio,
            avatar: player.avatar
          }
        );
        const message = `Created player: ${player.name} with ID: ${result.$id}\n`;
        setResult(prev => prev + message);
      } catch (error: any) {
        const message = `Error creating player ${player.name}: ${error.message}\n`;
        setResult(prev => prev + message);
      }
    }
    
    setIsLoading(false);
  };

  // Clear the database collections
  const clearDatabase = async () => {
    setIsLoading(true);
    setResult('Clearing database...\n');
    
    // Clear countries
    try {
      const countriesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_COUNTRIES
      );
      
      for (const country of countriesResponse.documents) {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_COUNTRIES,
          country.$id
        );
        setResult(prev => prev + `Deleted country: ${country.name}\n`);
      }
    } catch (error: any) {
      setResult(prev => prev + `Error deleting countries: ${error.message}\n`);
    }
    
    // Clear players
    try {
      const playersResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS
      );
      
      for (const player of playersResponse.documents) {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          player.$id
        );
        setResult(prev => prev + `Deleted player: ${player.name}\n`);
      }
    } catch (error: any) {
      setResult(prev => prev + `Error deleting players: ${error.message}\n`);
    }
    
    setIsLoading(false);
  };

  const clearLog = () => {
    setResult('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Add Demo Data</Text>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push('/dev-tools')}
      >
        <Text style={styles.backButtonText}>Back to Dev Tools</Text>
      </TouchableOpacity>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={addDemoCountries}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Add Demo Countries</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={addDemoPlayers}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Add Demo Players</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={() => {
            Alert.alert(
              "Clear Database",
              "This will delete all countries and players. Are you sure?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes, Delete All", onPress: clearDatabase, style: "destructive" }
              ]
            );
          }}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Clear Database</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={clearLog}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>Clear Log</Text>
        </TouchableOpacity>
      </View>
      
      {isLoading && (
        <ActivityIndicator size="large" color="#F02E65" style={styles.loader} />
      )}
      
      <ScrollView style={styles.logContainer}>
        <Text style={styles.logText}>{result}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  buttonContainer: {
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#F02E65',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  logContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  logText: {
    color: '#F9FAFB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  loader: {
    marginBottom: 16,
  },
}); 