import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clearDatabase, clearStorage, clearLocalAvatarData } from '@/lib/appwrite';
import { THEME } from '@/app/utils/theme';

/**
 * Developer Tools screen with options to add and manage data
 */
export default function DevToolsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prevLogs => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prevLogs]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleClearDatabase = async () => {
    Alert.alert(
      "Clear Database",
      "Are you sure you want to clear all database records? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes, Clear Database",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            addLog("Starting database clearing operation...");
            
            try {
              await clearDatabase();
              addLog("✅ Database cleared successfully");
            } catch (error) {
              addLog(`❌ Error clearing database: ${error}`);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearStorage = async () => {
    Alert.alert(
      "Clear Storage",
      "Are you sure you want to delete all files in storage? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes, Clear Storage",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            addLog("Starting storage clearing operation...");
            
            try {
              await clearStorage();
              addLog("✅ Storage cleared successfully");
            } catch (error) {
              addLog(`❌ Error clearing storage: ${error}`);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearLocalAvatar = async () => {
    Alert.alert(
      "Clear Local Avatar Data",
      "Are you sure you want to delete all local avatar cache files?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes, Clear Cache",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            addLog("Starting local avatar cache clearing...");
            
            try {
              const result = await clearLocalAvatarData();
              if (result) {
                addLog("✅ Local avatar cache cleared successfully");
              } else {
                addLog("⚠️ Some issues occurred while clearing cache");
              }
            } catch (error) {
              addLog(`❌ Error clearing local avatar cache: ${error}`);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      "Clear Everything",
      "Are you sure you want to clear all database records AND delete all storage files? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes, Clear Everything",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            addLog("Starting complete data clearing operation...");
            
            try {
              // Clear database first
              addLog("Clearing database...");
              await clearDatabase();
              addLog("✅ Database cleared successfully");
              
              // Then clear storage
              addLog("Clearing storage...");
              await clearStorage();
              addLog("✅ Storage cleared successfully");
              
              addLog("🎉 All data has been cleared successfully");
            } catch (error) {
              addLog(`❌ Error clearing data: ${error}`);
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
      <ScrollView>
        <Text style={styles.title}>Developer Tools</Text>
        
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>

        <View style={styles.cardsContainer}>
          <Link href="/components/add-data" asChild>
            <TouchableOpacity style={styles.card}>
              <Ionicons name="add-circle" size={32} color="#F02E65" />
              <Text style={styles.cardTitle}>Add Demo Data</Text>
              <Text style={styles.cardDescription}>
                Add countries and players to your Appwrite database
              </Text>
            </TouchableOpacity>
          </Link>

          <Link href="/restore-countries" asChild>
            <TouchableOpacity style={styles.card}>
              <Ionicons name="globe-outline" size={32} color="#8B5CF6" />
              <Text style={styles.cardTitle}>Countries Manager</Text>
              <Text style={styles.cardDescription}>
                View, restore and manage country data
              </Text>
            </TouchableOpacity>
          </Link>

          <Link href="/components/test-upload" asChild>
            <TouchableOpacity style={styles.card}>
              <Ionicons name="cloud-upload" size={32} color="#3B82F6" />
              <Text style={styles.cardTitle}>Test Upload</Text>
              <Text style={styles.cardDescription}>
                Test file uploads and image handling
              </Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity style={styles.card} onPress={handleClearLocalAvatar}>
            <Ionicons name="images-outline" size={32} color="#8B5CF6" />
            <Text style={styles.cardTitle}>Clear Avatar Cache</Text>
            <Text style={styles.cardDescription}>
              Delete all locally cached avatar files
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleClearDatabase}>
            <Ionicons name="trash" size={32} color="#EF4444" />
            <Text style={styles.cardTitle}>Clear Database</Text>
            <Text style={styles.cardDescription}>
              Delete all data from your Appwrite database
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={handleClearStorage}>
            <Ionicons name="folder-open" size={32} color="#F59E0B" />
            <Text style={styles.cardTitle}>Clear Storage</Text>
            <Text style={styles.cardDescription}>
              Delete all files from Appwrite storage buckets
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerCard} onPress={handleClearAll}>
            <Ionicons name="warning" size={32} color="white" />
            <Text style={styles.dangerCardTitle}>Clear Everything</Text>
            <Text style={styles.dangerCardDescription}>
              Delete all database records and storage files
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.loadingText}>Processing, please wait...</Text>
          </View>
        )}
        
        <View style={styles.logsContainer}>
          <View style={styles.logHeader}>
            <Text style={styles.logsTitle}>Logs:</Text>
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
    fontSize: 28,
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
    marginBottom: 32,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  dangerCard: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  dangerCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginTop: 12,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  dangerCardDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  logsContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  clearButton: {
    padding: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#1F2937',
  },
  logScroll: {
    maxHeight: 200,
  },
  logText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#1F2937',
    marginBottom: 4,
  },
  emptyLogText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
}); 