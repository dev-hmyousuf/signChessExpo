import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TextInput,
  RefreshControl,
  Image,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { 
  databases, 
  COLLECTION_PLAYERS, 
  COLLECTION_COUNTRIES, 
  COLLECTION_MATCHES,
  APPWRITE_DATABASE_ID, 
  getCountryByName, 
  getFilePreview,
  getPlayersByCountry,
  account,
  updateMatch,
  getPlayerById,
  createMatch
} from '@/lib/appwrite';
import { 
  isDynastyAdmin, 
  canManageDynasty 
} from '@/lib/permissionsHelper';
import { Query } from 'react-native-appwrite';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { THEME } from '@/app/utils/theme';
import { useCompleteUser, useIsLoggedIn } from '@/lib/clerkAuth';
import { StatusBar } from 'expo-status-bar';

// Define interface for player data
interface Player {
  $id: string;
  name: string;
  bio: string;
  countryId: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected';
  twitterUsername?: string;
  createdAt: string;
  userId: string;
  avatar?: string;
  avatarUrl?: string;
  victories?: number;
  defeats?: number;
  matches?: string[];
}

// Define interface for country data
interface Country {
  $id: string;
  name: string;
  flag: string;
  playerCount: number;
}

// Define interface for match data
interface Match {
  $id: string;
  player1Id: string;
  player2Id: string;
  tournamentId: string;
  round: number;
  status: 'pending_schedule' | 'scheduled' | 'in_progress' | 'completed' | 'rejected';
  scheduledDate?: string;
  isReviewed?: boolean;
  isScheduled?: boolean;
  player1?: Player;
  player2?: Player;
  $collectionId?: string;
  $databaseId?: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
  predictedWinnerId?: string;
  predictedWinner?: Player;
  winProbability?: number;
}

// Dashboard stats interface
interface DashboardStats {
  totalPlayers: number;
  pendingPlayers: number;
  approvedPlayers: number;
  rejectedPlayers: number;
  totalMatches: number;
  scheduledMatches: number;
  completedMatches: number;
}

// Calculate win probability based on Elo ratings
const calculateWinProbability = (rating1: number, rating2: number): number => {
  const K = 400; // Elo K-factor
  const expectedScore = 1 / (1 + Math.pow(10, (rating2 - rating1) / K));
  return Math.round(expectedScore * 100);
};

