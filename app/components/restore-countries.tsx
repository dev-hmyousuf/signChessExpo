import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { THEME } from '@/app/utils/theme';
import { defaultCountries } from '@/app/utils/countryData';
import { 
  getAllCountriesWithLogging, 
  restoreDefaultCountries, 
  createCountry 
} from '@/lib/appwrite';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RestoreCountriesScreen() {
  const [countries, setCountries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    loadCountries();
  }, []);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prevLogs => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prevLogs]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const loadCountries = async () => {
    setIsLoading(true);
    addLog('Loading current countries from database...');
    
    try {
      const countriesList = await getAllCountriesWithLogging();
      setCountries(countriesList);
      addLog(`✅ Loaded ${countriesList.length} countries from database`);
    } catch (error) {
      addLog(`❌ Error loading countries: ${error}`);
      Alert.alert('Error', 'Failed to load countries from database');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreCountries = async () => {
    Alert.alert(
      "Restore Default Countries",
      "This will add all default countries to your database. Do you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Restore Countries",
          onPress: async () => {
            setIsRestoring(true);
            addLog("Starting country restoration...");
            
            try {
              const result = await restoreDefaultCountries(defaultCountries);
              if (result.success) {
                addLog(`✅ ${result.message}`);
                // Reload countries
                await loadCountries();
              } else {
                addLog(`❌ Restoration failed: ${result.message}`);
              }
            } catch (error) {
              addLog(`❌ Error during restoration: ${error}`);
            } finally {
              setIsRestoring(false);
            }
          }
        }
      ]
    );
  };

  const handleAddSingleCountry = async () => {
    Alert.prompt(
      "Add Custom Country",
      "Enter country name and flag emoji (ex: Bangladesh 🇧🇩)",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Add",
          onPress: async (text = "") => {
            // Extract name and flag from text
            let name = text.trim();
            let flag = "🏳️";
            
            // If there's an emoji at the end, use it as flag
            const emojiMatch = text.match(/(\p{Emoji}+)$/u);
            if (emojiMatch) {
              flag = emojiMatch[0].trim();
              name = text.replace(emojiMatch[0], '').trim();
            }
            
            if (!name) {
              Alert.alert("Error", "Country name cannot be empty");
              return;
            }
            
            setIsLoading(true);
            addLog(`Adding custom country: ${name} ${flag}`);
            
            try {
              const newCountry = await createCountry(name, flag);
              addLog(`✅ Added custom country: ${name} ${flag}`);
              
              // Reload countries
              await loadCountries();
            } catch (error) {
              addLog(`❌ Error adding country: ${error}`);
              Alert.alert("Error", `Failed to add country: ${error}`);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.textPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.title}>Countries Management</Text>
        
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.button, styles.refreshButton]}
            onPress={loadCountries}
            disabled={isLoading || isRestoring}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="white" />
                <Text style={styles.buttonText}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.restoreButton]}
            onPress={handleRestoreCountries}
            disabled={isLoading || isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="earth" size={18} color="white" />
                <Text style={styles.buttonText}>Restore All Countries</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.addButton]}
            onPress={handleAddSingleCountry}
            disabled={isLoading || isRestoring}
          >
            <Ionicons name="add-circle" size={18} color="white" />
            <Text style={styles.buttonText}>Add Custom Country</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.countryListContainer}>
          <Text style={styles.sectionTitle}>Current Countries ({countries.length})</Text>
          
          {countries.length === 0 && !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="earth-outline" size={48} color={THEME.textSecondary} />
              <Text style={styles.emptyText}>No countries found in database</Text>
              <Text style={styles.emptySubText}>Click 'Restore All Countries' to add default countries</Text>
            </View>
          ) : (
            <View style={styles.countriesGrid}>
              {countries.map(country => (
                <View key={country.$id} style={styles.countryCard}>
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text style={styles.countryName}>{country.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.logsContainer}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Logs</Text>
            <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logScroll}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))}
            {logs.length === 0 && (
              <Text style={styles.emptyLogText}>No logs yet. Actions will be recorded here.</Text>
            )}
          </View>
        </View>
        
        <View style={styles.availableCountries}>
          <Text style={styles.sectionTitle}>Available Default Countries ({defaultCountries.length})</Text>
          <View style={styles.countriesGrid}>
            {defaultCountries.map((country, index) => (
              <View key={index} style={styles.countryCard}>
                <Text style={styles.countryFlag}>{country.flag}</Text>
                <Text style={styles.countryName}>{country.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  refreshButton: {
    backgroundColor: THEME.primary,
  },
  restoreButton: {
    backgroundColor: THEME.accent,
  },
  addButton: {
    backgroundColor: THEME.success,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: THEME.textPrimary,
  },
  countryListContainer: {
    marginBottom: 20,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.light,
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 16,
    color: THEME.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  countriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  countryCard: {
    width: '31%',
    backgroundColor: THEME.light,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  countryFlag: {
    fontSize: 32,
    marginBottom: 8,
  },
  countryName: {
    fontSize: 12,
    textAlign: 'center',
    color: THEME.textPrimary,
  },
  logsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearButton: {
    padding: 6,
    backgroundColor: THEME.light,
    borderRadius: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  logScroll: {
    maxHeight: 200,
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  emptyLogText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  availableCountries: {
    marginBottom: 40,
  },
}); 