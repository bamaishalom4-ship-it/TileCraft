import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PALETTE } from '../theme/tokens';

/**
 * Native fallback for the compact night-city skyline strip.
 */
export const NightSkylineStrip: React.FC = () => {
  return (
    <View
      style={styles.strip}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.tower, { height: 28, backgroundColor: '#2A263D' }]}>
        <View style={styles.windowDot} />
      </View>
      <View style={[styles.tower, { height: 34, backgroundColor: '#242942' }]}>
        <View style={styles.windowDot} />
      </View>
      <View style={[styles.tower, { height: 24, backgroundColor: '#433652' }]}>
        <View style={styles.windowDot} />
      </View>
      <View style={[styles.tower, { height: 30, backgroundColor: '#3A314F' }]}>
        <View style={styles.windowDot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    width: '100%',
    height: 44,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.nightNavy,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    borderBottomColor: PALETTE.dustyMauve,
  },
  tower: {
    width: '20%',
    alignItems: 'center',
    paddingTop: 6,
  },
  windowDot: {
    width: 6,
    height: 4,
    backgroundColor: PALETTE.amberWindow,
  },
});
