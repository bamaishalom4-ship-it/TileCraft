import React from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from './src/store/useAppStore';
import { MainMenuScreen } from './src/screens/MainMenuScreen';
import { GameScreen } from './src/screens/GameScreen';
import { WinScreen } from './src/screens/WinScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { ImageCropperScreen } from './src/screens/ImageCropperScreen';
import { COLORS } from './src/theme/tokens';

function TileCraftRoot() {
  const currentScreen = useAppStore((s) => s.currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'menu':
        return <MainMenuScreen />;
      case 'game':
        return <GameScreen />;
      case 'win':
        return <WinScreen />;
      case 'shop':
        return <ShopScreen />;
      case 'cropper':
        return <ImageCropperScreen />;
      default:
        return <MainMenuScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {renderScreen()}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TileCraftRoot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
