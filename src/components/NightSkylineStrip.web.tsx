import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PALETTE } from '../theme/tokens';

/**
 * Compact original night-city skyline accent inspired by the night bus stop palette:
 * deep navy sky, muted purple towers, and warm amber lit windows.
 */
export const NightSkylineStrip: React.FC = () => {
  return (
    <View
      style={styles.strip}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <svg
        viewBox="0 0 360 48"
        preserveAspectRatio="xMidYMax slice"
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <rect x="0" y="0" width="360" height="48" fill="#161820" />
        <rect x="0" y="22" width="360" height="26" fill="#1D2134" />

        {/* Quiet pixel stars */}
        <rect x="18" y="6" width="2" height="2" fill="#FFF0D0" />
        <rect x="64" y="4" width="2" height="2" fill="#F3B78E" />
        <rect x="128" y="7" width="2" height="2" fill="#FFF0D0" />
        <rect x="206" y="5" width="2" height="2" fill="#FFBE55" />
        <rect x="278" y="6" width="2" height="2" fill="#FFF0D0" />
        <rect x="334" y="4" width="2" height="2" fill="#F3B78E" />

        {/* Night skyline towers in muted purple & deep navy */}
        <rect x="6" y="18" width="34" height="30" fill="#2A263D" />
        <rect x="46" y="24" width="28" height="24" fill="#372F4D" />
        <rect x="80" y="14" width="36" height="34" fill="#242942" />
        <rect x="122" y="22" width="30" height="26" fill="#433652" />
        <rect x="158" y="16" width="40" height="32" fill="#2B2740" />
        <rect x="204" y="20" width="32" height="28" fill="#3A314F" />
        <rect x="242" y="14" width="36" height="34" fill="#252A44" />
        <rect x="284" y="22" width="32" height="26" fill="#3C324F" />
        <rect x="322" y="18" width="34" height="30" fill="#29263D" />

        {/* Warm amber window lights */}
        <rect x="14" y="24" width="4" height="3" fill="#FFBE55" />
        <rect x="24" y="24" width="4" height="3" fill="#FFF0D0" />
        <rect x="14" y="32" width="4" height="3" fill="#FF8A16" />
        <rect x="54" y="30" width="4" height="3" fill="#FFBE55" />
        <rect x="88" y="20" width="4" height="3" fill="#FFF0D0" />
        <rect x="100" y="26" width="4" height="3" fill="#FFBE55" />
        <rect x="88" y="34" width="4" height="3" fill="#FFBE55" />
        <rect x="132" y="28" width="4" height="3" fill="#FFF0D0" />
        <rect x="168" y="22" width="4" height="3" fill="#FFBE55" />
        <rect x="180" y="30" width="4" height="3" fill="#FF8A16" />
        <rect x="214" y="26" width="4" height="3" fill="#FFF0D0" />
        <rect x="222" y="34" width="4" height="3" fill="#FFBE55" />
        <rect x="252" y="20" width="4" height="3" fill="#FFBE55" />
        <rect x="262" y="28" width="4" height="3" fill="#FFF0D0" />
        <rect x="294" y="28" width="4" height="3" fill="#FFBE55" />
        <rect x="332" y="24" width="4" height="3" fill="#FFF0D0" />
        <rect x="342" y="32" width="4" height="3" fill="#FF8A16" />

        {/* Subtle horizon line */}
        <rect x="0" y="46" width="360" height="2" fill="#725C76" />
      </svg>
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    width: '100%',
    height: 48,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.ink,
  },
});
