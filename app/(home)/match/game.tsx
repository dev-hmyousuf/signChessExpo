import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Button } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import GameBoard from '@/app/components/GameBoard';
import { THEME, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@/app/utils/theme';
import { getMatchById, getPlayerById, updateMatchData, APPWRITE_DATABASE_ID, COLLECTION_MATCHES, client, databases } from '@/lib/appwrite';
import { Models, RealtimeResponseEvent } from 'react-native-appwrite';
import * as Animatable from 'react-native-animatable';
import { saveDebugInfo, analyzeMoveData, getAllDebugLogs } from '@/app/utils/debugUtils';
import { appendToArray, formatArraysForAppwrite, safelyGetArray } from '@/app/utils/fixArraysHelper';

// Define types for player and match data
interface Player extends Models.Document {
  name: string;
  rating: number;
  avatar?: string;
  avatarUrl?: string;
  countryId: string;
}

interface Match extends Models.Document {
  player1Id: string;
  player2Id: string;
  tournamentId: string;
  round: number;
  status: string;
  scheduledDate?: string;
  gamePosition?: string; // FEN position
  movesPlayed?: string[]; // Array of moves in algebraic notation
  result?: string; // "1-0", "0-1", "1/2-1/2", or null if ongoing
}

interface RealtimeResponse {
  events: string[];
  payload: any;
  channels: string[];
  timestamp: number;
}

// Add a debug function to check the database
const checkDatabaseMatch = async (matchId: string) => {
  try {
    // Fetch raw match data from database to verify what's actually stored
    const match = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MATCHES,
      matchId
    );
    
    Alert.alert(
      'Database Match Data',
      `MovesPlayed: ${match.movesPlayed ? JSON.stringify(match.movesPlayed) : 'undefined'}\n` +
      `Type: ${match.movesPlayed ? typeof match.movesPlayed : 'undefined'}\n` +
      `Is Array: ${match.movesPlayed ? Array.isArray(match.movesPlayed) : 'N/A'}\n` +
      `Length: ${match.movesPlayed && Array.isArray(match.movesPlayed) ? match.movesPlayed.length : 0}`
    );
    
    return match;
  } catch (error) {
    console.error('Error checking database match:', error);
    Alert.alert('Error', 'Failed to check database match: ' + JSON.stringify(error));
    return null;
  }
};

