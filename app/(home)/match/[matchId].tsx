import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text,
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Platform,
  RefreshControl
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMatchById, getPlayerById, getFilePreview, databases, APPWRITE_DATABASE_ID, COLLECTION_COUNTRIES, COLLECTION_MATCHES } from '@/lib/appwrite';
import { Models } from 'react-native-appwrite';
import { THEME, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, SPACING } from '@/app/utils/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@clerk/clerk-expo';

// Define types for player and match data
interface Player extends Models.Document {
  name: string;
  rating: number;
  age?: number;
  titles?: string[];
  avatar?: string;
  avatarUrl?: string;
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
  isScheduled?: boolean;
}

// Component for the loading state
const LoadingView = () => (
  <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
    <LinearGradient
      colors={[THEME.primary, THEME.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.loadingGradient}
    >
      <Animatable.View animation="pulse" iterationCount="infinite" duration={1500}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </Animatable.View>
      <Animatable.Text animation="fadeIn" delay={300} style={styles.loadingText}>
        Loading match details...
      </Animatable.Text>
    </LinearGradient>
  </SafeAreaView>
);

// Component for the error state
const ErrorView = ({ onBack }: { onBack: () => void }) => (
  <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <View style={styles.errorContainer}>
      <Animatable.View animation="bounce" duration={1000}>
        <Ionicons name="alert-circle-outline" size={64} color={THEME.danger} />
      </Animatable.View>
      <Animatable.Text animation="fadeIn" delay={300} style={styles.errorTitle}>
        Match Not Found
      </Animatable.Text>
      <Animatable.Text animation="fadeIn" delay={500} style={styles.errorDescription}>
        We couldn't find details for this match.
      </Animatable.Text>
      <Animatable.View animation="fadeIn" delay={700}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backButtonText}>Return to Tournament</Text>
        </TouchableOpacity>
      </Animatable.View>
    </View>
  </SafeAreaView>
);