export default function DynastyAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminDynastyId, setAdminDynastyId] = useState<string | null>(null);
  const [dynastyInfo, setDynastyInfo] = useState<Country | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'pending-players' | 'approved-players' | 'matches'>('dashboard');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMatchStatus, setSelectedMatchStatus] = useState('scheduled');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalPlayers: 0,
    pendingPlayers: 0,
    approvedPlayers: 0,
    rejectedPlayers: 0,
    totalMatches: 0,
    scheduledMatches: 0,
    completedMatches: 0,
  });
  const [expandedPlayers, setExpandedPlayers] = useState<{[key: string]: boolean}>({});

  // Add a map to store animation values for each player card
  const animationValues = useRef<{[key: string]: Animated.Value}>({}).current;

  // Get or create an animation value for a player
  const getAnimationValue = (playerId: string) => {
    if (!animationValues[playerId]) {
      animationValues[playerId] = new Animated.Value(0);
    }
    return animationValues[playerId];
  };

  // Check login status with Clerk
  const { isLoggedIn, isLoading: isLoginCheckLoading } = useIsLoggedIn();
  
  // Use our useCompleteUser hook for user data
  const { clerkUser, appwriteUser, isLoaded, error } = useCompleteUser();

  useEffect(() => {
    // Check login status first
    if (!isLoginCheckLoading && !isLoggedIn) {
      console.log('User not logged in, redirecting to login page');
      router.replace('/(auth)/sign-in');
      return;
    }

    // Then check admin status when user data is loaded
    if (isLoaded) {
      if (error) {
        console.error("Authentication error:", error);
        Alert.alert("Authentication Error", "Please sign out and sign in again to access the dynasty admin dashboard");
        return;
      }
      checkDynastyAdmin();
    }
  }, [isLoginCheckLoading, isLoggedIn, isLoaded, clerkUser, appwriteUser, error]);

  useEffect(() => {
    // Calculate dashboard stats whenever players or matches change
    if (players.length > 0 || matches.length > 0) {
      calculateDashboardStats();
    }
  }, [players, matches]);

  // Calculate dashboard stats
  const calculateDashboardStats = () => {
    const pendingPlayers = players.filter(p => p.status === 'pending').length;
    const approvedPlayers = players.filter(p => p.status === 'approved').length;
    const rejectedPlayers = players.filter(p => p.status === 'rejected').length;
    
    const scheduledMatches = matches.filter(m => 
      m.status === 'scheduled' || m.status === 'in_progress'
    ).length;
    const completedMatches = matches.filter(m => m.status === 'completed').length;
    
    setDashboardStats({
      totalPlayers: players.length,
      pendingPlayers,
      approvedPlayers,
      rejectedPlayers,
      totalMatches: matches.length,
      scheduledMatches,
      completedMatches,
    });
  };

  // Check if the current user is a dynasty admin and get their dynasty ID
  const checkDynastyAdmin = async () => {
    try {
      if (!clerkUser || !appwriteUser) {
        Alert.alert("Not Authenticated", "Please log in to access the dynasty admin dashboard");
        router.replace('/');
        return;
      }

      const currentUserId = clerkUser.id;
      
      // Check if user is a dynasty admin using the helper function
      const { isDynastyAdmin: userIsDynastyAdmin, dynastyId } = await isDynastyAdmin(currentUserId);
      
      if (!userIsDynastyAdmin || !dynastyId) {
        // Also check the role from appwriteUser
        if (appwriteUser.role === 'dynasty_admin' || appwriteUser.role === 'admin') {
          console.log("User has dynasty_admin role in Appwrite but not via helper function");
          // Continue anyway
        } else {
          // User is not a dynasty admin
          Alert.alert(
            "Access Denied", 
            "You don't have permission to access the dynasty admin dashboard",
            [{ text: "OK", onPress: () => router.replace('/') }]
          );
          return;
        }
      }
      
      // Set the dynasty ID and load data
      setAdminDynastyId(dynastyId);
      if (dynastyId) {
        await loadDynastyData(dynastyId);
      } else {
        console.error("No dynasty ID found for this admin");
        Alert.alert("Error", "No dynasty assigned to this admin");
      }
    } catch (error) {
      console.error("Error checking dynasty admin status:", error);
      Alert.alert("Error", "Failed to verify admin status");
    }
  };

  // Load dynasty data and players
  const loadDynastyData = async (dynastyId: string) => {
    try {
      setLoading(true);
      
      // 1. Get the dynasty/country info
      const country = await databases.getDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_COUNTRIES,
        dynastyId
      );
      setDynastyInfo(country as unknown as Country);
      
      // 2. Get players from this dynasty/country
      const playersResponse = await getPlayersByCountry(dynastyId);
      setPlayers(playersResponse as unknown as Player[]);
      
      // 3. Get matches that involve players from this dynasty
      // This is more complex and would require filtering matches where either player is from this dynasty
      // For simplicity, we'll just show all matches for now
      const matchesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_MATCHES,
        [Query.limit(100)]
      );
      
      // Get player details for matches
      const matchesData = matchesResponse.documents as unknown as Match[];
      const playerIds = new Set<string>();
      
      matchesData.forEach(match => {
        if (match.player1Id) playerIds.add(match.player1Id);
        if (match.player2Id) playerIds.add(match.player2Id);
      });
      
      const playersMap: Record<string, Player> = {};
      for (const playerId of playerIds) {
        try {
          const playerData = await getPlayerById(playerId);
          playersMap[playerId] = playerData as unknown as Player;
        } catch (error) {
          console.error(`Failed to fetch player ${playerId}:`, error);
        }
      }
      
      // Filter matches to only include those with at least one player from this dynasty
      const dynastyMatches = matchesData.filter(match => {
        const player1 = playersMap[match.player1Id];
        const player2 = playersMap[match.player2Id];
        return (player1 && player1.countryId === dynastyId) || (player2 && player2.countryId === dynastyId);
      });
      
      // Add player data to matches
      const enrichedMatches = dynastyMatches.map(match => ({
        ...match,
        player1: playersMap[match.player1Id],
        player2: playersMap[match.player2Id]
      }));
      
      setMatches(enrichedMatches);
    } catch (error) {
      console.error("Error loading dynasty data:", error);
      Alert.alert("Error", "Failed to load dynasty data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle player approval
  const handleApprovePlayer = async (player: Player) => {
    try {
      setLoading(true);
      
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        player.$id,
        {
          status: 'approved'
        }
      );
      
      Alert.alert(
        'Success',
        `Player ${player.name} has been approved successfully`,
        [{ text: 'OK' }]
      );
      
      // Refresh the player list
      if (adminDynastyId) {
        loadDynastyData(adminDynastyId);
      }
    } catch (error) {
      console.error('Failed to approve player:', error);
      Alert.alert('Error', 'Failed to approve player. Please try again.');
      setLoading(false);
    }
  };

  // Handle player rejection
  const handleRejectPlayer = async (player: Player) => {
    try {
      setLoading(true);
      
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        player.$id,
        {
          status: 'rejected'
        }
      );
      
      Alert.alert(
        'Success',
        `Player ${player.name} has been rejected`,
        [{ text: 'OK' }]
      );
      
      // Refresh the player list
      if (adminDynastyId) {
        loadDynastyData(adminDynastyId);
      }
    } catch (error) {
      console.error('Failed to reject player:', error);
      Alert.alert('Error', 'Failed to reject player. Please try again.');
      setLoading(false);
    }
  };

  // Handle refreshing
  const onRefresh = () => {
    setRefreshing(true);
    if (adminDynastyId) {
      loadDynastyData(adminDynastyId);
    } else {
      setRefreshing(false);
    }
  };

  // Get flag URL
  const getFlagUrl = (countryCode: string) => {
    return `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`;
  };

  // Get player avatar
  const getPlayerAvatar = (player: Player) => {
    // Check if avatarUrl is a Clerk URL (already a full URL)
    if (player.avatarUrl && player.avatarUrl.startsWith('http')) {
      return { uri: player.avatarUrl };
    } 
    // Check for legacy avatar field
    else if (player.avatar && player.avatar.startsWith('http')) {
      return { uri: player.avatar };
    } 
    // If it's an Appwrite file ID, use getFilePreview
    else if (player.avatar) {
      return { uri: getFilePreview(player.avatar).toString() };
    } 
    // Fallback to country flag
    else {
      return { uri: getFlagUrl(dynastyInfo?.flag || 'xx') };
    }
  };

  // Filter players based on search query
  const getFilteredPlayers = () => {
    let filteredPlayers = players;
    
    // Filter by status based on selected tab
    if (selectedTab === 'pending-players') {
      filteredPlayers = players.filter(p => p.status === 'pending');
    } else if (selectedTab === 'approved-players') {
      filteredPlayers = players.filter(p => p.status === 'approved');
    }
    
    // Then filter by search query
    if (!searchQuery.trim()) return filteredPlayers;
    
    return filteredPlayers.filter(player => 
      player.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Toggle expansion for a player card with animation
  const togglePlayerExpansion = (playerId: string) => {
    const isExpanded = expandedPlayers[playerId] || false;
    const toValue = isExpanded ? 0 : 1;
    
    // Update state
    setExpandedPlayers(prev => ({
      ...prev,
      [playerId]: !prev[playerId]
    }));
    
    // Run animation
    Animated.timing(getAnimationValue(playerId), {
      toValue,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  // Check if a player card is expanded
  const isPlayerExpanded = (playerId: string) => {
    return expandedPlayers[playerId] || false;
  };

  // Render approved player card with collapsible content and animations
  const renderApprovedPlayerCard = ({ item: player }: { item: Player }) => {
    const isExpanded = expandedPlayers[player.$id] || false;
    const animatedValue = getAnimationValue(player.$id);
    
    // Interpolate animated values
    const rotateZ = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });
    
    const containerBackgroundColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [THEME.white, THEME.light],
    });
    
    const contentHeight = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });
    
    return (
      <>
      <StatusBar style="light" />
      <Animated.View 
        style={[
          stylesDynasty.playerCard,
          { backgroundColor: containerBackgroundColor }
        ]}
      >
        {/* Header - Always visible */}
        <TouchableOpacity 
          onPress={() => togglePlayerExpansion(player.$id)}
          style={stylesDynasty.collapsibleHeader}
          activeOpacity={0.7}
        >
          <View style={stylesDynasty.playerHeaderLeft}>
            <Image 
              source={getPlayerAvatar(player)}
              style={stylesDynasty.playerAvatar} 
            />
            <View>
              <Text style={[stylesDynasty.playerName, { color: THEME.dark }]}>{player.name}</Text>
              <View style={stylesDynasty.countryContainer}>
                <Text style={stylesDynasty.countryFlag}>{dynastyInfo?.flag || '🏁'}</Text>
                <Text style={[stylesDynasty.playerCountry, { color: THEME.darkGray }]}>
                  {dynastyInfo?.name || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
          
          <Animated.View style={[
            stylesDynasty.expandIconContainer,
            { transform: [{ rotateZ }] }
          ]}>
            <Ionicons 
              name="chevron-down"
              size={20} 
              color={THEME.darkGray} 
            />
          </Animated.View>
        </TouchableOpacity>
        
        {/* Overview - Always visible */}
        <View style={stylesDynasty.playerOverview}>
          <View style={[
            stylesDynasty.playerBadge, 
            { backgroundColor: THEME.success + '20' } // 20% opacity
          ]}>
            <Text style={[
              stylesDynasty.playerBadgeText,
              { color: THEME.success }
            ]}>
              Approved
            </Text>
          </View>
          
          <View style={stylesDynasty.ratingContainer}>
            <Ionicons name="stats-chart-outline" size={16} color={THEME.darkGray} />
            <Text style={[stylesDynasty.detailText, { color: THEME.darkGray }]}>
              Rating: {player.rating}
            </Text>
          </View>
        </View>
        
        {/* Expandable content with animation */}
        <Animated.View 
          style={[
            stylesDynasty.expandedContentContainer,
            {
              opacity: animatedValue,
              maxHeight: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500], // Adjust this value based on content
              }),
            }
          ]}
        >
          {/* This render-if ensures content is mounted only when expanded */}
          {isExpanded && (
            <View style={stylesDynasty.expandedContent}>
              <View style={stylesDynasty.playerDetails}>
                <View style={stylesDynasty.detailRow}>
                  {player.twitterUsername && (
                    <View style={stylesDynasty.detailItem}>
                      <Ionicons name="logo-twitter" size={16} color={THEME.primary} />
                      <Text style={[stylesDynasty.detailText, { color: THEME.darkGray }]}>
                        @{player.twitterUsername}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={stylesDynasty.detailItem}>
                  <Ionicons name="calendar-outline" size={16} color={THEME.darkGray} />
                  <Text style={[stylesDynasty.detailText, { color: THEME.darkGray }]}>
                    Registered: {new Date(player.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              
              {player.bio && (
                <View style={[stylesDynasty.bioContainer, { backgroundColor: THEME.light }]}>
                  <Text style={[stylesDynasty.bioText, { color: THEME.darkGray }]}>
                    {player.bio}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                style={[stylesDynasty.actionButton, { backgroundColor: THEME.primary }]}
                onPress={() => handleViewPlayer(player.$id)}
              >
                <Ionicons name="eye-outline" size={18} color={THEME.white} />
                <Text style={[stylesDynasty.actionButtonText, { color: THEME.white }]}>
                  View Profile
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Animated.View>
      </>
    );
  };

  // Render player card with improved design
  const renderPlayerCard = ({ item: player }: { item: Player }) => {
    return (
      <View style={stylesDynasty.playerCard}>
        <View style={stylesDynasty.playerHeader}>
          <View style={stylesDynasty.playerHeaderLeft}>
            <Image 
              source={getPlayerAvatar(player)}
              style={stylesDynasty.playerAvatar} 
            />
            <View>
              <Text style={stylesDynasty.playerName}>{player.name}</Text>
              <View style={stylesDynasty.countryContainer}>
                <Text style={stylesDynasty.countryFlag}>{dynastyInfo?.flag || '🏁'}</Text>
                <Text style={stylesDynasty.playerCountry}>{dynastyInfo?.name || 'Unknown'}</Text>
              </View>
            </View>
          </View>
          <View style={[
            stylesDynasty.playerBadge, 
            player.status === 'pending' ? stylesDynasty.pendingBadge : 
            player.status === 'approved' ? stylesDynasty.approvedBadge : 
            stylesDynasty.rejectedBadge
          ]}>
            <Text style={[
              stylesDynasty.playerBadgeText,
              player.status === 'pending' ? stylesDynasty.pendingText : 
              player.status === 'approved' ? stylesDynasty.approvedText : 
              stylesDynasty.rejectedText
            ]}>
              {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
            </Text>
          </View>
        </View>
        
        <View style={stylesDynasty.playerDetails}>
          <View style={stylesDynasty.detailRow}>
            {player.twitterUsername && (
              <View style={stylesDynasty.detailItem}>
                <Ionicons name="logo-twitter" size={16} color="#1DA1F2" />
                <Text style={stylesDynasty.detailText}>@{player.twitterUsername}</Text>
              </View>
            )}
            
            <View style={stylesDynasty.detailItem}>
              <Ionicons name="stats-chart-outline" size={16} color="#6B7280" />
              <Text style={stylesDynasty.detailText}>Rating: {player.rating}</Text>
            </View>
          </View>
          
          <View style={stylesDynasty.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={stylesDynasty.detailText}>Registered: {new Date(player.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        
        {player.bio && (
          <View style={stylesDynasty.bioContainer}>
            <Text style={stylesDynasty.bioText}>{player.bio}</Text>
          </View>
        )}
        
        {player.status === 'pending' && (
          <View style={stylesDynasty.actionButtons}>
            <TouchableOpacity
              style={[stylesDynasty.actionButton, stylesDynasty.approveButton]}
              onPress={() => handleApprovePlayer(player)}
            >
              <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />
              <Text style={stylesDynasty.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[stylesDynasty.actionButton, stylesDynasty.rejectButton]}
              onPress={() => handleRejectPlayer(player)}
            >
              <Ionicons name="close-outline" size={18} color="#FFFFFF" />
              <Text style={stylesDynasty.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity
          style={[stylesDynasty.actionButton, stylesDynasty.viewButton]}
          onPress={() => handleViewPlayer(player.$id)}
        >
          <Ionicons name="eye-outline" size={18} color="#4B5563" />
          <Text style={[stylesDynasty.actionButtonText, { color: '#4B5563' }]}>View Profile</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Check if match can be rescheduled
  const canRescheduleMatch = (match: Match) => {
    // Always allow rescheduling regardless of match date
    return true;
  };

  // Handle match update
  const handleMatchUpdate = async () => {
    if (!selectedMatch) return;
    
    try {
      setLoading(true);
      
      // Update match data - make sure to set isScheduled to true and status to 'scheduled'
      await updateMatch(selectedMatch.$id, {
        status: 'scheduled', // Always set status to 'scheduled' when scheduling
        isScheduled: true,   // Set isScheduled to true
        scheduledDate: scheduledDate.toISOString()
      });
      
      Alert.alert(
        'Success',
        `Match has been scheduled successfully`,
        [{ text: 'OK' }]
      );
      
      // Close modal and refresh matches
      setEditModalVisible(false);
      fetchMatches();
    } catch (error) {
      console.error('Failed to update match:', error);
      Alert.alert('Error', 'Failed to schedule match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle match approval/rejection
  const handleMatchAction = async (match: Match, action: 'approve' | 'reject') => {
    try {
      setLoading(true);
      
      const newStatus = action === 'approve' ? 'scheduled' : 'rejected';
      
      await updateMatch(match.$id, {
        status: newStatus
      });
      
      Alert.alert(
        'Success',
        `Match has been ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        [{ text: 'OK' }]
      );
      
      fetchMatches();
    } catch (error) {
      console.error(`Failed to ${action} match:`, error);
      Alert.alert('Error', `Failed to ${action} match. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Handle match review with confirmation dialog
  const handleReviewMatch = (match: Match) => {
    Alert.alert(
      'Mark Match as Reviewed',
      'Once you mark a match as reviewed, it confirms that all match details have been verified by you. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Mark as Reviewed',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              await updateMatch(match.$id, {
                isReviewed: true
              });
              Alert.alert(
                'Success',
                'Match has been marked as reviewed',
                [{ text: 'OK' }]
              );
              fetchMatches();
            } catch (error) {
              console.error('Failed to review match:', error);
              Alert.alert('Error', 'Failed to review match. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle edit match button
  const handleEditMatch = (match: Match) => {
    setSelectedMatch(match);
    // If no date is set, use January 1st, 2026 as default
    if (match.scheduledDate) {
      setScheduledDate(new Date(match.scheduledDate));
    } else {
      setScheduledDate(new Date('2026-01-01T00:00:00'));
    }
    setSelectedMatchStatus(match.status || 'scheduled');
    setEditModalVisible(true);
  };

  // Fetch matches
  const fetchMatches = async () => {
    try {
      setLoading(true);
      // First get all matches for this tournament
      const matchesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_MATCHES,
        [
          Query.equal('tournamentId', adminDynastyId || ''),
          Query.limit(100)
        ]
      );
      const matchesData = matchesResponse.documents;
      // Get all unique player IDs from matches
      const playerIds = new Set<string>();
      matchesData.forEach(match => {
        if (match.player1Id) playerIds.add(match.player1Id);
        if (match.player2Id) playerIds.add(match.player2Id);
      });
      // Fetch all players in parallel, using correct field
      const playerPromises = Array.from(playerIds).map(async id => {
        if (id.startsWith('user_')) {
          // Fetch by clerkId
          const res = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            COLLECTION_PLAYERS,
            [Query.equal('clerkId', id), Query.limit(1)]
          );
          return res.documents[0] ? res.documents[0] as unknown as Player : null;
        } else {
          // Fetch by $id
          try {
            const player = await getPlayerById(id);
            return player as unknown as Player;
          } catch {
            return null;
          }
        }
      });
      const playerResults = await Promise.all(playerPromises);
      // Create a map of player data
      const playersMap: Record<string, Player> = {};
      Array.from(playerIds).forEach((id, idx) => {
        if (playerResults[idx]) {
          playersMap[id] = playerResults[idx]!;
        }
      });
      // Enrich matches with player data, skip if missing
      const enrichedMatches = matchesData.map(match => ({
        ...match,
        player1: playersMap[match.player1Id],
        player2: playersMap[match.player2Id],
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        tournamentId: match.tournamentId,
        round: match.round,
        status: match.status,
        isReviewed: match.isReviewed,
        isScheduled: match.isScheduled,
        scheduledDate: match.scheduledDate
      })) as Match[];
      setMatches(enrichedMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      Alert.alert('Error', 'Failed to load matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle date change with the modal picker
  const onDateConfirm = (selectedDate: Date) => {
    setScheduledDate(selectedDate);
    setShowDatePicker(false);
  };
  
  const onDateCancel = () => {
    setShowDatePicker(false);
  };

  // Render match card with improved design
  const renderMatchCard = ({ item: match }: { item: Match }) => {
    const formattedDate = match.scheduledDate 
      ? new Date(match.scheduledDate).toLocaleString() 
      : 'Not Scheduled';
    
    return (
      <View style={stylesDynasty.card}>
        <View style={stylesDynasty.matchHeader}>
          <View style={stylesDynasty.matchStatus}>
            <Text style={[
              stylesDynasty.statusBadge,
              { 
                backgroundColor: 
                  match.status === 'completed' ? '#10b981' : 
                  match.status === 'in_progress' ? '#3b82f6' : 
                  match.status === 'rejected' ? '#ef4444' :
                  match.status === 'scheduled' ? '#f59e0b' :
                  '#6b7280'
              }
            ]}>
              {match.status.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </Text>
            <Text style={stylesDynasty.matchDate}>{formattedDate}</Text>
            {match.isReviewed !== undefined && (
              <View style={[
                stylesDynasty.reviewStatusBadge,
                { backgroundColor: match.isReviewed ? '#10b981' : '#f59e0b' }
              ]}>
                <Text style={stylesDynasty.reviewStatusText}>
                  {match.isReviewed ? 'Reviewed' : 'Not Reviewed'}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={stylesDynasty.roundText}>Round {match.round}</Text>
        </View>

        <View style={stylesDynasty.matchPlayers}>
          {/* Player 1 */}
          <View style={stylesDynasty.playerColumn}>
            {match.player1 ? (
              <>
                <Image 
                  source={getPlayerAvatar(match.player1)}
                  style={stylesDynasty.matchPlayerAvatar}
                />
                <Text style={stylesDynasty.matchPlayerName}>{match.player1.name}</Text>
                <Text style={stylesDynasty.matchPlayerRating}>Rating: {match.player1.rating}</Text>
              </>
            ) : (
              <Text style={stylesDynasty.unknownPlayer}>Unknown Player</Text>
            )}
          </View>
          
          <View style={stylesDynasty.vsContainer}>
            <Text style={stylesDynasty.vsText}>VS</Text>
          </View>
          
          {/* Player 2 */}
          <View style={stylesDynasty.playerColumn}>
            {match.player2 ? (
              <>
                <Image 
                  source={getPlayerAvatar(match.player2)}
                  style={stylesDynasty.matchPlayerAvatar}
                />
                <Text style={stylesDynasty.matchPlayerName}>{match.player2.name}</Text>
                <Text style={stylesDynasty.matchPlayerRating}>Rating: {match.player2.rating}</Text>
              </>
            ) : (
              <Text style={stylesDynasty.unknownPlayer}>Unknown Player</Text>
            )}
          </View>
        </View>

        <View style={stylesDynasty.cardActions}>
          {match.status === 'pending_schedule' && (
            <>
              <TouchableOpacity
                style={[stylesDynasty.actionButton, stylesDynasty.approveButton]}
                onPress={() => handleEditMatch(match)}
              >
                <Ionicons name="calendar" size={18} color="#FFFFFF" />
                <Text style={stylesDynasty.actionButtonText}>Schedule Match</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[stylesDynasty.actionButton, stylesDynasty.rejectButton]}
                onPress={() => handleMatchAction(match, 'reject')}
              >
                <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                <Text style={stylesDynasty.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Show Reschedule button for all scheduled matches */}
          {match.status === 'scheduled' && (
            <TouchableOpacity
              style={[stylesDynasty.actionButton, stylesDynasty.rescheduleButton]}
              onPress={() => handleEditMatch(match)}
            >
              <Ionicons name="calendar" size={18} color="#FFFFFF" />
              <Text style={stylesDynasty.actionButtonText}>Reschedule Match</Text>
            </TouchableOpacity>
          )}
          
          {/* Show Mark as Reviewed button for unreviewed matches */}
          {match.status === 'scheduled' && match.isReviewed === false && (
            <TouchableOpacity
              style={[stylesDynasty.actionButton, { backgroundColor: '#10b981' }]}
              onPress={() => handleReviewMatch(match)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={stylesDynasty.actionButtonText}>Mark as Reviewed</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[stylesDynasty.actionButton, stylesDynasty.viewButton]}
            onPress={() => router.push({
              pathname: "/(home)/match/[matchId]",
              params: { matchId: match.$id }
            })}
          >
            <Ionicons name="eye-outline" size={18} color="#4b5563" />
            <Text style={[stylesDynasty.actionButtonText, { color: '#4b5563' }]}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Navigate to admin panel safely
  const handleAdminRolesNavigation = () => {
    // Use index instead which should contain tabs navigation
    router.push('/');
  };

  // Fix the handleViewPlayer function to properly navigate
  const handleViewPlayer = (playerId: string) => {
    router.push({
      pathname: "/(home)/match/[matchId]",
      params: { matchId: playerId }
    });
  };

  // Render dashboard content with updated onPress actions and Twitter theme colors
  const renderDashboardContent = () => {
    return (
      <ScrollView style={[stylesDynasty.dashboardContainer, { backgroundColor: THEME.light }]}>
        {/* Dynasty Info Card */}
        <View style={[stylesDynasty.dynastyInfoCard, { backgroundColor: THEME.white }]}>
          <Image 
            source={{ uri: getFlagUrl(dynastyInfo?.flag || 'xx') }}
            style={stylesDynasty.dynastyFlagImage}
          />
          <View style={stylesDynasty.dynastyInfoText}>
            <Text style={[stylesDynasty.dynastyInfoTitle, { color: THEME.dark }]}>
              {dynastyInfo?.name} Dynasty
            </Text>
            <Text style={[stylesDynasty.dynastyInfoSubtitle, { color: THEME.darkGray }]}>
              Admin Dashboard
            </Text>
          </View>
        </View>
        
        {/* Stats Cards */}
        <View style={stylesDynasty.statsRow}>
          <View style={[stylesDynasty.statCard, { backgroundColor: THEME.primary }]}>
            <View style={stylesDynasty.statIconContainer}>
              <Ionicons name="people" size={24} color={THEME.white} />
            </View>
            <Text style={stylesDynasty.statValue}>{dashboardStats.totalPlayers}</Text>
            <Text style={stylesDynasty.statLabel}>Total Players</Text>
          </View>
          
          <View style={[stylesDynasty.statCard, { backgroundColor: THEME.warning }]}>
            <View style={stylesDynasty.statIconContainer}>
              <Ionicons name="time" size={24} color={THEME.white} />
            </View>
            <Text style={stylesDynasty.statValue}>{dashboardStats.pendingPlayers}</Text>
            <Text style={stylesDynasty.statLabel}>Pending Players</Text>
          </View>
        </View>
        
        <View style={stylesDynasty.statsRow}>
          <View style={[stylesDynasty.statCard, { backgroundColor: THEME.success }]}>
            <View style={stylesDynasty.statIconContainer}>
              <Ionicons name="checkmark-circle" size={24} color={THEME.white} />
            </View>
            <Text style={stylesDynasty.statValue}>{dashboardStats.approvedPlayers}</Text>
            <Text style={stylesDynasty.statLabel}>Approved Players</Text>
          </View>
          
          <View style={[stylesDynasty.statCard, { backgroundColor: THEME.danger }]}>
            <View style={stylesDynasty.statIconContainer}>
              <Ionicons name="close-circle" size={24} color={THEME.white} />
            </View>
            <Text style={stylesDynasty.statValue}>{dashboardStats.rejectedPlayers}</Text>
            <Text style={stylesDynasty.statLabel}>Rejected Players</Text>
          </View>
        </View>
        
        <View style={stylesDynasty.sectionHeader}>
          <Text style={[stylesDynasty.sectionTitle, { color: THEME.dark }]}>Tournament Status</Text>
        </View>
        
        <View style={stylesDynasty.statsRow}>
          <View style={[stylesDynasty.statCard, { backgroundColor: THEME.secondary }]}>
            <View style={stylesDynasty.statIconContainer}>
              <Ionicons name="trophy" size={24} color={THEME.white} />
            </View>
            <Text style={stylesDynasty.statValue}>{dashboardStats.totalMatches}</Text>
            <Text style={stylesDynasty.statLabel}>Total Matches</Text>
          </View>
          
          <View style={[stylesDynasty.statCard, { backgroundColor: THEME.info }]}>
            <View style={stylesDynasty.statIconContainer}>
              <Ionicons name="calendar" size={24} color={THEME.white} />
            </View>
            <Text style={stylesDynasty.statValue}>{dashboardStats.scheduledMatches}</Text>
            <Text style={stylesDynasty.statLabel}>Scheduled Matches</Text>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={stylesDynasty.sectionHeader}>
          <Text style={[stylesDynasty.sectionTitle, { color: THEME.dark }]}>Quick Actions</Text>
        </View>
        
        <View style={stylesDynasty.quickActionsContainer}>
          <TouchableOpacity 
            style={[stylesDynasty.quickActionButton, { backgroundColor: THEME.white }]}
            onPress={() => setSelectedTab('pending-players')}
          >
            <View style={[stylesDynasty.quickActionIcon, { backgroundColor: THEME.warning }]}>
              <Ionicons name="hourglass-outline" size={24} color={THEME.white} />
            </View>
            <Text style={[stylesDynasty.quickActionText, { color: THEME.darkGray }]}>
              Pending Players
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[stylesDynasty.quickActionButton, { backgroundColor: THEME.white }]}
            onPress={() => setSelectedTab('approved-players')}
          >
            <View style={[stylesDynasty.quickActionIcon, { backgroundColor: THEME.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={THEME.white} />
            </View>
            <Text style={[stylesDynasty.quickActionText, { color: THEME.darkGray }]}>
              Approved Players
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[stylesDynasty.quickActionButton, { backgroundColor: THEME.white }]}
            onPress={() => setSelectedTab('matches')}
          >
            <View style={[stylesDynasty.quickActionIcon, { backgroundColor: THEME.secondary }]}>
              <Ionicons name="trophy" size={24} color={THEME.white} />
            </View>
            <Text style={[stylesDynasty.quickActionText, { color: THEME.darkGray }]}>
              Matches
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[stylesDynasty.quickActionButton, { backgroundColor: THEME.white }]}
            onPress={handleAdminRolesNavigation}
          >
            <View style={[stylesDynasty.quickActionIcon, { backgroundColor: THEME.primary }]}>
              <Ionicons name="shield" size={24} color={THEME.white} />
            </View>
            <Text style={[stylesDynasty.quickActionText, { color: THEME.darkGray }]}>
              Admin Roles
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[stylesDynasty.quickActionButton, { width: '100%', backgroundColor: THEME.white }]}
            onPress={() => router.push({
              pathname: "/(home)/tournament/[dynasty]",
              params: { dynasty: dynastyInfo?.$id || '' }
            })}
          >
            <View style={[stylesDynasty.quickActionIcon, { backgroundColor: THEME.accent }]}>
              <Ionicons name="podium" size={24} color={THEME.white} />
            </View>
            <Text style={[stylesDynasty.quickActionText, { color: THEME.darkGray }]}>
              View Tournament
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Pending Approvals */}
        {dashboardStats.pendingPlayers > 0 && (
          <>
            <View style={stylesDynasty.sectionHeader}>
              <Text style={[stylesDynasty.sectionTitle, { color: THEME.dark }]}>
                Pending Player Approvals
              </Text>
              <TouchableOpacity onPress={() => setSelectedTab('pending-players')}>
                <Text style={[stylesDynasty.seeAllText, { color: THEME.primary }]}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={players.filter(p => p.status === 'pending').slice(0, 3)}
              renderItem={renderPlayerCard}
              keyExtractor={item => item.$id}
              scrollEnabled={false}
            />
          </>
        )}
      </ScrollView>
    );
  };

  // Generate tournament matches with proper seeding
  const generateMatches = async () => {
    if (!adminDynastyId) {
      Alert.alert("Error", "No dynasty ID available");
      return;
    }
    
    try {
      setLoading(true);
      
      // Get approved players only
      const approvedPlayers = players.filter(p => p.status === 'approved');
      
      if (approvedPlayers.length < 2) {
        Alert.alert("Error", "Need at least 2 approved players to generate matches");
        setLoading(false);
        return;
      }
      
      // Sort players by rating (descending)
      const sortedPlayers = [...approvedPlayers].sort((a, b) => b.rating - a.rating);
      
      // For a proper tournament seeding, match highest vs lowest
      const newMatches = [];
      
      for (let i = 0; i < Math.floor(sortedPlayers.length / 2); i++) {
        // Pair 1st with last, 2nd with second-last, etc.
        const player1 = sortedPlayers[i];
        const player2 = sortedPlayers[sortedPlayers.length - 1 - i];
        
        // Calculate win probability
        const winProbability = calculateWinProbability(player1.rating, player2.rating);
        const predictedWinnerId = player1.rating > player2.rating ? player1.$id : player2.$id;
        
        try {
          // Create match in Appwrite with isScheduled false and scheduledDate undefined
          const matchData = {
            player1Id: player1.$id,
            player2Id: player2.$id,
            tournamentId: adminDynastyId,
            round: 1,
            status: 'pending_schedule',
            isScheduled: false, // Explicitly set to false
            scheduledDate: undefined, // Use undefined instead of null
            predictedWinnerId: predictedWinnerId,
            winProbability: winProbability
          };
          
          const savedMatch = await createMatch(matchData);
          
          // Add to our matches array
          newMatches.push({
            ...savedMatch,
            player1,
            player2,
            predictedWinnerId,
            predictedWinner: player1.rating > player2.rating ? player1 : player2,
            winProbability
          } as unknown as Match);
          
        } catch (error) {
          console.error("Error creating match:", error);
          Alert.alert("Error", `Failed to create match between ${player1.name} and ${player2.name}`);
        }
      }
      
      // If we have an odd number of players, the highest seed gets a bye
      if (sortedPlayers.length % 2 !== 0 && sortedPlayers.length > 0) {
        console.log(`Player ${sortedPlayers[Math.floor(sortedPlayers.length / 2)].name} has a bye to round 2`);
      }
      
      Alert.alert(
        "Success",
        `Generated ${newMatches.length} matches`,
        [{ text: "OK", onPress: () => loadDynastyData(adminDynastyId) }]
      );
      
    } catch (error) {
      console.error("Error generating matches:", error);
      Alert.alert("Error", "Failed to generate matches");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={stylesDynasty.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={stylesDynasty.loadingText}>Loading dynasty data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[stylesDynasty.container, { backgroundColor: THEME.light }]}>
      {/* Header with dynasty info */}
      <LinearGradient
        colors={[THEME.gradientStart, THEME.gradientEnd]}
        style={stylesDynasty.header}
      >
        <View style={stylesDynasty.headerContent}>
          <View style={stylesDynasty.headerLeft}>
            <TouchableOpacity 
              style={stylesDynasty.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={THEME.white} />
            </TouchableOpacity>
            
            <View style={stylesDynasty.dynastyInfo}>
              {dynastyInfo && (
                <>
                  <Text style={stylesDynasty.dynastyFlag}>{dynastyInfo.flag}</Text>
                  <Text style={stylesDynasty.dynastyName}>{dynastyInfo.name}</Text>
                </>
              )}
            </View>
          </View>
          
          <View style={stylesDynasty.searchContainer}>
            <Ionicons name="search-outline" size={20} color={THEME.white} style={stylesDynasty.searchIcon} />
            <TextInput
              style={stylesDynasty.searchInput}
              placeholder="Search players..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </LinearGradient>
      
      {/* Tab selector */}
      <View style={[stylesDynasty.tabContainer, { backgroundColor: THEME.white, borderBottomColor: THEME.lightGray }]}>
        <TouchableOpacity
          style={[
            stylesDynasty.tab,
            selectedTab === 'dashboard' && [stylesDynasty.activeTab, { borderBottomColor: THEME.primary }]
          ]}
          onPress={() => setSelectedTab('dashboard')}
        >
          <Ionicons 
            name="grid-outline" 
            size={20} 
            color={selectedTab === 'dashboard' ? THEME.primary : THEME.darkGray} 
          />
          <Text style={[
            stylesDynasty.tabText,
            selectedTab === 'dashboard' && [stylesDynasty.activeTabText, { color: THEME.primary }]
          ]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            stylesDynasty.tab,
            selectedTab === 'pending-players' && [stylesDynasty.activeTab, { borderBottomColor: THEME.primary }]
          ]}
          onPress={() => setSelectedTab('pending-players')}
        >
          <Ionicons 
            name="hourglass-outline" 
            size={20} 
            color={selectedTab === 'pending-players' ? THEME.primary : THEME.darkGray} 
          />
          <Text style={[
            stylesDynasty.tabText,
            selectedTab === 'pending-players' && [stylesDynasty.activeTabText, { color: THEME.primary }]
          ]}>
            Pending ({players.filter(p => p.status === 'pending').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            stylesDynasty.tab,
            selectedTab === 'approved-players' && [stylesDynasty.activeTab, { borderBottomColor: THEME.primary }]
          ]}
          onPress={() => setSelectedTab('approved-players')}
        >
          <Ionicons 
            name="checkmark-circle-outline" 
            size={20} 
            color={selectedTab === 'approved-players' ? THEME.primary : THEME.darkGray} 
          />
          <Text style={[
            stylesDynasty.tabText,
            selectedTab === 'approved-players' && [stylesDynasty.activeTabText, { color: THEME.primary }]
          ]}>
            Approved ({players.filter(p => p.status === 'approved').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            stylesDynasty.tab,
            selectedTab === 'matches' && [stylesDynasty.activeTab, { borderBottomColor: THEME.primary }]
          ]}
          onPress={() => setSelectedTab('matches')}
        >
          <Ionicons 
            name="trophy-outline" 
            size={20} 
            color={selectedTab === 'matches' ? THEME.primary : THEME.darkGray} 
          />
          <Text style={[
            stylesDynasty.tabText,
            selectedTab === 'matches' && [stylesDynasty.activeTabText, { color: THEME.primary }]
          ]}>
            Matches
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content based on selected tab */}
      {selectedTab === 'dashboard' ? (
        renderDashboardContent()
      ) : selectedTab === 'pending-players' ? (
        <FlatList
          data={getFilteredPlayers()}
          renderItem={renderPlayerCard}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={stylesDynasty.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={
            <View style={stylesDynasty.emptyContainer}>
              <Ionicons 
                name="hourglass-outline"
                size={64} 
                color="#d1d5db" 
              />
              <Text style={stylesDynasty.emptyText}>
                {searchQuery 
                  ? "No players found matching your search" 
                  : "No pending player registrations"}
              </Text>
            </View>
          }
        />
      ) : selectedTab === 'approved-players' ? (
        <FlatList
          data={getFilteredPlayers()}
          renderItem={renderApprovedPlayerCard}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={stylesDynasty.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={
            <View style={stylesDynasty.emptyContainer}>
              <Ionicons 
                name="checkmark-circle-outline"
                size={64} 
                color="#d1d5db" 
              />
              <Text style={stylesDynasty.emptyText}>
                {searchQuery 
                  ? "No players found matching your search" 
                  : "No approved players yet"}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatchCard}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={stylesDynasty.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={
            <View style={stylesDynasty.emptyContainer}>
              <Ionicons name="trophy" size={64} color="#d1d5db" />
              <Text style={stylesDynasty.emptyText}>No matches found</Text>
            </View>
          }
        />
      )}

      {/* Edit Match Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={stylesDynasty.modalOverlay}>
          <View style={stylesDynasty.modalContent}>
            <View style={stylesDynasty.modalHeader}>
              <Text style={stylesDynasty.modalHeaderTitle}>
                Schedule Match
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={stylesDynasty.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={stylesDynasty.modalScroll}>
              {selectedMatch && (
                <View style={stylesDynasty.matchPreview}>
                  <View style={stylesDynasty.matchPreviewPlayers}>
                    <View style={stylesDynasty.previewPlayer}>
                      <Image 
                        source={getPlayerAvatar(selectedMatch.player1!)}
                        style={stylesDynasty.previewAvatar}
                      />
                      <Text style={stylesDynasty.previewName}>{selectedMatch.player1?.name}</Text>
                    </View>
                    
                    <Text style={stylesDynasty.previewVs}>VS</Text>
                    
                    <View style={stylesDynasty.previewPlayer}>
                      <Image 
                        source={getPlayerAvatar(selectedMatch.player2!)}
                        style={stylesDynasty.previewAvatar}
                      />
                      <Text style={stylesDynasty.previewName}>{selectedMatch.player2?.name}</Text>
                    </View>
                  </View>
                </View>
              )}
              
              <View style={stylesDynasty.formGroup}>
                <Text style={stylesDynasty.formLabel}>Match Status</Text>
                <View style={stylesDynasty.statusButtons}>
                  <TouchableOpacity 
                    style={[
                      stylesDynasty.statusButton,
                      selectedMatchStatus === 'scheduled' && stylesDynasty.statusButtonActive
                    ]}
                    onPress={() => setSelectedMatchStatus('scheduled')}
                  >
                    <Text style={[
                      stylesDynasty.statusButtonText,
                      selectedMatchStatus === 'scheduled' && stylesDynasty.statusButtonTextActive
                    ]}>Scheduled</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={stylesDynasty.formGroup}>
                <Text style={stylesDynasty.formLabel}>Match Date & Time</Text>
                <TouchableOpacity 
                  style={stylesDynasty.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                  <Text style={stylesDynasty.dateText}>
                    {scheduledDate.toLocaleDateString()} {scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                </TouchableOpacity>
                
                <DateTimePickerModal
                  isVisible={showDatePicker}
                  mode="datetime"
                  onConfirm={onDateConfirm}
                  onCancel={onDateCancel}
                  date={scheduledDate}
                  minimumDate={new Date()}
                />
              </View>
              
              <View style={stylesDynasty.modalActions}>
                <TouchableOpacity 
                  style={stylesDynasty.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={stylesDynasty.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={stylesDynasty.saveButton}
                  onPress={handleMatchUpdate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={stylesDynasty.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Add missing dynasty styles
const stylesDynasty = {
  ...StyleSheet.create({
    // Common container styles
    container: {
      flex: 1,
      backgroundColor: '#f3f4f6',
    },
    
    // Player Card Styles
    playerCard: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    playerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    playerHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    playerAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      marginRight: 12,
    },
    playerName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#111827',
      marginBottom: 4,
    },
    countryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    countryFlag: {
      fontSize: 16,
      marginRight: 8,
    },
    playerCountry: {
      fontSize: 14,
      color: '#6b7280',
    },
    playerBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    pendingBadge: {
      backgroundColor: '#FEF3C7',
    },
    approvedBadge: {
      backgroundColor: '#D1FAE5',
    },
    rejectedBadge: {
      backgroundColor: '#FEE2E2',
    },
    playerBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    pendingText: {
      color: '#D97706',
    },
    approvedText: {
      color: '#047857',
    },
    rejectedText: {
      color: '#DC2626',
    },
    playerDetails: {
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    detailText: {
      marginLeft: 8,
      fontSize: 13,
      color: '#6B7280',
    },
    bioContainer: {
      backgroundColor: '#F9FAFB',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    bioText: {
      fontSize: 14,
      color: '#4B5563',
      lineHeight: 20,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      flex: 1,
      marginHorizontal: 4,
    },
    approveButton: {
      backgroundColor: '#10B981',
    },
    rejectButton: {
      backgroundColor: '#EF4444',
    },
    viewButton: {
      backgroundColor: '#F3F4F6',
      marginTop: 8,
    },
    actionButtonText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    
    // Match card styles
    card: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
    },
    matchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    matchStatus: {
      flexDirection: 'column',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      color: 'white',
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    matchDate: {
      fontSize: 14,
      color: '#6b7280',
      fontWeight: '500',
    },
    roundText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#4b5563',
      backgroundColor: '#f3f4f6',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    matchPlayers: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
      paddingHorizontal: 12,
    },
    playerColumn: {
      flex: 2,
      alignItems: 'center',
    },
    vsContainer: {
      flex: 1,
      alignItems: 'center',
    },
    vsText: {
      fontSize: 24,
      fontWeight: '700',
      color: '#9ca3af',
    },
    matchPlayerAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: '#e5e7eb',
    },
    matchPlayerName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#111827',
      textAlign: 'center',
      marginBottom: 4,
    },
    matchPlayerRating: {
      fontSize: 14,
      color: '#6b7280',
      textAlign: 'center',
      fontWeight: '500',
    },
    unknownPlayer: {
      fontSize: 14,
      color: '#9ca3af',
      textAlign: 'center',
    },
    rescheduleButton: {
      backgroundColor: '#3b82f6',
    },
  }),
  
  // Adding missing styles
  ...StyleSheet.create({
    dashboardContainer: {
      flex: 1,
      backgroundColor: '#f3f4f6',
      padding: 16,
    },
    dynastyInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    dynastyFlagImage: {
      width: 60,
      height: 40,
      borderRadius: 8,
      marginRight: 16,
    },
    dynastyInfoText: {
      flex: 1,
    },
    dynastyInfoTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 4,
    },
    dynastyInfoSubtitle: {
      fontSize: 14,
      color: '#6b7280',
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 4,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 14,
      color: '#FFFFFF',
      opacity: 0.8,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
    },
    seeAllText: {
      fontSize: 14,
      color: '#3b82f6',
      fontWeight: '500',
    },
    quickActionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    quickActionButton: {
      width: '48%',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    quickActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    quickActionText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#4b5563',
      textAlign: 'center',
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: 16,
    },
  }),
  
  // More missing styles
  ...StyleSheet.create({
    header: {
      paddingTop: Platform.OS === 'android' ? 40 : 0,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      overflow: 'hidden',
    },
    dynastyInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dynastyFlag: {
      fontSize: 24,
      marginRight: 8,
      color: '#FFFFFF',
    },
    dynastyName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 20,
      paddingHorizontal: 12,
      height: 40,
      width: 160,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontSize: 14,
      color: '#FFFFFF',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      paddingTop: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: '#3b82f6',
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#6b7280',
      marginLeft: 4,
    },
    activeTabText: {
      color: '#3b82f6',
    },
    listContainer: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f3f4f6',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: '#4b5563',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 16,
      color: '#6b7280',
      textAlign: 'center',
    },
  }),
  
  // Modal styles
  ...StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: 'white',
      padding: 20,
      borderRadius: 20,
      width: '80%',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalHeaderTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827',
    },
    closeButton: {
      padding: 4,
    },
    modalScroll: {
      maxHeight: '80%',
    },
    matchPreview: {
      backgroundColor: '#f9fafb',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    matchPreviewPlayers: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    previewPlayer: {
      alignItems: 'center',
      flex: 2,
    },
    previewAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginBottom: 8,
    },
    previewName: {
      fontSize: 14,
      fontWeight: '500',
      color: '#111827',
      textAlign: 'center',
    },
    previewVs: {
      fontSize: 16,
      fontWeight: '700',
      color: '#6b7280',
      flex: 1,
      textAlign: 'center',
    },
    formGroup: {
      marginBottom: 16,
    },
    formLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    statusButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statusButton: {
      padding: 10,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 8,
    },
    statusButtonActive: {
      borderColor: '#3b82f6',
    },
    statusButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    statusButtonTextActive: {
      color: '#3b82f6',
    },
    datePickerButton: {
      padding: 10,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    cancelButton: {
      padding: 10,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 8,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    saveButton: {
      padding: 10,
      borderWidth: 1,
      borderColor: '#3b82f6',
      borderRadius: 8,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#3b82f6',
    },
  }),
  
  // Add collapsible card styles
  ...StyleSheet.create({
    collapsibleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 8,
    },
    expandIconContainer: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playerOverview: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: THEME.lightGray,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    expandedContent: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: THEME.lightGray,
      marginTop: 8,
    },
    expandedContentContainer: {
      overflow: 'hidden',
    },
  }),
  
  // Adding reviewStatusBadge styles
  ...StyleSheet.create({
    reviewStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 16,
      marginTop: 6,
      alignSelf: 'flex-start',
    },
    reviewStatusText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  }),
};
