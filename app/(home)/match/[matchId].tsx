import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  SafeAreaView, 
  ScrollView,
  StatusBar,
  ActivityIndicator 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMatchById, getPlayerById, getFilePreview, databases, APPWRITE_DATABASE_ID, COLLECTION_COUNTRIES } from '@/lib/appwrite';
import { Models } from 'appwrite';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';

// Define types for player and match data
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
  username?: string;
}

interface Match extends Models.Document {
  player1Id: string;
  player2Id: string;
  tournamentId: string;
  round: number;
  status: string;
  scheduledDate?: string;
  player1?: Player;
  player2?: Player;
  winProbability?: number;
  predictedWinnerId?: string;
  predictedWinner?: Player;
}

const MatchDetailPage = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = params.matchId as string;
  
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [country, setCountry] = useState<string>('');
  
  useEffect(() => {
    const fetchMatchData = async () => {
      if (!matchId) {
        setLoading(false);
        return;
      }
      
      try {
        // Check if this is a composite ID (player1Id-player2Id format)
        if (matchId.includes('-')) {
          const [player1Id, player2Id] = matchId.split('-');
          
          // Fetch both players
          const player1Data = await getPlayerById(player1Id);
          const player2Data = await getPlayerById(player2Id);
          
          if (player1Data && player2Data) {
            // Calculate win probability based on Elo rating
            const ratingDiff = player1Data.rating - player2Data.rating;
            const winProbability = 1 / (1 + Math.pow(10, -ratingDiff / 400));
            
            // Create a virtual match object
            const virtualMatch = {
              $id: matchId,
              player1Id: player1Id,
              player2Id: player2Id,
              tournamentId: player1Data.countryId, // Use country as tournament
              round: 1,
              status: 'scheduled',
              player1: player1Data,
              player2: player2Data,
              winProbability: Math.round(winProbability * 100),
              predictedWinnerId: player1Data.rating > player2Data.rating ? player1Data.$id : player2Data.$id,
              predictedWinner: player1Data.rating > player2Data.rating ? player1Data : player2Data
            } as Match;
            
            setMatch(virtualMatch);
            
            // Fetch country name
            try {
              const countryData = await databases.getDocument(
                APPWRITE_DATABASE_ID,
                COLLECTION_COUNTRIES,
                player1Data.countryId
              );
              setCountry(countryData.name || '');
            } catch (err) {
              console.error('Error fetching country:', err);
            }
          }
        } else {
          // This is a normal match ID, fetch from Appwrite
          const matchData = await getMatchById(matchId);
          if (!matchData) {
            setLoading(false);
            return;
          }
          
          // Fetch player details
          const player1Data = await getPlayerById(matchData.player1Id);
          const player2Data = await getPlayerById(matchData.player2Id);
          
          if (player1Data && player2Data) {
            // Calculate win probability based on Elo rating
            const ratingDiff = player1Data.rating - player2Data.rating;
            const winProbability = 1 / (1 + Math.pow(10, -ratingDiff / 400));
            
            // Add players to match object
            const enrichedMatch = {
              ...matchData,
              player1: player1Data,
              player2: player2Data,
              winProbability: Math.round(winProbability * 100),
              predictedWinnerId: player1Data.rating > player2Data.rating ? player1Data.$id : player2Data.$id,
              predictedWinner: player1Data.rating > player2Data.rating ? player1Data : player2Data
            } as Match;
            
            setMatch(enrichedMatch);
            
            // Fetch country name
            try {
              const countryData = await databases.getDocument(
                APPWRITE_DATABASE_ID,
                COLLECTION_COUNTRIES,
                player1Data.countryId
              );
              setCountry(countryData.name || '');
            } catch (err) {
              console.error('Error fetching country:', err);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching match data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatchData();
  }, [matchId]);
  
  // Format the player's titles for display
  const formatTitles = (titles?: string[]) => {
    if (!titles || titles.length === 0) return '';
    return titles.join(', ');
  };
  
  // Calculate win percentage
  const calculateWinPercentage = (wins?: number, losses?: number) => {
    if (!wins || !losses) return '0%';
    const total = wins + losses;
    if (total === 0) return '0%';
    return `${Math.round((wins / total) * 100)}%`;
  };
  
  // Get avatar URL for a player
  const getPlayerAvatar = (player: Player) => {
    if (player.avatar) {
      return getFilePreview(player.avatar).toString();
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random`;
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading match details...</Text>
      </SafeAreaView>
    );
  }
  
  if (!match || !match.player1 || !match.player2) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Match Not Found</Text>
          <Text style={styles.errorDescription}>
            We couldn't find details for this match.
          </Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Return to Tournament</Text>
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
        <Text style={styles.headerTitle}>Match Details</Text>
        <View style={{ width: 32 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.matchInfoCard}>
          <View style={styles.matchStatusBar}>
            <View style={[
              styles.statusIndicator, 
              // @ts-ignore - we know these styles exist
              styles[`status_${match.status}` as keyof typeof styles]
            ]} />
            <Text style={styles.statusText}>
              {match.status === 'scheduled' && 'Upcoming Match'}
              {match.status === 'in_progress' && 'Match In Progress'}
              {match.status === 'completed' && 'Match Completed'}
            </Text>
            
            {match.scheduledDate && (
              <Text style={styles.matchDateTime}>
                {new Date(match.scheduledDate).toLocaleDateString()} at {new Date(match.scheduledDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            )}
          </View>
          
          <View style={styles.vsContainer}>
            <View style={styles.playerVsCard}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: getPlayerAvatar(match.player1) }}
                  style={styles.playerImage}
                />
                <View style={styles.playerBadge}>
                  <Text style={styles.playerBadgeText}>P1</Text>
                </View>
              </View>
              <Text style={styles.playerVsName}>{match.player1.name}</Text>
              <Text style={styles.playerRating}>{match.player1.rating}</Text>
            </View>
            
            <View style={styles.vsInfo}>
              <Text style={styles.vsText}>VS</Text>
              {match.winProbability && (
                <View style={styles.probabilityContainer}>
                  <View style={[
                    styles.probabilityBar,
                    { 
                      flexDirection: match.predictedWinnerId === match.player1.$id ? 'row' : 'row-reverse',
                    }
                  ]}>
                    <View style={[
                      styles.probabilityFill, 
                      { 
                        width: `${match.winProbability}%`,
                        backgroundColor: match.predictedWinnerId === match.player1.$id ? '#3B82F6' : '#EF4444'
                      }
                    ]} />
                  </View>
                  <Text style={styles.probabilityText}>
                    {match.predictedWinner?.name || (match.predictedWinnerId === match.player1?.$id ? match.player1?.name : match.player2?.name)} favored ({match.winProbability}%)
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.playerVsCard}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: getPlayerAvatar(match.player2) }}
                  style={styles.playerImage}
                />
                <View style={styles.playerBadge}>
                  <Text style={styles.playerBadgeText}>P2</Text>
                </View>
              </View>
              <Text style={styles.playerVsName}>{match.player2.name}</Text>
              <Text style={styles.playerRating}>{match.player2.rating}</Text>
            </View>
          </View>
          
          {country && (
            <View style={styles.matchMetaInfo}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.matchMetaText}>{country} Tournament</Text>
              
              <Ionicons name="trophy-outline" size={14} color="#6B7280" style={{ marginLeft: 12 }} />
              <Text style={styles.matchMetaText}>Round {match.round || 1}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.sectionTitle}>Player Details</Text>
        
        <View style={styles.playerDetailsCard}>
          <Text style={styles.playerDetailName}>{match.player1.name}</Text>
          {match.player1.titles && match.player1.titles.length > 0 && (
            <View style={styles.titlesContainer}>
              {match.player1.titles.map((title, index) => (
                <View key={index} style={styles.titleBadge}>
                  <Text style={styles.titleText}>{title}</Text>
                </View>
              ))}
            </View>
          )}
          
          <Text style={styles.playerBio}>{match.player1.bio || 'No biography available.'}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{match.player1.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{match.player1.age || '--'}</Text>
              <Text style={styles.statLabel}>Age</Text>
            </View>
            
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {calculateWinPercentage(match.player1.wins, match.player1.losses)}
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.playerDetailsCard}>
          <Text style={styles.playerDetailName}>{match.player2.name}</Text>
          {match.player2.titles && match.player2.titles.length > 0 && (
            <View style={styles.titlesContainer}>
              {match.player2.titles.map((title, index) => (
                <View key={index} style={styles.titleBadge}>
                  <Text style={styles.titleText}>{title}</Text>
                </View>
              ))}
            </View>
          )}
          
          <Text style={styles.playerBio}>{match.player2.bio || 'No biography available.'}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{match.player2.rating}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{match.player2.age || '--'}</Text>
              <Text style={styles.statLabel}>Age</Text>
            </View>
            
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {calculateWinPercentage(match.player2.wins, match.player2.losses)}
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        </View>
        
        {match.status === 'scheduled' && (
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Get Match Notifications</Text>
          </TouchableOpacity>
        )}
        
        {match.status === 'in_progress' && (
          <TouchableOpacity style={[styles.actionButton, styles.liveButton]}>
            <View style={styles.liveIndicator} />
            <Text style={styles.actionButtonText}>Watch Live Stream</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  matchInfoCard: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 24,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 3,
  },
  matchStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  status_scheduled: {
    backgroundColor: THEME.warning,
  },
  status_in_progress: {
    backgroundColor: THEME.success,
  },
  status_completed: {
    backgroundColor: THEME.mediumGray,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerVsCard: {
    alignItems: 'center',
    width: '30%',
  },
  playerImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  playerVsName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  playerRating: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  vsInfo: {
    alignItems: 'center',
    width: '36%',
  },
  vsText: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  probabilityContainer: {
    width: '100%',
    alignItems: 'center',
  },
  probabilityBar: {
    width: '100%',
    height: 6,
    backgroundColor: THEME.lightGray,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  probabilityFill: {
    height: '100%',
  },
  probabilityText: {
    fontSize: 10,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  matchMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
  },
  matchMetaText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.primary,
    marginBottom: 12,
  },
  playerDetailsCard: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  playerDetailName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  titlesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  titleBadge: {
    backgroundColor: THEME.primaryTransparent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.primary,
  },
  playerBio: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
    paddingTop: 16,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  liveButton: {
    backgroundColor: THEME.danger,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.white,
    marginRight: 8,
  },
  actionButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 16,
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
  },
  errorDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  playerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.white,
  },
  playerBadgeText: {
    color: THEME.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  matchDateTime: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginLeft: 'auto',
  },
});

export default MatchDetailPage; 