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
  ActivityIndicator,
  Animated,
  Dimensions
} from 'react-native';
import { router, useRouter } from 'expo-router';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { clearDatabase, clearStorage, clearLocalAvatarData } from '@/lib/appwrite';
import { THEME, SPACING, SHADOWS, BORDER_RADIUS } from '@/app/utils/theme';
import { migrateUserIdToClerkId, isOrganizer, isDynastyAdmin } from '@/lib/permissionsHelper';
import Button from './Button';
import { useUser } from '@clerk/clerk-expo';

/**
 * Simple section header component for dev tools
 */
const SectionHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

// Define types for developer tools
interface DevTool {
  id: string;
  title: string;
  icon: any; // Using any for icon names to support Ionicons
  description: string;
  route: string;
  comingSoon?: boolean;
  gradientColors: string[];
}

// List of developer tools
const DEV_TOOLS: DevTool[] = [
  {
    id: 'profile-linking',
    title: 'Profile Linking Test',
    icon: 'person-circle',
    description: 'Test user profile navigation and deep linking',
    route: '/dev-tools?tool=profile',
    gradientColors: [THEME.primary, THEME.primaryLight]
  },
  {
    id: 'data-browser',
    title: 'Database Browser',
    icon: 'server',
    description: 'Browse and manage database collections',
    route: '/dev-tools/data-browser',
    comingSoon: true,
    gradientColors: ['#f97316', '#f59e0b']
  },
  {
    id: 'auth-test',
    title: 'Authentication Test',
    icon: 'key',
    description: 'Test authentication flows and user states',
    route: '/dev-tools/auth-test',
    comingSoon: true,
    gradientColors: ['#8b5cf6', '#a855f7']
  },
  {
    id: 'network-monitor',
    title: 'Network Monitor',
    icon: 'globe',
    description: 'Monitor network requests and responses',
    route: '/dev-tools/network',
    comingSoon: true,
    gradientColors: ['#059669', '#10b981']
  },
];

/**
 * Developer Tools screen with options to add and manage data
 */
export default function DevToolsDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const [scaleAnim] = useState(new Animated.Value(1));

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

  const debugAdminStatus = async () => {
    if (!clerkUser) {
      addLog("❌ No Clerk user is logged in");
      return;
    }

    setIsLoading(true);
    addLog(`🔍 Checking admin status for user ${clerkUser.id}`);
    
    try {
      // Check if user is an organizer
      const organizerStatus = await isOrganizer(clerkUser.id);
      addLog(`Organizer status: ${organizerStatus ? '✅ Yes' : '❌ No'}`);
      
      // Check if user is a dynasty admin
      const { isDynastyAdmin: dynastyAdminStatus, dynastyId } = await isDynastyAdmin(clerkUser.id);
      addLog(`Dynasty admin status: ${dynastyAdminStatus ? '✅ Yes' : '❌ No'}`);
      if (dynastyAdminStatus && dynastyId) {
        addLog(`Dynasty ID: ${dynastyId}`);
      }
    } catch (error) {
      addLog(`❌ Error checking admin status: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testSpecificClerkId = async () => {
    try {
      const clerkIdToTest = prompt("Enter Clerk User ID to test:");
      if (!clerkIdToTest) {
        addLog("❌ No Clerk ID provided");
        return;
      }

      setIsLoading(true);
      addLog(`🔍 Testing admin status for Clerk ID: ${clerkIdToTest}`);
      
      // Check if user is an organizer
      const organizerStatus = await isOrganizer(clerkIdToTest);
      addLog(`Organizer status: ${organizerStatus ? '✅ Yes' : '❌ No'}`);
      
      // Check if user is a dynasty admin
      const { isDynastyAdmin: dynastyAdminStatus, dynastyId } = await isDynastyAdmin(clerkIdToTest);
      addLog(`Dynasty admin status: ${dynastyAdminStatus ? '✅ Yes' : '❌ No'}`);
      if (dynastyAdminStatus && dynastyId) {
        addLog(`Dynasty ID: ${dynastyId}`);
      }
    } catch (error) {
      addLog(`❌ Error testing admin status: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolSelect = (tool: DevTool) => {
    if (tool.comingSoon) {
      // Tool is not available yet
      return;
    }
    
    // Navigate to the selected tool
    // Use any to override the router type restrictions
    // This is safe as we control the route values in our DEV_TOOLS array
    (router as any).push(tool.route);
  };

  const animatePress = (toValue: number) => {
    Animated.spring(scaleAnim, {
      toValue,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Create pairs of tools for the two-column layout
  const toolPairs = DEV_TOOLS.reduce<DevTool[][]>((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 2);
    
    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []; // Start a new chunk
    }
    
    resultArray[chunkIndex].push(item);
    return resultArray;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#f8fafc', '#e0f2fe']}
        style={styles.gradientBackground}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <LinearGradient 
              colors={[THEME.primary, THEME.primaryLight]}
              start={{x: 0, y: 0}} 
              end={{x: 1, y: 0}}
              style={styles.headerGradient}
            >
              <Text style={styles.headerTitle}>Developer Tools</Text>
              <Text style={styles.headerSubtitle}>Build • Test • Debug</Text>
            </LinearGradient>
          </View>

          <Text style={styles.sectionTitle}>Available Tools</Text>
          
          <View style={styles.toolsContainer}>
            {toolPairs.map((pair, pairIndex) => (
              <View key={`pair-${pairIndex}`} style={styles.toolsRow}>
                {pair.map(tool => (
                  <TouchableOpacity
                    key={tool.id}
                    style={styles.toolCardWrapper}
                    onPress={() => handleToolSelect(tool)}
                    onPressIn={() => animatePress(0.95)}
                    onPressOut={() => animatePress(1)}
                    disabled={tool.comingSoon}
                    activeOpacity={0.9}
                  >
                    <Animated.View
                      style={[
                        styles.toolCard,
                        tool.comingSoon && styles.toolCardDisabled,
                        { transform: [{ scale: scaleAnim }] }
                      ]}
                    >
                      <LinearGradient
                        colors={tool.gradientColors}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={styles.toolIconGradient}
                      >
                        <Ionicons 
                          name={tool.icon} 
                          size={32} 
                          color="#ffffff" 
                        />
                      </LinearGradient>
                      
                      <View style={styles.toolInfo}>
                        <Text style={styles.toolTitle}>{tool.title}</Text>
                        <Text style={styles.toolDescription}>{tool.description}</Text>
                      </View>
                      
                      {!tool.comingSoon && (
                        <View style={styles.toolArrow}>
                          <Ionicons name="chevron-forward" size={18} color={THEME.primary} />
                        </View>
                      )}
                      
                      {tool.comingSoon && (
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>Soon</Text>
                        </View>
                      )}
                    </Animated.View>
                  </TouchableOpacity>
                ))}
                {/* Add an empty placeholder if there's only one item in the row */}
                {pair.length === 1 && <View style={styles.toolCardWrapper} />}
              </View>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - (SPACING.md * 3)) / 2; // 2 cards per row with spacing between

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.white,
  },
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerGradient: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  toolsContainer: {
    paddingHorizontal: SPACING.md,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  toolCardWrapper: {
    width: cardWidth,
  },
  toolCard: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    height: 180,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  toolCardDisabled: {
    opacity: 0.75,
  },
  toolIconGradient: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  toolInfo: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: SPACING.sm,
  },
  toolDescription: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  toolArrow: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(235, 245, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(113, 113, 122, 0.8)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  comingSoonText: {
    fontSize: 10,
    color: THEME.white,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 16,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
}); 