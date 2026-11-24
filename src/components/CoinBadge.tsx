import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

interface CoinBadgeProps {
  coins: number;
  loading?: boolean;
  onPress?: () => void;
  showPlus?: boolean;
}

/**
 * Reusable header Coin pill displaying the player's coin balance
 * in chunky 16-bit arcade styling.
 */
export const CoinBadge: React.FC<CoinBadgeProps> = ({
  coins,
  loading = false,
  onPress,
  showPlus = true,
}) => {
  const displayValue = loading ? '…' : coins.toLocaleString();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={
        loading
          ? 'Loading coin balance'
          : onPress
          ? `${coins} coins. Open Shop`
          : `${coins} coins`
      }
      style={({ pressed }) => [
        styles.pill,
        pressed && onPress && styles.pillPressed,
      ]}
    >
      <View
        style={styles.coinIcon}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text style={styles.coinSymbol}>¢</Text>
      </View>
      <Text style={styles.coinCount}>{displayValue}</Text>
      {showPlus && onPress ? (
        <View
          style={styles.plusWrap}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Ionicons name="add" size={14} color={PALETTE.ink} />
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.nightSurface,
    borderRadius: 8,
    paddingLeft: 5,
    paddingRight: 7,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  coinIcon: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinSymbol: {
    color: PALETTE.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  coinCount: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    minWidth: 26,
    textAlign: 'center',
  },
  plusWrap: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: PALETTE.amberWindow,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 1,
  },
});
