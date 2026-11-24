import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/tokens';

interface CoinBadgeProps {
  coins: number;
  loading?: boolean;
  onPress?: () => void;
  showPlus?: boolean;
}

/**
 * Reusable header Coin pill displaying the player's coin balance.
 * Shows a subtle placeholder while wallet hydration is in progress so defaults never flash.
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
          <Ionicons name="add" size={14} color="#111827" />
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 5,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  pillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  coinIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinSymbol: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  coinCount: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'center',
  },
  plusWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
