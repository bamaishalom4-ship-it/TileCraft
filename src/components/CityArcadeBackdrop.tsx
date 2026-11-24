import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PALETTE } from '../theme/tokens';

/**
 * Native fallback for the 16-bit city arcade backdrop using layered geometric bands.
 */
export const CityArcadeBackdrop: React.FC = () => {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={styles.skyTop} />
      <View style={styles.skyMid} />
      <View style={styles.horizon} />
      <View style={styles.skylineRow}>
        <View style={[styles.building, { height: 54, backgroundColor: '#234857' }]} />
        <View style={[styles.building, { height: 74, backgroundColor: '#2A3E52' }]} />
        <View style={[styles.building, { height: 60, backgroundColor: '#3B344D' }]} />
        <View style={[styles.building, { height: 48, backgroundColor: '#B74A3C' }]} />
      </View>
      <View style={styles.street} />
    </View>
  );
};

const styles = StyleSheet.create({
  skyTop: {
    flex: 2,
    backgroundColor: PALETTE.cityTealDark,
  },
  skyMid: {
    flex: 1.4,
    backgroundColor: PALETTE.cityTeal,
  },
  horizon: {
    height: 18,
    backgroundColor: PALETTE.sunsetPeach,
  },
  skylineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  building: {
    width: '22%',
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  street: {
    height: 18,
    backgroundColor: '#232638',
    borderTopWidth: 2,
    borderTopColor: PALETTE.dustyCream,
  },
});