// Header component with back button and user profile
const Header = ({ onBack, userImageUrl }: { onBack: () => void, userImageUrl?: string }) => (
  <LinearGradient
    colors={[THEME.primary, THEME.primaryLight]}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={styles.header}
  >
    <TouchableOpacity 
      style={styles.backBtn}
      onPress={onBack}
    >
      <Ionicons name="arrow-back" size={24} color="#FFF" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Match Details</Text>
    <TouchableOpacity 
      style={styles.userAvatarContainer}
      onPress={() => {}}
    >
      {userImageUrl ? (
        <Image 
          source={{ uri: userImageUrl }} 
          style={styles.userAvatar} 
        />
      ) : (
        <View style={styles.userAvatarPlaceholder}>
          <Ionicons name="person" size={18} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  </LinearGradient>
);

// Status badge component
const MatchStatusBadge = ({ status, scheduledDate }: { status: string, scheduledDate?: string }) => {
  const getStatusText = () => {
    switch(status) {
      case 'scheduled': return 'Upcoming Match';
      case 'in_progress': return 'Live Now';
      case 'completed': return 'Match Completed';
      default: return 'Unknown Status';
    }
  };

  const getGradientColors = () => {
    switch(status) {
      case 'scheduled': 
        return ['#FFC107', '#FFB300'] as const;
      case 'in_progress': 
        return ['#4CAF50', '#43A047'] as const;
      case 'completed': 
        return ['#9E9E9E', '#757575'] as const;
      default: 
        return ['#F5F5F5', '#EEEEEE'] as const;
    }
  };

  const getTextColor = () => {
    switch(status) {
      case 'scheduled':
      case 'in_progress':
        return '#FFFFFF';
      case 'completed':
      default:
        return THEME.textPrimary;
    }
  };
  
  const formatDate = () => {
    if (!scheduledDate) return "Not scheduled yet";
    
    try {
      const date = new Date(scheduledDate);
      return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } catch (error) {
      return "Invalid date";
    }
  };
  
  return (
    <View style={styles.matchStatusBar}>
      <LinearGradient
        colors={getGradientColors()}
        style={styles.statusBadge}
      >
        {status === 'in_progress' && (
          <Animatable.View 
            animation="pulse" 
            iterationCount="infinite" 
            style={styles.liveIndicator} 
          />
        )}
        <Text style={[styles.statusText, { color: getTextColor() }]}>
          {getStatusText()}
        </Text>
      </LinearGradient>
      
      <Text style={styles.matchDateTime}>
        {formatDate()}
      </Text>
    </View>
  );
};

// Player card component for the VS section
const PlayerCard = ({ player, avatarUrl, isPlayer1 }: { player: Player, avatarUrl: string | null, isPlayer1: boolean }) => (
  <Animatable.View 
    animation={isPlayer1 ? "fadeInLeft" : "fadeInRight"} 
    duration={800} 
    delay={200} 
    style={styles.playerCard}
  >
    <View style={styles.avatarContainer}>
      <Image 
        source={{ uri: avatarUrl || `https://avatars.dicebear.com/api/bottts/${encodeURIComponent(player.username || player.name)}.svg` }} 
        style={styles.playerImage}
      />
      <LinearGradient
        colors={isPlayer1 ? [THEME.primary, '#4F46E5'] : ['#EF4444', '#F43F5E']}
        style={styles.playerBadge}
      >
        <Text style={styles.playerBadgeText}>{isPlayer1 ? 'P1' : 'P2'}</Text>
      </LinearGradient>
    </View>
    <Text numberOfLines={1} style={styles.playerName}>{player.name}</Text>
    <View style={styles.ratingContainer}>
      <Ionicons name="star" size={14} color={THEME.primary} />
      <Text style={styles.playerRating}>{player.rating}</Text>
    </View>
  </Animatable.View>
);

// Win probability component
const WinProbability = ({ match }: { match: Match }) => {
  if (!match.winProbability) return null;
  
  const player1Wins = match.predictedWinnerId === match.player1?.$id;
  const gradientColors = player1Wins ? 
    ['#4F46E5', '#3B82F6'] as const : 
    ['#EF4444', '#F43F5E'] as const;
    
  return (
    <Animatable.View animation="fadeIn" delay={300} style={styles.probabilityContainer}>
      <View style={styles.probabilityBar}>
        <LinearGradient
          colors={gradientColors}
          style={[
            styles.probabilityFill, 
            { 
              width: `${match.winProbability}%`,
              alignSelf: player1Wins ? 'flex-start' : 'flex-end'  
            }
          ]}
        />
      </View>
      <Text style={styles.probabilityText}>
        {match.predictedWinner?.name || 
         (match.predictedWinnerId === match.player1?.$id ? match.player1?.name : match.player2?.name)
        } favored ({match.winProbability}%)
      </Text>
    </Animatable.View>
  );
};

// Player details card component
const PlayerDetailCard = ({ player, avatarUrl, colorScheme = 'blue' }: 
  { player: Player, avatarUrl: string | null, colorScheme?: 'blue' | 'red' }) => {
  
  const [isExpanded, setIsExpanded] = useState(false);
  
  const gradientColors = colorScheme === 'blue' ? 
    ['#4F46E5', '#3B82F6'] as const : 
    ['#EF4444', '#F43F5E'] as const;
    
  const calculateWinPercentage = (wins?: number, losses?: number) => {
    if (!wins || !losses) return '0%';
    const total = wins + losses;
    if (total === 0) return '0%';
    return `${Math.round((wins / total) * 100)}%`;
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
    
  return (
    <Animatable.View 
      animation="fadeInUp" 
      duration={800} 
      delay={500} 
      style={styles.playerDetailsCard}
    >
      {/* Card Header - Always visible */}
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={toggleExpand}
        style={styles.playerDetailHeader}
      >
        <View style={{flex: 1}}>
          <Text style={styles.playerDetailName}>
            {player.name}
            <Text style={styles.ratingInline}> ({player.rating})</Text>
          </Text>
          {player.username && (
            <Text style={styles.usernameText}>@{player.username}</Text>
          )}
        </View>
        <View style={styles.avatarAndIconContainer}>
          <Image 
            source={{ uri: avatarUrl || `https://avatars.dicebear.com/api/bottts/${encodeURIComponent(player.username || player.name)}.svg` }}
            style={styles.playerDetailAvatar}
          />
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={THEME.textSecondary}
            style={styles.expandIcon}
          />
        </View>
      </TouchableOpacity>
      
      {/* Expandable Content */}
      {isExpanded && (
        <Animatable.View 
          animation="fadeIn"
          duration={300}
          style={styles.expandableContent}
        >
          {/* Player Titles */}
          {player.titles && player.titles.length > 0 && (
            <View style={styles.titlesContainer}>
              {player.titles.map((title, index) => (
                <LinearGradient
                  key={index}
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.titleBadge}
                >
                  <Text style={styles.titleText}>{title}</Text>
                </LinearGradient>
              ))}
            </View>
          )}
          
          {/* Player Bio */}
          {player.bio && (
            <View style={styles.bioContainer}>
              <Text style={styles.playerBio}>{player.bio}</Text>
            </View>
          )}
          
          {/* Player Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <LinearGradient
                colors={[THEME.primary, THEME.primaryLight] as const}
                style={styles.statIconContainer}
              >
                <Ionicons name="star" size={16} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={styles.statValue}>{player.rating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
            
            <View style={styles.statItem}>
              <LinearGradient
                colors={[THEME.primary, THEME.primaryLight] as const}
                style={styles.statIconContainer}
              >
                <Ionicons name="calendar" size={16} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={styles.statValue}>{player.age || '--'}</Text>
                <Text style={styles.statLabel}>Age</Text>
              </View>
            </View>
            
            <View style={styles.statItem}>
              <LinearGradient
                colors={[THEME.primary, THEME.primaryLight] as const}
                style={styles.statIconContainer}
              >
                <Ionicons name="trending-up" size={16} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={styles.statValue}>
                  {calculateWinPercentage(player.wins, player.losses)}
                </Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
            </View>
          </View>
        </Animatable.View>
      )}
    </Animatable.View>
  );
};

// Action button component for match actions
const ActionButton = ({ 
  title, 
  onPress, 
  icon, 
  primary = false 
}: { 
  title: string;
  onPress: () => void;
  icon: string;
  primary?: boolean;
}) => {
  return (
    <TouchableOpacity 
      style={[
        styles.actionButton,
        primary ? styles.primaryButton : {}
      ]} 
      onPress={onPress}
    >
      <Ionicons 
        name={icon as keyof typeof Ionicons.glyphMap} 
        size={24} 
        color={primary ? THEME.white : THEME.primary} 
      />
      <Text style={[
        styles.actionButtonText,
        primary ? styles.primaryButtonText : {}
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

// Main component
const MatchDetailPage = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = params.matchId as string;
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [country, setCountry] = useState<string>('');
  const [player1Avatar, setPlayer1Avatar] = useState<string | null>(null);
  const [player2Avatar, setPlayer2Avatar] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  
  // Function to fetch match data
  const fetchMatchData = async () => {
    if (!matchId) {
      console.log('No match ID provided');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    console.log('Fetching match with ID:', matchId);
    
    try {
      setRefreshError(null);
      
      // Fetch match directly from matches collection
      const matchData = await databases.getDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_MATCHES,
        matchId
      );
      
      console.log('Match Data:', matchData);
      
      if (!matchData) {
        console.log('Match not found in database');
        setLoading(false);
        setRefreshing(false);
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
          predictedWinner: player1Data.rating > player2Data.rating ? player1Data : player2Data,
          isScheduled: true
        } as Match;
        
        setMatch(enrichedMatch);
        
        // Set player avatars from Appwrite storage if needed
        if (player1Data.avatar && !player1Data.avatarUrl) {
          setPlayer1Avatar(getFilePreview(player1Data.avatar).toString());
        } else if (player1Data.avatarUrl) {
          setPlayer1Avatar(player1Data.avatarUrl);
        }
        
        if (player2Data.avatar && !player2Data.avatarUrl) {
          setPlayer2Avatar(getFilePreview(player2Data.avatar).toString());
        } else if (player2Data.avatarUrl) {
          setPlayer2Avatar(player2Data.avatarUrl);
        }
        
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
    } catch (error) {
      console.error('Error details:', error);
      setRefreshError('Failed to refresh match data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchMatchData();
  }, [matchId]);
  
  // Handle pull-to-refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setRefreshError(null);
    fetchMatchData();
  }, [matchId]);
  
  if (loading) {
    return <LoadingView />;
  }
  
  if (!match || !match.player1 || !match.player2) {
    return <ErrorView onBack={() => router.back()} />;
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <Header 
        onBack={() => router.back()} 
        userImageUrl={clerkLoaded && clerkUser ? clerkUser.imageUrl : undefined}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.primary}
            colors={[THEME.primary]}
            progressViewOffset={20}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {refreshError && (
          <Animatable.View 
            animation="fadeIn" 
            style={styles.refreshErrorContainer}
          >
            <Ionicons name="alert-circle" size={20} color={THEME.danger} />
            <Text style={styles.refreshErrorText}>{refreshError}</Text>
          </Animatable.View>
        )}
        
        <Animatable.View animation="fadeInDown" duration={800} style={styles.matchInfoCard}>
          <MatchStatusBadge 
            status={match.status} 
            scheduledDate={match.scheduledDate}
          />
          
          <View style={styles.vsContainer}>
            <PlayerCard 
              player={match.player1} 
              avatarUrl={player1Avatar} 
              isPlayer1={true}
            />
            
            <View style={styles.vsInfo}>
              <Animatable.Text animation="pulse" iterationCount={3} duration={1000} style={styles.vsText}>
                VS
              </Animatable.Text>
              <WinProbability match={match} />
            </View>
            
            <PlayerCard 
              player={match.player2} 
              avatarUrl={player2Avatar} 
              isPlayer1={false}
            />
          </View>
          
          {country && (
            <Animatable.View animation="fadeIn" delay={500} style={styles.matchMetaInfo}>
              <View style={styles.metaItem}>
                <Ionicons name="location" size={16} color={THEME.primary} />
                <Text style={styles.matchMetaText}>{country}</Text>
              </View>
              
              <View style={styles.metaItemDivider} />
              
              <View style={styles.metaItem}>
                <Ionicons name="trophy" size={16} color={THEME.primary} />
                <Text style={styles.matchMetaText}>Round {match.round || 1}</Text>
              </View>
            </Animatable.View>
          )}
        </Animatable.View>
        
        <Animatable.View animation="fadeIn" delay={400}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color="#FFF" />
            <Text style={styles.sectionTitle}>Player Details</Text>
          </View>
        </Animatable.View>
        
        <PlayerDetailCard 
          player={match.player1} 
          avatarUrl={player1Avatar} 
          colorScheme="blue" 
        />
        
        <PlayerDetailCard 
          player={match.player2} 
          avatarUrl={player2Avatar} 
          colorScheme="red" 
        />
        
        <Animatable.View animation="fadeInUp" duration={800} delay={700}>
          {match.status === 'scheduled' && (
            <View style={styles.actionButtonsRow}>
              <ActionButton 
                title="Get Notifications"
                onPress={() => {
                  alert('Notifications not implemented yet');
                }}
                icon="notifications"
              />
              
              <ActionButton 
                title="Play Game" 
                onPress={() => {
                  // Debug: Log the matchId before navigating
                  console.log('Navigating to game with matchId:', matchId);
                  
                  // Use direct navigation with string parameters to avoid type issues
                  router.push({
                    pathname: '/match/game',
                    params: { matchId: String(matchId) }
                  });
                }}
                icon="game-controller"
                primary
              />
            </View>
          )}
          
          {match.status === 'in_progress' && (
            <View style={styles.actionButtonsRow}>
              <ActionButton 
                title="Watch Live"
                onPress={() => {
                  alert('Live viewing not implemented yet');
                }}
                icon="videocam"
              />
              
              <ActionButton 
                title="Resume Game" 
                onPress={() => {
                  console.log('Navigating to game with matchId:', matchId);
                  router.push({
                    pathname: '/match/game',
                    params: { matchId: String(matchId) }
                  });
                }}
                icon="play-circle"
                primary
              />
            </View>
          )}
          
          {match.status === 'completed' && (
            <ActionButton 
              title="Review Game" 
              onPress={() => {
                console.log('Navigating to game with matchId:', matchId);
                router.push({
                  pathname: '/match/game',
                  params: { matchId: String(matchId) }
                });
              }}
              icon="eye"
              primary
            />
          )}
        </Animatable.View>
        
        <View style={{ height: 32 }} /> {/* Bottom spacing */}
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
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.large,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  userAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userAvatar: {
    width: '100%',
    height: '100%',
  },
  userAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  matchInfoCard: {
    backgroundColor: THEME.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  liveIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    marginRight: 8,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 14,
  },
  matchStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  matchDateTime: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  playerCard: {
    alignItems: 'center',
    width: '28%',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  playerImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
    ...SHADOWS.small,
  },
  playerBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    ...SHADOWS.small,
  },
  playerBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  playerRating: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.primary,
    marginLeft: 4,
  },
  vsInfo: {
    alignItems: 'center',
    width: '40%',
  },
  vsText: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.primary,
    marginBottom: 12,
  },
  probabilityContainer: {
    width: '100%',
    alignItems: 'center',
  },
  probabilityBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    borderRadius: 4,
  },
  probabilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  matchMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.6)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItemDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(229, 231, 235, 0.6)',
    marginHorizontal: 16,
  },
  matchMetaText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },
  playerDetailsCard: {
    backgroundColor: THEME.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  playerDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerDetailAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: THEME.primary,
    ...SHADOWS.small,
  },
  playerDetailName: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  ratingInline: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  usernameText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  titlesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  titleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bioContainer: {
    backgroundColor: 'rgba(243, 244, 246, 0.5)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  playerBio: {
    fontSize: 14,
    lineHeight: 22,
    color: THEME.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  actionButtonContainer: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    marginHorizontal: SPACING.sm,
  },
  actionButtonText: {
    marginLeft: SPACING.sm,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 20,
    marginBottom: 10,
  },
  errorDescription: {
    fontSize: 16,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 20,
    ...SHADOWS.medium,
  },
  backButtonText: {
    color: THEME.white,
    fontWeight: '700',
    fontSize: 16,
  },
  avatarAndIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandIcon: {
    marginLeft: 8,
  },
  expandableContent: {
    paddingTop: 16,
  },
  refreshErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  refreshErrorText: {
    color: THEME.danger,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  // Primary button styles
  primaryButton: {
    backgroundColor: THEME.primary,
    borderWidth: 0,
  },
  primaryButtonText: {
    color: THEME.white,
    fontWeight: 'bold',
  },
});

export default MatchDetailPage; 