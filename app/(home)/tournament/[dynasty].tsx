import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  GestureResponderEvent
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getCountryByName, getPlayersByCountry, getFilePreview, createMatch, getMatchesByTournament } from '@/lib/appwrite';
import { Models } from 'appwrite';
import { Ionicons } from '@expo/vector-icons';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';

// Define types for the data structure
interface Player extends Models.Document {
  name: string;
  rating: number;
  age?: number;
  titles?: string[];
  avatar?: string;
  bio?: string;
  wins?: number;
  losses?: number;
  countryId: string;
}

interface Country extends Models.Document {
  name: string;
  flag: string;
  playerCount?: number;
  players?: Player[];
}

// Updated Match interface to match Appwrite document structure
interface Match extends Models.Document {
  player1Id: string;
  player2Id: string;
  tournamentId: string;
  round: number;
  status: string;
  scheduledDate?: string;
  player1?: Player;
  player2?: Player;
  predictedWinnerId?: string;
  predictedWinner?: Player;
  winProbability?: number;
}

const CountryMatchesScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryData, setCountryData] = useState<Country | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matchesGenerated, setMatchesGenerated] = useState<Match[]>([]);
  const [activeRound, setActiveRound] = useState(1);
  const [retried, setRetried] = useState(false);
  // Get the dynasty parameter directly from params
  const dynastyName = params.dynasty as string;

  const fetchData = async (retry = false) => {
    if (!dynastyName) {
      setLoading(false);
      setError('No country specified');
      return;
    }
    
    try {
      // Fetch country data
      const country = await getCountryByName(dynastyName);
      if (!country) {
        setError(`Country ${dynastyName} not found`);
        setLoading(false);
        return;
      }
      
      setCountryData(country as Country);
      
      // Fetch players for this country
      const playersData = await getPlayersByCountry(country.$id);
      setPlayers(playersData as Player[]);
      
      // Check if matches already exist for this country/tournament
      const existingMatches = await getMatchesByTournament(country.$id);
      
      if (existingMatches && existingMatches.length > 0) {
        console.log("Using existing matches from database");
        
        // Enrich the matches with player data
        const enrichedMatches = await Promise.all(existingMatches.map(async (match: any) => {
          try {
            const player1 = playersData.find(p => p.$id === match.player1Id);
            const player2 = playersData.find(p => p.$id === match.player2Id);
            
            if (player1 && player2) {
              // Determine predicted winner
              const predictedWinnerId = match.predictedWinnerId || 
                (player1.rating > player2.rating ? player1.$id : player2.$id);
              const predictedWinner = player1.rating > player2.rating ? player1 : player2;
              
              return {
                ...match,
                player1,
                player2,
                predictedWinnerId,
                predictedWinner,
                winProbability: match.winProbability || 
                  calculateWinProbability(player1.rating, player2.rating)
              };
            }
            return match;
          } catch (err) {
            console.error("Error enriching match:", err);
            return match;
          }
        }));
        
        setMatchesGenerated(enrichedMatches as Match[]);
      } else {
        console.log("No existing matches, generating new ones");
        // Generate and save matches
        const matches = await generateTournamentMatches(playersData as Player[], country.$id);
        setMatchesGenerated(matches);
      }
      
    } catch (err: unknown) {
      console.error('Error fetching tournament data:', err);
      setError(`Failed to load tournament data. Please check Appwrite permissions.`);
    } finally {
        setLoading(false);
    }
  };
  
  // Calculate win probability based on Elo ratings
  const calculateWinProbability = (rating1: number, rating2: number) => {
    const ratingDiff = rating1 - rating2;
    const winProbability = 1 / (1 + Math.pow(10, -ratingDiff / 400));
    return Math.round(winProbability * 100);
  };
  
  // Handle retry button click
  const handleRetry = (_event: GestureResponderEvent) => {
    setRetried(false);
    fetchData();
  };
  
  useEffect(() => {
    fetchData();
  }, [dynastyName]);

  // Generate tournament matches with proper seeding and rounds
  const generateTournamentMatches = async (players: Player[], tournamentId: string): Promise<Match[]> => {
    // First, sort players by rating (descending)
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    
    // For a proper tournament seeding, we match highest vs lowest and so on
    // This ensures top players don't meet early
    const matches: Match[] = [];
    const rounds = Math.ceil(Math.log2(sortedPlayers.length));
    const totalPlayers = Math.pow(2, rounds);

    // Create first round matches with proper seeding
    // In case of uneven number of players, we'll add byes in later rounds
    for (let i = 0; i < Math.min(Math.floor(sortedPlayers.length / 2), sortedPlayers.length); i++) {
      // Pair 1st with last, 2nd with second-last, etc.
      const player1 = sortedPlayers[i];
      const player2 = sortedPlayers[sortedPlayers.length - 1 - i];

      // Calculate win probability
      const winProbability = calculateWinProbability(player1.rating, player2.rating);
      const predictedWinnerId = player1.rating > player2.rating ? player1.$id : player2.$id;

      try {
        // Create actual match in Appwrite
        const matchData = {
          player1Id: player1.$id,
          player2Id: player2.$id,
          tournamentId: tournamentId,
          round: 1,
          status: 'scheduled',
          predictedWinnerId: predictedWinnerId,
          winProbability: winProbability,
          scheduledDate: new Date().toISOString()
        };
        
        // Save to Appwrite
        const savedMatch = await createMatch(matchData);
        
        // Add to our matches array with player objects attached
        matches.push({
          ...savedMatch,
          player1,
          player2,
          predictedWinnerId,
          predictedWinner: player1.rating > player2.rating ? player1 : player2,
          winProbability
        } as Match);
        
      } catch (error) {
        console.error("Error creating match:", error);
        // If there's an error, add a local match object for display
        matches.push({
          $id: `${player1.$id}-${player2.$id}`,
          player1Id: player1.$id,
          player2Id: player2.$id,
          tournamentId: tournamentId,
          round: 1,
          status: 'scheduled',
          player1,
          player2,
          predictedWinnerId,
          predictedWinner: player1.rating > player2.rating ? player1 : player2,
          winProbability
        } as Match);
      }
    }

    // If we have an odd number of players, the highest seed gets a bye to round 2
    if (sortedPlayers.length % 2 !== 0 && sortedPlayers.length > 0) {
      console.log(`Player ${sortedPlayers[Math.floor(sortedPlayers.length / 2)].name} has a bye to round 2`);
    }

    return matches;
  };

  // Get matches for the current round
  const getMatchesByRound = (round: number) => {
    return matchesGenerated.filter(match => match.round === round);
  };

  // Show loading message until dynastyName is available or data is processed
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading tournament data...</Text>
      </SafeAreaView>
    );
  }

  // Handle errors
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Error Loading Data</Text>
          <Text style={styles.errorDescription}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Return to Countries</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
      </View>
      </SafeAreaView>
    );
  }

  // Handle case where countryData is not found after attempting to load
  if (!countryData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Country Not Found</Text>
          <Text style={styles.errorDescription}>No data available for the selected country.</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Return to Countries</Text>
          </TouchableOpacity>
      </View>
      </SafeAreaView>
    );
  }

  // Get flag URL
  const getFlagUrl = (countryCode: string) => {
    return `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`;
  };

  // Get formatted titles for display
  const formatTitles = (titles?: string[]) => {
    if (!titles || titles.length === 0) return '';
    return titles.join(', ');
  };
  
  // Get avatar URL for a player
  const getPlayerAvatar = (player: Player) => {
    if (player.avatar) {
      return getFilePreview(player.avatar).toString();
      }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random`;
  };

  const currentRoundMatches = getMatchesByRound(activeRound);

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
        
        <View style={styles.countryInfo}>
          <Image
            source={{ uri: getFlagUrl(countryData.flag) }}
            style={styles.flagImage}
            resizeMode="cover"
          />
          <Text style={styles.countryName}>{countryData.name}</Text>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{players.length}</Text>
          <Text style={styles.statLabel}>Players</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{matchesGenerated.length}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {players.length > 0 ? Math.max(...players.map(p => p.rating)) : 0}
          </Text>
          <Text style={styles.statLabel}>Top Rating</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.registerButton}
        onPress={() => router.push(`/player-registration?country=${countryData.name}`)}
      >
        <Text style={styles.registerButtonText}>Register as Player</Text>
        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
      
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Tournament Bracket</Text>
        <Text style={styles.sectionDescription}>
          Round {activeRound} Matches - {currentRoundMatches.length} games scheduled
        </Text>
        
        {currentRoundMatches.length > 0 ? (
        <FlatList
            data={currentRoundMatches}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={styles.matchesList}
            renderItem={({ item }) => {
              // Ensure we have player objects before rendering
              if (!item.player1 || !item.player2) return null;
              
              return (
                <TouchableOpacity 
                  style={styles.matchCard}
                  onPress={() => router.push(`/match/${item.$id}`)}
                >
                  <View style={styles.matchContent}>
                    <View style={styles.playerContainer}>
                      <Image 
                        source={{ uri: getPlayerAvatar(item.player1) }} 
                        style={styles.playerAvatar} 
                      />
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{item.player1.name}</Text>
                        <Text style={styles.playerMeta}>
                          {formatTitles(item.player1.titles)} • {item.player1.rating}
                        </Text>
                      </View>
                      {item.predictedWinner?.$id === item.player1.$id && (
                        <View style={styles.favoriteTag}>
                          <Text style={styles.favoriteText}>{item.winProbability}%</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.vsContainer}>
                      <Text style={styles.vsText}>VS</Text>
                    </View>
                    
                    <View style={styles.playerContainer}>
                      <Image 
                        source={{ uri: getPlayerAvatar(item.player2) }} 
                        style={styles.playerAvatar} 
                      />
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{item.player2.name}</Text>
                        <Text style={styles.playerMeta}>
                          {formatTitles(item.player2.titles)} • {item.player2.rating}
                        </Text>
                      </View>
                      {item.predictedWinner?.$id === item.player2.$id && (
                        <View style={styles.favoriteTag}>
                          <Text style={styles.favoriteText}>{item.winProbability}%</Text>
            </View>
          )}
                    </View>
                  </View>
                  
                  <View style={styles.matchFooter}>
                    <Text style={styles.matchTime}>
                      <Ionicons name="time-outline" size={14} color="#6B7280" /> Scheduled
                    </Text>
                    <View style={styles.viewButton}>
                      <Text style={styles.viewButtonText}>View Details</Text>
                      <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
        />
      ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Matches Scheduled</Text>
            <Text style={styles.emptyDescription}>
              There are no matches scheduled for this round yet.
            </Text>
          </View>
      )}
    </View>
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
    backgroundColor: THEME.light,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: {
    padding: 8,
  },
  countryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 40, // Balance for the back button
  },
  flagImage: {
    width: 32,
    height: 24,
    borderRadius: 4,
    marginRight: 10,
  },
  countryName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: THEME.lightGray,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.primary,
  },
  sectionDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  matchesList: {
    paddingBottom: 24,
  },
  matchCard: {
    backgroundColor: THEME.white,
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
    overflow: 'hidden',
  },
  matchContent: {
    padding: 16,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.lightGray,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  playerMeta: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  favoriteTag: {
    backgroundColor: THEME.primaryTransparent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  favoriteText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.primary,
  },
  vsContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
  },
  matchTime: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.primary,
    marginRight: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: 12,
  },
  emptyDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 16,
  },
  backButton: {
    backgroundColor: THEME.mediumGray,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
    marginRight: 8,
  },
  avatarEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
});

export default CountryMatchesScreen;
