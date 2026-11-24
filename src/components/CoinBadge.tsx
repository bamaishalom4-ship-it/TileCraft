import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/tokens';

interface CoinBadgeProps {
  coins: number;
  onPress?: () => void;
  showPlus?: boolean;
}

/**
 * Reusable header Coin pill displaying the player's current coin balance.
 * Tapping opens the Shop screen.
 */
export const CoinBadge: React.FC<CoinBadgeProps> = ({
  coins,
  onPress,
  showPlus = true,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${coins} coins`}
      style={({ pressed }) => [
        styles.pill,
        pressed && onPress && styles.pillPressed,
      ]}
    >
      <View style={styles.coinIcon}>
        <Text style={styles.coinSymbol}>¢</Text>
      </View>
      <Text style={styles.coinCount}>{coins.toLocaleString()}</Text>
      {showPlus && onPress ? (
        <View style={styles.plusWrap}>
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
