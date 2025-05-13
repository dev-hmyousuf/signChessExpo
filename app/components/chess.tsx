import React from 'react';
import { View, StyleSheet } from 'react-native';
import GameBoard from './GameBoard';

const ChessScreen = () => {
  return (
    <View style={styles.container}>
      <GameBoard 
        player1Name="You"
        player2Name="Computer"
        isLiveMatch={false}
        timeControl={{ initial: 600, increment: 5 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ChessScreen;
