import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GameHudBottom, GameHudTop } from './src/components/GameHud';
import { PuzzleBoard } from './src/components/PuzzleBoard';
import { usePuzzleTimer } from './src/hooks/usePuzzleTimer';
import { COLORS } from './src/theme/tokens';

function GameScreenPhase1() {
  usePuzzleTimer();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <GameHudTop />
        <PuzzleBoard />
        <GameHudBottom />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameScreenPhase1 />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
});
