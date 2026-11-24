import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COIN_PACKS,
  SHOP_UPGRADES,
  useAppStore,
} from '../store/useAppStore';
import { CoinBadge } from '../components/CoinBadge';
import { COLORS } from '../theme/tokens';

/**
 * TileCraft Shop Screen (Phase 2 UI + local unlock preview;
 * Phase 4 connects real AdMob rewarded video ads, RevenueCat IAP, and Supabase ledger).
 */
export const ShopScreen: React.FC = () => {
  const coins = useAppStore((s) => s.coins);
  const dailyClaimedToday = useAppStore((s) => s.dailyClaimedToday);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const unlockedAllFrames = useAppStore((s) => s.unlockedAllFrames);
  const navigate = useAppStore((s) => s.navigate);
  const claimDailyRewardPreview = useAppStore((s) => s.claimDailyRewardPreview);
  const grantCoins = useAppStore((s) => s.grantCoins);
  const purchaseUpgrade = useAppStore((s) => s.purchaseUpgrade);

  const handleDailyReward = () => {
    const claimed = claimDailyRewardPreview();
    if (claimed) {
      Alert.alert('Daily Reward Claimed!', '+50 coins added to your wallet.');
    }
  };

  const handleRewardedAdPreview = () => {
    Alert.alert(
      'Rewarded Ad (Preview)',
      'Phase 4 integrates Google AdMob rewarded video ads. Granting +30 preview coins now!',
      [{ text: 'Collect +30 ¢', onPress: () => grantCoins(30) }]
    );
  };

  const handleBuyPack = (title: string, totalCoins: number, price: string) => {
    Alert.alert(
      `Purchase ${title} (${price})`,
      `Phase 4 hooks this SKU to App Store / Google Play IAP. Add ${totalCoins.toLocaleString()} preview coins now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Simulate IAP', onPress: () => grantCoins(totalCoins) },
      ]
    );
  };

  const handleBuyUpgrade = (id: 'unlock_5x5' | 'frame_pack', title: string, cost: number) => {
    const ok = purchaseUpgrade(id);
    if (ok) {
      Alert.alert('Unlocked!', `${title} is now active across TileCraft.`);
    } else {
      Alert.alert(
        'Not Enough Coins',
        `You need ${cost} coins to unlock ${title}. Claim your daily reward or grab a coin pack!`
      );
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigate('menu')} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>TileCraft Shop</Text>
        <CoinBadge coins={coins} showPlus={false} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Free Coins Section */}
        <Text style={styles.sectionTitle}>EARN FREE COINS</Text>
        <View style={styles.earnRow}>
          <Pressable
            onPress={handleDailyReward}
            disabled={dailyClaimedToday}
            style={({ pressed }) => [
              styles.earnCard,
              dailyClaimedToday && styles.earnCardClaimed,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={dailyClaimedToday ? 'checkmark-circle' : 'calendar'}
              size={24}
              color={dailyClaimedToday ? COLORS.success : COLORS.gold}
            />
            <Text style={styles.earnTitle}>Daily Login</Text>
            <Text style={styles.earnSub}>
              {dailyClaimedToday ? 'Claimed Today' : '+50 Coins'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRewardedAdPreview}
            style={({ pressed }) => [styles.earnCard, pressed && styles.pressed]}
          >
            <Ionicons name="play-circle" size={24} color="#38BDF8" />
            <Text style={styles.earnTitle}>Watch Ad</Text>
            <Text style={styles.earnSub}>+30 Coins</Text>
          </Pressable>
        </View>

        {/* Unlocks & Upgrades */}
        <Text style={styles.sectionTitle}>UNLOCKS & UPGRADES</Text>
        <View style={styles.stack}>
          {SHOP_UPGRADES.map((upgrade) => {
            const owned =
              (upgrade.id === 'unlock_5x5' && unlockedGridSizes.includes(5)) ||
              (upgrade.id === 'frame_pack' && unlockedAllFrames);
            return (
              <View key={upgrade.id} style={styles.upgradeCard}>
                <View style={styles.upgradeText}>
                  <Text style={styles.upgradeTitle}>{upgrade.title}</Text>
                  <Text style={styles.upgradeDesc}>{upgrade.description}</Text>
                </View>
                <Pressable
                  disabled={owned}
                  onPress={() =>
                    handleBuyUpgrade(upgrade.id, upgrade.title, upgrade.coinCost)
                  }
                  style={[
                    styles.upgradeBtn,
                    owned && styles.upgradeBtnOwned,
                  ]}
                >
                  <Text
                    style={[
                      styles.upgradeBtnText,
                      owned && styles.upgradeBtnTextOwned,
                    ]}
                  >
                    {owned ? 'Owned' : `${upgrade.coinCost} ¢`}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Coin Packs (IAP) */}
        <Text style={styles.sectionTitle}>COIN PACKS</Text>
        <View style={styles.stack}>
          {COIN_PACKS.map((pack) => {
            const total = pack.coins + pack.bonusCoins;
            return (
              <Pressable
                key={pack.id}
                onPress={() =>
                  handleBuyPack(pack.title, total, pack.priceDisplay)
                }
                style={({ pressed }) => [
                  styles.packCard,
                  pack.badge && styles.packCardFeatured,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.packLeft}>
                  <View style={styles.packTitleRow}>
                    <Text style={styles.packTitle}>{pack.title}</Text>
                    {pack.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pack.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.packCoins}>
                    {pack.coins.toLocaleString()} coins
                    {pack.bonusCoins > 0
                      ? `  +${pack.bonusCoins.toLocaleString()} bonus`
                      : ''}
                  </Text>
                </View>

                <View style={styles.pricePill}>
                  <Text style={styles.priceText}>{pack.priceDisplay}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 14,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 6,
  },
  earnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  earnCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  earnCardClaimed: {
    opacity: 0.65,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  earnTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  earnSub: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  stack: {
    gap: 10,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  upgradeText: {
    flex: 1,
    gap: 3,
  },
  upgradeTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  upgradeDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  upgradeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
  },
  upgradeBtnOwned: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  upgradeBtnText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  upgradeBtnTextOwned: {
    color: '#6EE7B7',
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  packCardFeatured: {
    borderColor: 'rgba(245, 158, 11, 0.55)',
  },
  packLeft: {
    gap: 4,
  },
  packTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#111827',
    fontSize: 9,
    fontWeight: '900',
  },
  packCoins: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pricePill: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
