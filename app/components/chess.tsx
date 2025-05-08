import React, { useState } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import Chessboard from 'react-native-chessboard';
import { Chess } from 'chess.js';

const ChessScreen = () => {
  const [game, setGame] = useState(new Chess());
  const [moveFrom, setMoveFrom] = useState('');
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<{ [key: string]: object }>({});

  const getMoveOptions = (square: string) => {
    const moves = game.ugly_moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }
    const newSquares: { [key: string]: object } = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background: game.get(move.to)?.color !== game.get(square)?.color
          ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };
    setOptionSquares(newSquares);
    return true;
  };

  const onSquareClick = (square: string) => {
    if (!moveFrom) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }

    if (!moveTo) {
      const moves = game.ugly_moves({ moveFrom, verbose: true });
      const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);
      if (!foundMove) {
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) setMoveFrom(square);
        return;
      }

      setMoveTo(square);
      const gameCopy = { ...game };
      gameCopy.ugly_move({ from: moveFrom, to: square, promotion: 'q' });
      setGame(gameCopy);
      setMoveFrom('');
      setMoveTo(null);
      setOptionSquares({});
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setMoveFrom('');
    setMoveTo(null);
    setOptionSquares({});
  };

  return (
    <View style={styles.container}>
      <Chessboard
        position={game.fen()}
        onSquareClick={onSquareClick}
        customSquareStyles={optionSquares}
      />
      <Button title="Reset Game" onPress={resetGame} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChessScreen;
