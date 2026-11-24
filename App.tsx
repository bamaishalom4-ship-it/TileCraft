import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from './src/store/useAppStore';
import { usePuzzleStore } from './src/store/usePuzzleStore';
import { MainMenuScreen } from './src/screens/MainMenuScreen';
import { GameScreen } from './src/screens/GameScreen';
import { WinScreen } from './src/screens/WinScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { ImageCropperScreen } from './src/screens/ImageCropperScreen';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { AppDialogHost } from './src/components/AppDialogHost';
import { registerPwa } from './src/utils/pwa';
import { COLORS } from './src/theme/tokens';

function TileCraftRoot() {
  const currentScreen = useAppStore((s) => s.currentScreen);
  const hydrateApp = useAppStore((s) => s.hydrateApp);
  const activeImageUri = usePuzzleStore((s) => s.imageUri);

  useFonts({
    SilkscreenBold: require('./assets/fonts/Silkscreen-Bold.ttf'),
    PixelOperatorBold: require('./assets/fonts/PixelOperator-Bold.ttf'),
  });

  useEffect(() => {
    registerPwa();
    hydrateApp();
  }, [hydrateApp]);

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
      case 'marketplace':
        return <MarketplaceScreen />;
      default:
        return <MainMenuScreen />;
    }
  };

  // Screen-scoped atmosphere matching the 5 arcade references
  const screenBg =
    currentScreen === 'game'
      ? activeImageUri
        ? COLORS.photoBg
        : COLORS.classicBg
      : currentScreen === 'cropper'
      ? COLORS.photoBg
      : COLORS.nightBg;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]}>
      <StatusBar style="light" />
      {renderScreen()}
      <AppDialogHost />
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
