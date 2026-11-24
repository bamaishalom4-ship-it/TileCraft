import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS, PALETTE } from '../theme/tokens';

interface TileCraftWordmarkProps {
  maxWidth?: number;
}

/**
 * Native fallback for the 16-bit TILECRAFT wordmark using Silkscreen Bold
 * with Arcade Orange fill, Cream highlight trim, and hard Ink offset shadow.
 */
export const TileCraftWordmark: React.FC<TileCraftWordmarkProps> = ({
  maxWidth = 390,
}) => {
  return (
    <View
      testID="tilecraft-wordmark"
      accessibilityRole="header"
      accessibilityLabel="TileCraft"
      style={[styles.wrap, { maxWidth }]}
    >
      {/* Hard offset ink shadow */}
      <Text
        style={[styles.baseText, styles.shadowText]}
        numberOfLines={1}
        adjustsFontSizeToFit
        importantForAccessibility="no"
      >
        TILECRAFT
      </Text>
      {/* Cream outer highlight */}
      <Text
        style={[styles.baseText, styles.creamText]}
        numberOfLines={1}
        adjustsFontSizeToFit
        importantForAccessibility="no"
      >
        TILECRAFT
      </Text>
      {/* Primary arcade orange fill */}
      <Text
        style={[styles.baseText, styles.orangeText]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        TILECRAFT
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  baseText: {
    fontFamily: FONTS.display,
    fontSize: 34,
    letterSpacing: -1,
    textAlign: 'center',
  },
  shadowText: {
    position: 'absolute',
    color: PALETTE.ink,
    transform: [{ translateX: 3 }, { translateY: 4 }],
  },
  creamText: {
    position: 'absolute',
    color: PALETTE.cream,
    transform: [{ translateX: -1 }, { translateY: -1 }],
  },
  orangeText: {
    color: PALETTE.arcadeOrange,
    textShadowColor: PALETTE.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
});