// Add a custom error boundary to catch and handle chess errors
class ChessErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log the error
    console.error('ChessErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <View style={styles.errorBoundary}>
          <Text style={styles.errorTitle}>Something went wrong with the chess board</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              // Reset the error state
              this.setState({ hasError: false });
            }}
          >
            <Text style={styles.resetText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function MatchGamePage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Handle both direct matchId parameter and matchId in the URL
  let matchId = '';
  
  if (params.matchId) {
    // Direct parameter
    matchId = String(params.matchId);
  } else {
    // Try to extract from URL path
    const path = window.location?.pathname || '';
    const matches = path.match(/\/match\/game\/([^\/]+)/);
    if (matches && matches[1]) {
      matchId = matches[1];
    }
  }
  
  console.log('Final matchId:', matchId);
  
  const [match, setMatch] = useState<Match | null>(null);
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [position, setPosition] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [realtimeUnsubscribe, setRealtimeUnsubscribe] = useState<(() => void) | null>(null);
  
  useEffect(() => {
    console.log('Match game page loaded with params:', params);
    console.log('matchId from params:', matchId);
    
    // Clear existing error state first
    setError(null);
    
    if (!matchId || matchId === '') {
      console.error('Invalid match ID detected:', matchId);
      setError('Invalid match ID');
      setIsLoading(false);
      return;
    }
    
    // Debug alert to confirm component is loaded correctly
    setTimeout(() => {
      if (matchId) {
        Alert.alert('Debug Info', 
          `Game component loaded successfully.\nMatch ID: ${matchId}\nIsLiveMatch: true\nReady to save moves to database.`,
          [{ text: 'OK', onPress: () => console.log('Debug alert closed') }]
        );
      }
    }, 1000);
    
    const fetchData = async () => {
      try {
        // Fetch match data
        console.log('Fetching match with ID:', matchId);
        // Add explicit debug to track database call
        console.log('Calling getMatchById with:', matchId);
        const matchData = await getMatchById(matchId);
        console.log('Match data received:', matchData ? 'OK' : 'null');
        
        if (!matchData) {
          console.error('Match not found with ID:', matchId);
          setError('Match not found');
          setIsLoading(false);
          return;
        }
        
        // Success - update match state
        console.log('Setting match state with data:', matchData.$id);
        
        // Debug the movesPlayed field to understand its structure
        console.log('MovesPlayed data type:', typeof matchData.movesPlayed);
        console.log('MovesPlayed is array:', Array.isArray(matchData.movesPlayed));
        console.log('MovesPlayed content:', matchData.movesPlayed);
        
        if (matchData.movesPlayed && !Array.isArray(matchData.movesPlayed)) {
          // If movesPlayed exists but is not an array, convert it to an array
          console.log('Converting movesPlayed to array');
          try {
            if (typeof matchData.movesPlayed === 'string' && 
                (matchData.movesPlayed.startsWith('[') || matchData.movesPlayed.startsWith('{'))) {
              // Try to parse it as JSON
              try {
                matchData.movesPlayed = JSON.parse(matchData.movesPlayed);
              } catch (e) {
                console.error('Failed to parse movesPlayed JSON:', e);
                matchData.movesPlayed = [matchData.movesPlayed];
              }
            } else {
              // Treat as a single move and make it an array
              matchData.movesPlayed = [matchData.movesPlayed];
            }
          } catch (conversionError) {
            console.error('Error converting movesPlayed to array:', conversionError);
            matchData.movesPlayed = [];
          }
        }
        
        // Ensure movesPlayed is always an array
        if (!matchData.movesPlayed) {
          matchData.movesPlayed = [];
        }
        
        setMatch(matchData as Match);
        
        // Fetch players data
        console.log('Fetching player data for:', matchData.player1Id, matchData.player2Id);
        const [p1Data, p2Data] = await Promise.all([
          getPlayerById(matchData.player1Id),
          getPlayerById(matchData.player2Id)
        ]);
        
        setPlayer1(p1Data as Player);
        setPlayer2(p2Data as Player);
        
        // Set the position
        setPosition(matchData.gamePosition || undefined);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching match data:', err);
        setError('Failed to load match: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up real-time subscription
    setupRealtime();
    
    // Clean up function
    return () => {
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
        console.log('Cleaned up realtime subscription');
      }
    };
  }, [matchId]);
  
  // Setup realtime subscription
  const setupRealtime = () => {
    if (!matchId) {
      console.log('Cannot setup realtime: matchId is missing');
      return null;
    }
    
    try {
      // Ensure client is imported and available
      if (!client) {
        console.error('Appwrite client not available');
        return null;
      }
      
      // Create the channel name for document-level subscription
      const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${COLLECTION_MATCHES}.documents.${matchId}`;
      console.log(`Subscribing to realtime channel: ${channel}`);
      
      // Track reconnection attempts
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 5;
      
      // Subscribe to document updates with reconnection logic
      const unsubscribe = client.subscribe(channel, (response: RealtimeResponseEvent<any>) => {
        console.log('Realtime update received:', response);
        
        if (response && response.events && response.events.includes('databases.*.collections.*.documents.*.update')) {
          console.log('Match updated in database!');
          
          // Extract the updated match data from the payload
          const updatedMatch = response.payload;
          
          if (updatedMatch) {
            console.log('Updated match data:', updatedMatch);
            
            // Process the movesPlayed field to ensure it's handled correctly
            if (updatedMatch.movesPlayed) {
              console.log('MovesPlayed received:', updatedMatch.movesPlayed);
              console.log('MovesPlayed type:', typeof updatedMatch.movesPlayed);
              console.log('Is Array:', Array.isArray(updatedMatch.movesPlayed));
              
              // Handle the case where movesPlayed might be a string instead of an array
              let processedMoves = updatedMatch.movesPlayed;
              
              if (typeof processedMoves === 'string' && 
                  (processedMoves.startsWith('[') || processedMoves.startsWith('{'))) {
                try {
                  processedMoves = JSON.parse(processedMoves);
                } catch (e) {
                  console.error('Failed to parse movesPlayed JSON string:', e);
                }
              }
              
              // Ensure it's an array
              if (!Array.isArray(processedMoves)) {
                processedMoves = processedMoves ? [processedMoves] : [];
              }
              
              // Update the match with processed moves
              updatedMatch.movesPlayed = processedMoves;
            }
            
            // Update match in state
            setMatch(prevMatch => {
              if (!prevMatch) return updatedMatch;
              
              return {
                ...prevMatch,
                ...updatedMatch,
                // Special handling for arrays to avoid overwriting with empty arrays
                movesPlayed: updatedMatch.movesPlayed && updatedMatch.movesPlayed.length > 0
                  ? updatedMatch.movesPlayed
                  : prevMatch.movesPlayed
              };
            });
            
            // Also update the position if it was changed
            if (updatedMatch.gamePosition) {
              setPosition(updatedMatch.gamePosition);
            }
            
            // Show a notification that the match was updated
            console.log('Match updated via realtime!');
            
            // Show debug toast for realtime update (optional)
            if (__DEV__) {
              Alert.alert(
                'Realtime Update',
                `Match ${matchId} updated.\nMoves: ${updatedMatch.movesPlayed ? updatedMatch.movesPlayed.length : 0}`,
                [{ text: 'OK' }],
                { cancelable: true }
              );
            }
          }
        }
      });
      
      setRealtimeUnsubscribe(() => unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
      return null;
    }
  };
  
  // Handle move submission
  const handleMoveSubmit = async (move: string, currentPosition: string) => {
    try {
      if (!match || !matchId) {
        console.error('Cannot submit move: match is null or matchId is invalid');
        return;
      }
      
      console.log('====== MOVE SUBMISSION DEBUG ======');
      console.log(`Submitting move: ${move}`);
      console.log(`Current position: ${currentPosition}`);
      console.log(`Match ID: ${matchId}`);
      console.log(`Match status: ${match.status}`);
      
      // Check if this is a test move
      const isTestMove = move.startsWith('TEST_');
      console.log(`Is test move: ${isTestMove}`);
      
      // Save debug info for analysis
      await saveDebugInfo('pre_move', {
        match,
        matchId,
        move,
        isTestMove,
        currentPosition,
        movesPlayedAnalysis: analyzeMoveData(match.movesPlayed)
      });
      
      // Get existing moves as a proper array using our helper
      const currentMoves = safelyGetArray(match, 'movesPlayed');
      
      // Append new move to the array
      const updatedMoves = [...currentMoves, move];
      
      console.log('Updated movesPlayed array:', updatedMoves);
      
      // IMPORTANT FIX: Try a different approach to update the array
      // Instead of using $append which might be failing, use a direct update with the full array
      const updateData = {
        movesPlayed: updatedMoves,
        // Only update game position for real moves, not test moves
        ...(isTestMove ? {} : { gamePosition: currentPosition })
      };
      
      console.log('Updating match with data:', JSON.stringify(updateData));
      
      // Save debug info for update attempt
      await saveDebugInfo('update_attempt', {
        updateData,
        matchId,
        isTestMove,
        movesPlayedAnalysis: analyzeMoveData(updatedMoves)
      });
      
      // Update match in the database
      try {
        const result = await updateMatchData(matchId, updateData);
        console.log('Match data updated in database, result:', result);
        
        // Save debug info for successful update
        await saveDebugInfo('update_success', {
          result,
          matchId,
          isTestMove,
          updateData
        });
        
        // Update local match data immediately
        setMatch({
          ...match,
          movesPlayed: updatedMoves,
          // Only update game position for real moves, not test moves
          ...(isTestMove ? {} : { gamePosition: currentPosition })
        });
        
        // Also update position state if we're updating position
        if (!isTestMove) {
          setPosition(currentPosition);
        }
        
        console.log('Updated local match state with new moves');
        
      } catch (updateError) {
        console.error('Error updating match in database:', updateError);
        
        // Add more detailed error logging
        if (updateError && typeof updateError === 'object') {
          console.error('Error details:', JSON.stringify(updateError));
        }
        
        // Save debug info for update error
        await saveDebugInfo('update_error', {
          error: updateError,
          matchId,
          isTestMove,
          updateData
        });
        
        // Show a more helpful error message
        Alert.alert(
          'Error saving move', 
          `The move could not be saved to the database. Error: ${typeof updateError === 'object' && updateError !== null && 'message' in updateError 
            ? (updateError as any).message 
            : 'Unknown error'}. Please try again.`,
          [
            { 
              text: 'Try Again', 
              onPress: async () => {
                // Retry with a simpler update approach
                try {
                  const retryData = {
                    movesPlayed: updatedMoves,
                    ...(isTestMove ? {} : { gamePosition: currentPosition })
                  };
                  console.log('Retrying with simplified data:', retryData);
                  const retryResult = await databases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    COLLECTION_MATCHES,
                    matchId,
                    retryData
                  );
                  console.log('Retry successful:', retryResult);
                  
                  // Update local state
                  setMatch({
                    ...match,
                    movesPlayed: updatedMoves,
                    ...(isTestMove ? {} : { gamePosition: currentPosition })
                  });
                  
                  Alert.alert('Success', 'Move saved on retry');
                } catch (retryError) {
                  console.error('Retry failed:', retryError);
                  Alert.alert('Retry Failed', `Could not save the move: ${typeof retryError === 'object' && retryError !== null && 'message' in retryError 
                    ? (retryError as any).message 
                    : 'Unknown error'}`);
                }
              } 
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
      
    } catch (err) {
      console.error('Error submitting move:', err);
      
      // Save debug info for overall error
      await saveDebugInfo('move_submit_error', {
        error: err,
        matchId,
        move,
        currentPosition
      });
      
      Alert.alert('Error', `Failed to submit move: ${typeof err === 'object' && err !== null && 'message' in err 
        ? (err as any).message 
        : 'Unknown error'}`);
    }
  };
  
  // Handle game end
  const handleGameEnd = async (result: string) => {
    try {
      if (!match || !matchId) return;
      
      let resultString;
      switch (result) {
        case 'w': resultString = '1-0'; break;
        case 'b': resultString = '0-1'; break;
        case 'draw': resultString = '1/2-1/2'; break;
        default: resultString = '1/2-1/2';
      }
      
      // Update match in the database
      await updateMatchData(matchId, {
        result: resultString,
        status: 'completed',
      });
      
      // Update local match data
      setMatch({
        ...match,
        result: resultString,
        status: 'completed',
      });
      
    } catch (err) {
      console.error('Error ending game:', err);
    }
  };
  
  // Add effect for realtime subscription
  useEffect(() => {
    // Set up realtime when match is loaded
    if (match) {
      const unsubscribe = setupRealtime();
      
      // Clean up when component unmounts
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
          console.log('Cleaned up realtime subscription');
        }
      };
    }
  }, [matchId, match]); // Re-subscribe if matchId changes
  
  // Rendering error state
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={THEME.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.centeredContent}>
          <Ionicons name="alert-circle-outline" size={64} color={THEME.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.replace(`/match/${matchId}`)}
          >
            <Text style={styles.retryText}>Return to Match Details</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Main game board display
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={THEME.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        
        {match && (
          <Animatable.View 
            animation="fadeIn" 
            style={styles.matchInfo}
          >
            <Text style={styles.matchTitle}>
              Round {match.round}
            </Text>
          </Animatable.View>
        )}
      </View>
      
      <View style={styles.mainContent}>
        <View style={styles.gameBoardWrapper}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Animatable.Text 
                animation="pulse" 
                iterationCount="infinite" 
                style={styles.loadingText}
              >
                Loading match...
              </Animatable.Text>
            </View>
          ) : (
            <ChessErrorBoundary>
              <GameBoard 
                matchId={matchId as string}
                player1Name={player1?.name || 'Player 1'}
                player2Name={player2?.name || 'Player 2'}
                player1Rating={player1?.rating || 1500}
                player2Rating={player2?.rating || 1500}
                isLiveMatch={true}
                onMoveSubmit={handleMoveSubmit}
                onGameEnd={handleGameEnd}
                initialPosition={position}
                movesPlayed={match?.movesPlayed || []}
                timeControl={{ initial: 600, increment: 5 }}
              />
            </ChessErrorBoundary>
          )}
        </View>

        {/* Add a debug section */}
        {match && __DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>Debug Options</Text>
            <Button
              title="Check Database Data"
              onPress={() => checkDatabaseMatch(matchId)}
              color={THEME.primary}
            />
            <Button
              title="View Debug Logs"
              onPress={() => {
                Alert.alert('Debug Info', 'Match ID: ' + matchId);
                getAllDebugLogs().then(logs => {
                  console.log('All debug logs:', logs);
                });
              }}
              color={THEME.accent}
            />
            <Button
              title="Test Add Move"
              onPress={async () => {
                // Create a test move with a clear TEST_ prefix to differentiate from real moves
                const timestamp = new Date().getTime().toString().slice(-4);
                const testMove = `TEST_e2e4_${timestamp}`;
                
                try {
                  console.log('Adding test move to database:', testMove);
                  
                  // Get existing moves
                  const currentMoves = safelyGetArray(match, 'movesPlayed');
                  
                  // Append test move
                  const updatedMoves = [...currentMoves, testMove];
                  
                  // Only update the movesPlayed array, not the actual game position
                  const updateData = {
                    $append: { movesPlayed: [testMove] },
                    // Don't update game position for test moves
                  };
                  
                  // Update in database 
                  const result = await updateMatchData(matchId, updateData);
                  console.log('Test move saved to database:', result);
                  
                  // Update local match data (but don't affect the chess board)
                  setMatch({
                    ...match,
                    movesPlayed: updatedMoves,
                  });
                  
                  Alert.alert('Test Move Added', `Added test move: ${testMove}`);
                } catch (error) {
                  console.error('Error adding test move:', error);
                  Alert.alert('Error', 'Failed to add test move: ' + JSON.stringify(error));
                }
              }}
            />
            <Button
              title="Direct DB Test"
              onPress={async () => {
                try {
                  console.log('------------------------------');
                  console.log('Testing direct database update');
                  console.log(`MatchID: ${matchId}`);
                  
                  // Create simple test data
                  const testData = {
                    movesPlayed: ['test_move_' + new Date().getTime()],
                    gamePosition: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
                    testTimestamp: new Date().toISOString()
                  };
                  
                  console.log('Test data:', testData);
                  
                  // Call database update directly
                  const result = await updateMatchData(matchId, testData);
                  console.log('Direct DB update result:', result);
                  
                  // Show success alert
                  Alert.alert('Success', 'Direct database update successful!');
                } catch (error) {
                  console.error('Direct DB test failed:', error);
                  Alert.alert('Error', 'Direct database update failed: ' + JSON.stringify(error));
                }
                console.log('------------------------------');
              }}
              color="#FF6B00"
            />
            <View style={styles.debugInfo}>
              <Text>Local Moves: {match.movesPlayed && Array.isArray(match.movesPlayed) ? match.movesPlayed.length : 0}</Text>
              <Text>Is Array: {match.movesPlayed && Array.isArray(match.movesPlayed) ? 'Yes' : 'No'}</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.light,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    zIndex: 10,
    height: 60, // Fixed height for header
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    marginLeft: SPACING.xs,
    color: THEME.primary,
    fontSize: 16,
  },
  matchInfo: {
    alignItems: 'center',
  },
  matchTitle: {
    color: THEME.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center', // Center vertically
    alignItems: 'center',     // Center horizontally
    paddingBottom: SPACING.lg, // Add bottom padding
  },
  gameBoardWrapper: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minHeight: 400, // Minimum height for game board
  },
  gameBoardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    color: THEME.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    color: THEME.danger,
    fontSize: 16,
    marginVertical: SPACING.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: THEME.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  retryText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
  },
  debugSection: {
    padding: SPACING.md,
    margin: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 150,
    width: '90%',
    overflow: 'scroll',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    color: THEME.textPrimary,
  },
  debugInfo: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.sm,
  },
  errorBoundary: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: THEME.lightGray,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 400,
  },
  errorTitle: {
    fontSize: 18,
    color: THEME.danger,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: THEME.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  resetText: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: '600',
  },
} as const); 