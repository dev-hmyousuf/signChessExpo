import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Image,
  Modal,
  Platform,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  databases, 
  COLLECTION_PLAYERS, 
  COLLECTION_COUNTRIES, 
  COLLECTION_MATCHES,
  APPWRITE_DATABASE_ID, 
  getCountryByName, 
  getFilePreview,
  getMatchesByTournament,
  updateMatch,
  getPlayerById
} from '@/lib/appwrite';
import { Query } from 'react-native-appwrite';
import DateTimePicker from '@react-native-community/datetimepicker';
import AdminRolesPage from '@/app/components/admin-roles';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInRight, 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  SlideInRight
} from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Define interfaces for data models
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
}

interface Match {
  $id: string;
  player1Id: string;
  player2Id: string;
  tournamentId: string;
  round: number;
  status: string;
  scheduledDate?: string;
  player1?: Player;
  player2?: Player;
}

interface DashboardStats {
  pendingCount: number;
  approvedCount: number;
  totalPlayers: number;
  countriesCount: number;
  matchesCount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPlayers, setPendingPlayers] = useState<Player[]>([]);
  const [approvedPlayers, setApprovedPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'approved' | 'matches' | 'admin-roles'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryNames, setCountryNames] = useState<{[key: string]: string}>({});
  const [countryFlags, setCountryFlags] = useState<{[key: string]: string}>({});
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMatchStatus, setSelectedMatchStatus] = useState('scheduled');
  const [stats, setStats] = useState<DashboardStats>({
    pendingCount: 0,
    approvedCount: 0,
    totalPlayers: 0,
    countriesCount: 0,
    matchesCount: 0
  });
  
  // Animation values
  const headerOpacity = useSharedValue(0);
  const statsOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Fetch players from Appwrite
  const fetchPlayers = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch both pending and approved players in parallel
      const [pendingResponse, approvedResponse] = await Promise.all([
        databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          [Query.equal('status', 'pending')]
        ),
        databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          [Query.equal('status', 'approved')]
        )
      ]);
      
      // Set player data
      const pendingData = pendingResponse.documents as unknown as Player[];
      const approvedData = approvedResponse.documents as unknown as Player[];
      
      setPendingPlayers(pendingData);
      setApprovedPlayers(approvedData);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        pendingCount: pendingResponse.total,
        approvedCount: approvedResponse.total,
        totalPlayers: pendingResponse.total + approvedResponse.total,
      }));
      
      // Get unique country IDs for fetching country data
      const allPlayers = [...pendingData, ...approvedData];
      const countryIds = [...new Set(allPlayers.map(player => player.countryId))];
      
      // Fetch country data in parallel
      const countryMap: {[key: string]: string} = {};
      const flagMap: {[key: string]: string} = {};
      
      await Promise.all(
        countryIds.map(async (countryId) => {
          try {
            const countryDoc = await databases.getDocument(
              APPWRITE_DATABASE_ID,
              COLLECTION_COUNTRIES,
              countryId
            );
            countryMap[countryId] = countryDoc.name;
            flagMap[countryId] = countryDoc.flag || '🏁';
          } catch (error) {
            console.error(`Failed to fetch country for ID ${countryId}:`, error);
            countryMap[countryId] = 'Unknown';
            flagMap[countryId] = '🏁';
          }
        })
      );
      
      setCountryNames(countryMap);
      setCountryFlags(flagMap);
      setStats(prev => ({...prev, countriesCount: Object.keys(countryMap).length}));
    } catch (error) {
      console.error('Failed to fetch players:', error);
      Alert.alert('Error', 'Failed to load player data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch matches from Appwrite with optimized loading
  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all matches
      const matchesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_MATCHES,
        [Query.limit(100)]
      );
      
      // Extract match data and unique player IDs
      const matchesData = matchesResponse.documents as unknown as Match[];
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
      const players: { [key: string]: Player } = {};
      Array.from(playerIds).forEach((id, idx) => {
        if (playerResults[idx]) {
          players[id] = playerResults[idx]!;
        }
      });
      
      // Enrich matches with player data, skip if missing
      const enrichedMatches = matchesData.map(match => ({
        ...match,
        player1: players[match.player1Id],
        player2: players[match.player2Id]
      }));
      
      setMatches(enrichedMatches);
      setStats(prev => ({...prev, matchesCount: matchesResponse.total}));
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      Alert.alert('Error', 'Failed to load match data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Player approval and rejection functions
  const handleApprovePlayer = async (player: Player) => {
    try {
      setLoading(true);
      
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        player.$id,
        { status: 'approved' }
      );
      
      Alert.alert('Success', `Player ${player.name} has been approved successfully`);
      fetchPlayers();
    } catch (error) {
      console.error('Failed to approve player:', error);
      Alert.alert('Error', 'Failed to approve player. Please try again.');
      setLoading(false);
    }
  };

  const handleRejectPlayer = async (player: Player) => {
    try {
      setLoading(true);
      
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        player.$id,
        { status: 'rejected' }
      );
      
      Alert.alert('Success', `Player ${player.name} has been rejected`);
      fetchPlayers();
    } catch (error) {
      console.error('Failed to reject player:', error);
      Alert.alert('Error', 'Failed to reject player. Please try again.');
      setLoading(false);
    }
  };

  // Match management functions
  const handleMatchUpdate = async () => {
    if (!selectedMatch) return;
    
    try {
      setLoading(true);
      
      await updateMatch(selectedMatch.$id, {
        status: selectedMatchStatus,
        scheduledDate: scheduledDate.toISOString()
      });
      
      Alert.alert('Success', 'Match has been updated successfully');
      setEditModalVisible(false);
      fetchMatches();
    } catch (error) {
      console.error('Failed to update match:', error);
      Alert.alert('Error', 'Failed to update match. Please try again.');
      setLoading(false);
    }
  };

  const handleEditMatch = (match: Match) => {
    setSelectedMatch(match);
    setScheduledDate(match.scheduledDate ? new Date(match.scheduledDate) : new Date());
    setSelectedMatchStatus(match.status || 'scheduled');
    setEditModalVisible(true);
  };

  // Helpers and utilities
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedTab === 'matches') {
      fetchMatches();
    } else {
      fetchPlayers();
    }
  }, [selectedTab, fetchMatches, fetchPlayers]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlayerAvatar = useCallback((player: Player) => {
    // Check if avatarUrl is a Clerk URL (already a full URL)
    if (player?.avatarUrl && player.avatarUrl.startsWith('http')) {
      return player.avatarUrl;
    }
    // Check for legacy avatar field
    else if (player?.avatar) {
      // If it's an Appwrite file ID, use getFilePreview
      return getFilePreview(player.avatar).toString();
    }
    // Fallback to a generated avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(player?.name || 'Player')}&background=random`;
  }, []);

  // Data filtering functions
  const getFilteredPlayers = useCallback(() => {
    const players = selectedTab === 'pending' ? pendingPlayers : approvedPlayers;
    
    if (!searchQuery) return players;
    
    const query = searchQuery.toLowerCase();
    return players.filter(player => 
      player.name.toLowerCase().includes(query) ||
      (player.twitterUsername && player.twitterUsername.toLowerCase().includes(query)) ||
      (countryNames[player.countryId] && countryNames[player.countryId].toLowerCase().includes(query)) ||
      (player.bio && player.bio.toLowerCase().includes(query))
    );
  }, [selectedTab, pendingPlayers, approvedPlayers, searchQuery, countryNames]);

  const getFilteredMatches = useCallback(() => {
    if (!searchQuery) return matches;
    
    const query = searchQuery.toLowerCase();
    return matches.filter(match => 
      (match.player1?.name && match.player1.name.toLowerCase().includes(query)) ||
      (match.player2?.name && match.player2.name.toLowerCase().includes(query)) ||
      (countryNames[match.tournamentId] && countryNames[match.tournamentId].toLowerCase().includes(query)) ||
      (match.status && match.status.toLowerCase().includes(query))
    );
  }, [matches, searchQuery, countryNames]);

  // Load initial data
  useEffect(() => {
    fetchPlayers();
    fetchMatches();
  }, [fetchPlayers, fetchMatches]);

  // Add animation effect when component mounts
  useEffect(() => {
    const animationDelay = 300;
    
    setTimeout(() => {
      headerOpacity.value = withTiming(1, { duration: 500 });
    }, animationDelay);
    
    setTimeout(() => {
      statsOpacity.value = withTiming(1, { duration: 600 });
    }, animationDelay + 200);
    
    setTimeout(() => {
      contentOpacity.value = withTiming(1, { duration: 700 });
    }, animationDelay + 400);
  }, []);

  // Animation styles
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [{ translateY: withTiming(headerOpacity.value * 0, { duration: 500 }) }]
    };
  });

  const statsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: statsOpacity.value,
      transform: [{ translateY: withTiming((1 - statsOpacity.value) * 20, { duration: 600 }) }]
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      flex: 1
    };
  });

  // Render player card with improved design
  const renderPlayerCard = useCallback(({ item: player }: { item: Player }) => {
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerHeaderLeft}>
            <Image 
              source={{ uri: getPlayerAvatar(player) }} 
              style={styles.playerAvatar} 
            />
            <View>
              <Text style={styles.playerName}>{player.name}</Text>
              <View style={styles.countryContainer}>
                <Text style={styles.countryFlag}>{countryFlags[player.countryId] || '🏁'}</Text>
                <Text style={styles.playerCountry}>{countryNames[player.countryId] || 'Loading...'}</Text>
              </View>
            </View>
          </View>
          <View style={[
            styles.playerBadge, 
            player.status === 'pending' ? styles.pendingBadge : styles.approvedBadge
          ]}>
            <Text style={[
              styles.playerBadgeText,
              player.status === 'pending' ? styles.pendingText : styles.approvedText
            ]}>
              {player.status === 'pending' ? 'Pending Review' : 'Approved'}
            </Text>
          </View>
        </View>
        
        <View style={styles.playerDetails}>
          <View style={styles.detailRow}>
            {player.twitterUsername && (
              <View style={styles.detailItem}>
                <Ionicons name="logo-twitter" size={16} color="#1DA1F2" />
                <Text style={styles.detailText}>@{player.twitterUsername}</Text>
              </View>
            )}
            
            <View style={styles.detailItem}>
              <Ionicons name="stats-chart-outline" size={16} color="#6B7280" />
              <Text style={styles.detailText}>Rating: {player.rating}</Text>
            </View>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>Registered: {formatDate(player.createdAt)}</Text>
          </View>
        </View>
        
        {player.bio && (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>{player.bio}</Text>
          </View>
        )}
        
        {player.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprovePlayer(player)}
            >
              <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleRejectPlayer(player)}
            >
              <Ionicons name="close-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [countryFlags, countryNames, getPlayerAvatar, handleApprovePlayer, handleRejectPlayer]);

  // Render match card with improved design
  const renderMatchCard = useCallback(({ item: match }: { item: Match }) => {
    return (
      <View style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <View style={styles.tournamentInfo}>
            <View style={styles.tournamentRow}>
              <Ionicons name="trophy-outline" size={18} color="#3B82F6" />
              <Text style={styles.tournamentName}>
                {countryNames[match.tournamentId] || 'Tournament'}
              </Text>
            </View>
            <Text style={styles.roundText}>Round {match.round || 1}</Text>
          </View>
          <View style={[
            styles.matchBadge, 
            match.status === 'scheduled' ? styles.scheduledBadge : 
            match.status === 'in_progress' ? styles.inProgressBadge :
            styles.completedBadge
          ]}>
            <Text style={[
              styles.matchBadgeText,
              match.status === 'scheduled' ? styles.scheduledText : 
              match.status === 'in_progress' ? styles.inProgressText :
              styles.completedText
            ]}>
              {match.status === 'scheduled' ? 'Scheduled' : 
               match.status === 'in_progress' ? 'In Progress' : 
               'Completed'}
            </Text>
          </View>
        </View>

        <View style={styles.matchPlayers}>
          <View style={styles.playerMatch}>
            {match.player1 ? (
              <>
                <Image 
                  source={{ uri: getPlayerAvatar(match.player1) }} 
                  style={styles.playerMatchAvatar} 
                />
                <Text style={styles.playerMatchName}>{match.player1.name}</Text>
              </>
            ) : (
              <View style={styles.playerPlaceholder}>
                <Ionicons name="person" size={24} color="#9CA3AF" />
                <Text style={styles.playerPlaceholderText}>Player 1</Text>
              </View>
            )}
          </View>
          
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          
          <View style={styles.playerMatch}>
            {match.player2 ? (
              <>
                <Image 
                  source={{ uri: getPlayerAvatar(match.player2) }} 
                  style={styles.playerMatchAvatar} 
                />
                <Text style={styles.playerMatchName}>{match.player2.name}</Text>
              </>
            ) : (
              <View style={styles.playerPlaceholder}>
                <Ionicons name="person" size={24} color="#9CA3AF" />
                <Text style={styles.playerPlaceholderText}>Player 2</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.matchDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {match.scheduledDate ? formatDate(match.scheduledDate) : 'Not scheduled yet'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditMatch(match)}
        >
          <Ionicons name="calendar" size={18} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Schedule/Edit Match</Text>
        </TouchableOpacity>
      </View>
    );
  }, [countryNames, getPlayerAvatar, handleEditMatch]);

  // Render content based on selected tab
  const renderTabContent = useCallback(() => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loaderText}>
            Loading...
          </Text>
        </View>
      );
    }

    switch (selectedTab) {
      case 'pending':
      case 'approved':
        const filteredPlayers = getFilteredPlayers();
        return (
          <FlatList
            data={filteredPlayers}
            renderItem={renderPlayerCard}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons 
                  name={selectedTab === 'pending' ? "hourglass-outline" : "checkmark-circle-outline"} 
                  size={58} 
                  color="#9CA3AF" 
                />
                <Text style={styles.emptyTitle}>
                  {searchQuery
                    ? 'No players found'
                    : selectedTab === 'pending' 
                      ? 'No pending registrations' 
                      : 'No approved players yet'}
                </Text>
                <Text style={styles.emptyDescription}>
                  {searchQuery
                    ? 'Try different search terms'
                    : selectedTab === 'pending'
                      ? 'All player registrations have been processed'
                      : 'Approve pending registrations to see them here'}
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3B82F6']}
                tintColor="#3B82F6"
              />
            }
          />
        );
      case 'matches':
        const filteredMatches = getFilteredMatches();
        return (
          <FlatList
            data={filteredMatches}
            renderItem={renderMatchCard}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={58} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>
                  {searchQuery
                    ? 'No matches found'
                    : 'No matches scheduled'}
                </Text>
                <Text style={styles.emptyDescription}>
                  {searchQuery
                    ? 'Try different search terms'
                    : 'Matches will appear here once created'}
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3B82F6']}
                tintColor="#3B82F6"
              />
            }
          />
        );
      case 'admin-roles':
        return <AdminRolesPage />;
      default:
        return null;
    }
  }, [
    loading, refreshing, selectedTab, searchQuery, 
    getFilteredPlayers, getFilteredMatches, 
    onRefresh, renderPlayerCard, renderMatchCard
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
      
      {/* Stats Cards */}
      <Animated.View style={[styles.statsContainer, statsAnimatedStyle]}>
        <View style={styles.statCard}>
          <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
          <Text style={styles.statValue}>{stats.approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="game-controller-outline" size={20} color="#3B82F6" />
          <Text style={styles.statValue}>{stats.matchesCount}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
      </Animated.View>
      
      {/* Navigation Tabs */}
      <Animated.View style={[styles.tabsContainer, statsAnimatedStyle]}>
        <AnimatedTouchable
          style={[styles.tab, selectedTab === 'pending' && styles.activeTab]}
          onPress={() => setSelectedTab('pending')}
          entering={FadeIn.delay(500)}
        >
          <Ionicons 
            name="hourglass-outline" 
            size={20} 
            color={selectedTab === 'pending' ? THEME.primary : '#6B7280'} 
          />
          <Text style={[styles.tabText, selectedTab === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
        </AnimatedTouchable>
        
        <AnimatedTouchable
          style={[styles.tab, selectedTab === 'approved' && styles.activeTab]}
          onPress={() => setSelectedTab('approved')}
          entering={FadeIn.delay(600)}
        >
          <Ionicons 
            name="checkmark-circle-outline" 
            size={20} 
            color={selectedTab === 'approved' ? THEME.primary : '#6B7280'} 
          />
          <Text style={[styles.tabText, selectedTab === 'approved' && styles.activeTabText]}>
            Approved
          </Text>
        </AnimatedTouchable>
        
        <AnimatedTouchable
          style={[styles.tab, selectedTab === 'matches' && styles.activeTab]}
          onPress={() => setSelectedTab('matches')}
          entering={FadeIn.delay(700)}
        >
          <Ionicons 
            name="trophy-outline" 
            size={20} 
            color={selectedTab === 'matches' ? THEME.primary : '#6B7280'} 
          />
          <Text style={[styles.tabText, selectedTab === 'matches' && styles.activeTabText]}>
            Matches
          </Text>
        </AnimatedTouchable>
        
        <AnimatedTouchable
          style={[styles.tab, selectedTab === 'admin-roles' && styles.activeTab]}
          onPress={() => setSelectedTab('admin-roles')}
          entering={FadeIn.delay(800)}
        >
          <Ionicons 
            name="people-outline" 
            size={20} 
            color={selectedTab === 'admin-roles' ? THEME.primary : '#6B7280'} 
          />
          <Text style={[styles.tabText, selectedTab === 'admin-roles' && styles.activeTabText]}>
            Admin Roles
          </Text>
        </AnimatedTouchable>
      </Animated.View>
      
      {/* Tab Content */}
      <Animated.View style={contentAnimatedStyle}>
        {renderTabContent()}
      </Animated.View>

      {/* Match Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Match</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {selectedMatch && (
              <ScrollView>
                <View style={styles.matchPlayersModal}>
                  <View style={styles.playerMatch}>
                    {selectedMatch.player1 ? (
                      <>
                        <Image 
                          source={{ uri: getPlayerAvatar(selectedMatch.player1) }} 
                          style={styles.playerMatchAvatarModal} 
                        />
                        <Text style={styles.playerMatchNameModal}>{selectedMatch.player1.name}</Text>
                      </>
                    ) : (
                      <View style={styles.playerPlaceholder}>
                        <Ionicons name="person" size={24} color="#9CA3AF" />
                        <Text style={styles.playerPlaceholderText}>Player 1</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.vsContainerModal}>
                    <Text style={styles.vsTextModal}>VS</Text>
                  </View>
                  
                  <View style={styles.playerMatch}>
                    {selectedMatch.player2 ? (
                      <>
                        <Image 
                          source={{ uri: getPlayerAvatar(selectedMatch.player2) }} 
                          style={styles.playerMatchAvatarModal} 
                        />
                        <Text style={styles.playerMatchNameModal}>{selectedMatch.player2.name}</Text>
                      </>
                    ) : (
                      <View style={styles.playerPlaceholder}>
                        <Ionicons name="person" size={24} color="#9CA3AF" />
                        <Text style={styles.playerPlaceholderText}>Player 2</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Match Status</Text>
                  <View style={styles.statusButtons}>
                    <TouchableOpacity 
                      style={[
                        styles.statusButton,
                        selectedMatchStatus === 'scheduled' && styles.statusButtonActive
                      ]}
                      onPress={() => setSelectedMatchStatus('scheduled')}
                    >
                      <Ionicons 
                        name="calendar-outline" 
                        size={16} 
                        color={selectedMatchStatus === 'scheduled' ? '#FFFFFF' : '#6B7280'} 
                      />
                      <Text style={[
                        styles.statusButtonText,
                        selectedMatchStatus === 'scheduled' && styles.statusButtonTextActive
                      ]}>Scheduled</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.statusButton,
                        selectedMatchStatus === 'in_progress' && styles.statusButtonActive
                      ]}
                      onPress={() => setSelectedMatchStatus('in_progress')}
                    >
                      <Ionicons 
                        name="play-outline" 
                        size={16} 
                        color={selectedMatchStatus === 'in_progress' ? '#FFFFFF' : '#6B7280'} 
                      />
                      <Text style={[
                        styles.statusButtonText,
                        selectedMatchStatus === 'in_progress' && styles.statusButtonTextActive
                      ]}>In Progress</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.statusButton,
                        selectedMatchStatus === 'completed' && styles.statusButtonActive
                      ]}
                      onPress={() => setSelectedMatchStatus('completed')}
                    >
                      <Ionicons 
                        name="checkmark-done-outline" 
                        size={16} 
                        color={selectedMatchStatus === 'completed' ? '#FFFFFF' : '#6B7280'} 
                      />
                      <Text style={[
                        styles.statusButtonText,
                        selectedMatchStatus === 'completed' && styles.statusButtonTextActive
                      ]}>Completed</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Match Date & Time</Text>
                  <TouchableOpacity 
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    <Text style={styles.dateText}>
                      {scheduledDate.toLocaleDateString()} {scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </TouchableOpacity>
                  
                  {showDatePicker && (
                    <DateTimePicker
                      value={scheduledDate}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onDateChange}
                    />
                  )}
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={handleMatchUpdate}
                  >
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
  },
  header: {
    backgroundColor: THEME.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: THEME.textPrimary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.white,
    padding: 16,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: THEME.light,
    borderRadius: 12,
    padding: 12,
    minWidth: '28%',
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.primary,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.white,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: THEME.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textSecondary,
    marginLeft: 4,
  },
  activeTabText: {
    color: THEME.primary,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 15,
    color: THEME.textSecondary,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  playerCard: {
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: THEME.lightGray,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 15,
    marginRight: 6,
  },
  playerCountry: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  playerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  pendingBadge: {
    backgroundColor: THEME.secondary,
  },
  approvedBadge: {
    backgroundColor: THEME.primaryTransparent,
  },
  playerBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pendingText: {
    color: THEME.primary,
  },
  approvedText: {
    color: THEME.primary,
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
    color: THEME.textSecondary,
  },
  bioContainer: {
    backgroundColor: THEME.light,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
  },
  approveButton: {
    backgroundColor: THEME.success,
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: THEME.danger,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.white,
  },
  matchCard: {
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginLeft: 6,
  },
  roundText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginLeft: 24,
  },
  matchBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  scheduledBadge: {
    backgroundColor: THEME.secondary,
  },
  inProgressBadge: {
    backgroundColor: THEME.primaryTransparent,
  },
  completedBadge: {
    backgroundColor: THEME.lightGray,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scheduledText: {
    color: THEME.primary,
  },
  inProgressText: {
    color: THEME.primary,
  },
  completedText: {
    color: THEME.textSecondary,
  },
  matchPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  playerMatch: {
    alignItems: 'center',
    width: '42%',
  },
  playerMatchAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    backgroundColor: THEME.lightGray,
  },
  playerMatchName: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
    textAlign: 'center',
  },
  vsContainer: {
    width: '16%',
    alignItems: 'center',
    backgroundColor: THEME.light,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  playerPlaceholder: {
    alignItems: 'center',
  },
  playerPlaceholderText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  matchDetails: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: THEME.light,
    borderRadius: 12,
  },
  editButton: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  editButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  matchPlayersModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  playerMatchAvatarModal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
    backgroundColor: THEME.lightGray,
  },
  playerMatchNameModal: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.textPrimary,
    textAlign: 'center',
  },
  vsContainerModal: {
    padding: 10,
    backgroundColor: THEME.light,
    borderRadius: 30,
  },
  vsTextModal: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.textPrimary,
    marginBottom: 10,
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  statusButtonActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  statusButtonText: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginLeft: 6,
  },
  statusButtonTextActive: {
    color: THEME.white,
    fontWeight: '500',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: 10,
  },
  dateText: {
    fontSize: 14,
    color: THEME.textPrimary,
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
  },
});