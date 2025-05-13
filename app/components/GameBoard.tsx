import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Chessboard, { ChessboardRef } from 'react-native-chessboard';
import { Chess } from 'chess.js';
import { Ionicons } from '@expo/vector-icons';
import { THEME, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@/app/utils/theme';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions } from 'react-native';

// Get screen width to calculate board size
const SCREEN_WIDTH = Dimensions.get('window').width;
const BOARD_SIZE = Math.floor((SCREEN_WIDTH - (SPACING.md * 2)) / 8) * 8;

// Define types
type Square = string;
type Piece = string;

interface GameBoardProps {
  matchId?: string;
  player1Name?: string;
  player2Name?: string;
  player1Rating?: number;
  player2Rating?: number;
  isLiveMatch?: boolean;
  onMoveSubmit?: (move: string, currentPosition: string) => void;
  onGameEnd?: (result: string) => void;
  initialPosition?: string;
  playerSide?: 'w' | 'b';
  timeControl?: {
    initial: number; // in seconds
    increment: number; // in seconds
  };
  movesPlayed?: string[]; // Add movesPlayed as a prop
}

interface ChessMoveInfo {
  move: any;
  state: {
    in_check: boolean;
    in_checkmate: boolean;
    in_draw: boolean;
    in_stalemate: boolean;
    in_threefold_repetition: boolean;
    insufficient_material: boolean;
    game_over: boolean;
    fen: string;
  };
}

// A wrapper component to handle the chessboard rendering
const ChessboardWrapper = ({ 
  game, 
  boardSize, 
  onMove 
}: { 
  game: Chess, 
  boardSize: number, 
  onMove: (moveInfo: ChessMoveInfo) => void 
}) => {
  // Use a local key to force re-renders
  const [key, setKey] = useState(0);
  
  // Update the key when the game changes to force a re-render
  useEffect(() => {
    setKey(prevKey => prevKey + 1);
  }, [game.fen()]);
  
  return (
    <Chessboard
      key={key}
      // Use as any cast to handle typing issues
      fen={game.fen() as any}
      gestureEnabled={true}
      boardSize={boardSize}
      onMove={onMove}
      colors={{
        black: '#B58863',
        white: '#F0D9B5',
        lastMoveHighlight: 'rgba(0, 255, 0, 0.3)',
        checkmateHighlight: 'rgba(255, 0, 0, 0.3)',
      }}
    />
  );
};

const GameBoard = ({
  matchId,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  player1Rating = 1500,
  player2Rating = 1500,
  isLiveMatch = false,
  onMoveSubmit,
  onGameEnd,
  initialPosition,
  playerSide = 'w',
  timeControl = { initial: 600, increment: 5 },
  movesPlayed = [], // Default to empty array
}: GameBoardProps) => {
  // Chess game state
  const [game, setGame] = useState(() => {
    try {
      return new Chess(initialPosition || undefined);
    } catch (error) {
      console.error('Error initializing chess game:', error);
      return new Chess();
    }
  });
  
  // UI state
  const [boardOrientation] = useState<'white' | 'black'>(playerSide === 'w' ? 'white' : 'black');
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState<'active' | 'checkmate' | 'draw' | 'stalemate'>('active');
  const [message, setMessage] = useState<string | null>(null);
  
  // Timer state
  const [player1Time, setPlayer1Time] = useState(timeControl.initial);
  const [player2Time, setPlayer2Time] = useState(timeControl.initial);
  const [activeTimer, setActiveTimer] = useState<'player1' | 'player2' | null>(null);
  
  // Timers
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Effect for timer countdown
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (activeTimer && gameStatus === 'active') {
      console.log(`Active timer: ${activeTimer}, status: ${gameStatus}`);
      timerRef.current = setInterval(() => {
        if (activeTimer === 'player1') {
          setPlayer1Time(prev => {
            if (prev <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              handleTimeOut('player1');
              return 0;
            }
            return prev - 1;
          });
        } else if (activeTimer === 'player2') {
          setPlayer2Time(prev => {
            if (prev <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              handleTimeOut('player2');
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeTimer, gameStatus]);
  
  // Apply saved moves when the game board is first loaded
  useEffect(() => {
    const applySavedMoves = () => {
      if (!movesPlayed || !Array.isArray(movesPlayed) || movesPlayed.length === 0) {
        return;
      }

      console.log(`Applying ${movesPlayed.length} saved moves from database`);
      
      try {
        // Create a new game from initial position
        const chessGame = new Chess();
        
        // Apply all moves
        for (const moveString of movesPlayed) {
          try {
            // Skip test moves that start with TEST_
            if (moveString.startsWith('TEST_')) {
              console.log('Skipping test move:', moveString);
              continue;
            }
            
            // Extract the actual move part (before any timestamp)
            // This handles formats like "e2e4_1234" by taking only "e2e4"
            const actualMove = moveString.split('_')[0];
            
            // Check if it's a valid move format (like e2e4, Nf3, etc.)
            if (actualMove && actualMove.length >= 2) {
              const result = chessGame.move(actualMove);
              console.log('Applied move:', actualMove, result ? '✓' : '✗');
            } else {
              console.error('Invalid move format:', moveString);
            }
          } catch (moveError) {
            console.error('Error applying move:', moveString, moveError);
          }
        }
        
        // Update the game state
        setGame(chessGame);
        
        // Update game status (checkmate, etc.)
        updateGameStatus(chessGame);
        
        // Set the active timer based on whose turn it is
        if (chessGame.turn() === 'w') {
          setActiveTimer('player1');
          console.log("Game loaded from saved position. White to move.");
        } else {
          setActiveTimer('player2');
          console.log("Game loaded from saved position. Black to move.");
        }
      } catch (err) {
        console.error('Error applying saved moves:', err);
      }
    };
    
    // Apply moves on initial load or when moves change
    applySavedMoves();
    
  }, [movesPlayed]);
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Handle timeout
  const handleTimeOut = (player: 'player1' | 'player2') => {
    setActiveTimer(null);
    setGameStatus('checkmate');
    const winner = player === 'player1' ? player2Name : player1Name;
    setMessage(`${winner} wins on time!`);
    if (onGameEnd) {
      onGameEnd(player === 'player1' ? 'b' : 'w');
    }
  };
  
  // Update game status
  const updateGameStatus = (currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      setGameStatus('checkmate');
      const winner = currentGame.turn() === 'w' ? player2Name : player1Name;
      setMessage(`Checkmate! ${winner} wins!`);
      if (onGameEnd) {
        onGameEnd(currentGame.turn() === 'w' ? 'b' : 'w');
      }
    } else if (currentGame.isDraw()) {
      setGameStatus('draw');
      setMessage('Game ended in a draw!');
      if (onGameEnd) {
        onGameEnd('draw');
      }
    } else if (currentGame.isStalemate()) {
      setGameStatus('stalemate');
      setMessage('Stalemate! Game ended in a draw.');
      if (onGameEnd) {
        onGameEnd('draw');
      }
    }
  };
  
  // Reset game
  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setMoveFrom(null);
    setGameStatus('active');
    setMessage(null);
    setPlayer1Time(timeControl.initial);
    setPlayer2Time(timeControl.initial);
    setActiveTimer('player1');
  };
  
  // Flip board orientation
  const flipBoard = () => {
    // Since we can't directly flip the board via the API,
    // in a real implementation we would track board orientation in state
    // and re-create the component with a different orientation
    console.log('Flip board not implemented in this version');
  };
  
  // Get move options
  const getMoveOptions = (square: string) => {
    try {
      const moves = game.moves({
        square,
        verbose: true
      });
      
      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }
      
      const newSquares: Record<string, any> = {};
      moves.forEach((move: any) => {
        newSquares[move.to] = {
          backgroundColor: 'rgba(0, 128, 0, 0.4)',
          borderRadius: 12,
          width: 24,
          height: 24,
        };
      });
      
      newSquares[square] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
      };
      
      setOptionSquares(newSquares);
      return true;
    } catch (error) {
      console.error('Error getting move options:', error);
      setOptionSquares({});
      return false;
    }
  };
  
  // Handle move from chessboard component
  const handleMove = (moveInfo: ChessMoveInfo) => {
    console.log('Move made:', moveInfo.move);
    
    // Check if the move was valid and state has changed
    if (moveInfo.state && moveInfo.move) {
      try {
        // Get new position after move
        const newPosition = moveInfo.state.fen;
        console.log('New board position:', newPosition);
        
        // Create a new chess game with the updated position
        const updatedGame = new Chess(newPosition);
        setGame(updatedGame);
        
        // Update timers - add increment for the player who just moved
        const currentTurn = updatedGame.turn(); // This is now the next player's turn
        if (currentTurn === 'b') { // White just moved
          setPlayer1Time(prevTime => prevTime + timeControl.increment);
          setActiveTimer('player2');
        } else { // Black just moved
          setPlayer2Time(prevTime => prevTime + timeControl.increment);
          setActiveTimer('player1');
        }
        
        // Check game status
        updateGameStatus(updatedGame);
        
        // Submit move to the database if callback provided
        if (onMoveSubmit) {
          // Use standard algebraic notation (SAN) for the move
          const moveString = moveInfo.move.san;
          console.log('Submitting move to database:', moveString, 'New position:', newPosition);
          onMoveSubmit(moveString, newPosition);
        }
      } catch (error) {
        console.error('Error handling chess move:', error);
        Alert.alert('Chess Error', 'There was an error processing your move. Please try again.');
      }
    } else {
      console.warn('Invalid move or missing move state');
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Player 2 info (top) */}
      <LinearGradient
        colors={[THEME.primaryDark, THEME.primary]}
        style={styles.playerInfo}
      >
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{player2Name}</Text>
          <Text style={styles.playerRating}>{player2Rating}</Text>
        </View>
        <View style={styles.timerContainer}>
          <Text style={[
            styles.timer, 
            activeTimer === 'player2' && styles.activeTimer,
            player2Time < 30 && styles.lowTime
          ]}>
            {formatTime(player2Time)}
          </Text>
        </View>
      </LinearGradient>
      
      {/* Chessboard */}
      <View style={styles.boardContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        )}
        
        {/* Use our custom wrapper component */}
        <ChessboardWrapper
          game={game}
          boardSize={BOARD_SIZE}
          onMove={handleMove}
        />
      </View>
      
      {/* Player 1 info (bottom) */}
      <LinearGradient
        colors={[THEME.primary, THEME.primaryLight]}
        style={styles.playerInfo}
      >
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{player1Name}</Text>
          <Text style={styles.playerRating}>{player1Rating}</Text>
        </View>
        <View style={styles.timerContainer}>
          <Text style={[
            styles.timer, 
            activeTimer === 'player1' && styles.activeTimer,
            player1Time < 30 && styles.lowTime
          ]}>
            {formatTime(player1Time)}
          </Text>
        </View>
      </LinearGradient>
      
      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={resetGame}
        >
          <Ionicons name="refresh" size={24} color={THEME.white} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={flipBoard}
        >
          <Ionicons name="swap-vertical" size={24} color={THEME.white} />
        </TouchableOpacity>
      </View>
      
      {/* Game status message */}
      {message && (
        <Animatable.View 
          animation="fadeIn" 
          style={styles.messageContainer}
        >
          <Text style={styles.message}>{message}</Text>
        </Animatable.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.light,
    padding: SPACING.md,
    width: '100%',
    maxHeight: 600,
  },
  boardContainer: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    position: 'relative',
    ...SHADOWS.medium,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginVertical: SPACING.md,
  },
  playerInfo: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
    marginVertical: SPACING.xs,
  },
  playerDetails: {
    flexDirection: 'column',
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.white,
  },
  playerRating: {
    fontSize: 14,
    color: THEME.white,
    opacity: 0.8,
  },
  timerContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  timer: {
    fontSize: 18,
    fontWeight: '500',
    color: THEME.white,
  },
  activeTimer: {
    fontWeight: '700',
  },
  lowTime: {
    color: '#FF3B30',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  controlButton: {
    backgroundColor: THEME.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
    ...SHADOWS.small,
  },
  messageContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    top: '50%',
    left: SPACING.md,
    right: SPACING.md,
    transform: [{ translateY: -25 }],
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.white,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.7)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }
});

export default GameBoard; 