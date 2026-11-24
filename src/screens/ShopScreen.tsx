import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { showAppDialog } from '../store/useDialogStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  evaluateDailyStreak,
  formatTxLabel,
  getUtcDateKey,
  MAX_REWARDED_ADS_PER_DAY,
  REWARDED_AD_COINS,
} from '../utils/economyUtils';
import { restoreStorePurchases } from '../services/iapService';
import { CoinBadge } from '../components/CoinBadge';
import { DailyRewardModal } from '../components/DailyRewardModal';
import { MadeByKuboFooter } from '../components/MadeByKuboFooter';
import { COLORS } from '../theme/tokens';

/**
 * TileCraft Shop & Wallet Screen with cross-platform accessible dialogs,
 * offline awareness for network features, and local+cloud coin ledger.
 */
export const ShopScreen: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [busyUpgradeId, setBusyUpgradeId] = useState<string | null>(null);

  const economyHydrated = useAppStore((s) => s.economyHydrated);
  const coins = useAppStore((s) => s.coins);
  const syncedWithCloud = useAppStore((s) => s.syncedWithCloud);
  const dailyStreak = useAppStore((s) => s.dailyStreak);
  const lastDailyClaimDate = useAppStore((s) => s.lastDailyClaimDate);
  const rewardedAdsWatchedToday = useAppStore((s) => s.rewardedAdsWatchedToday);
  const rewardedAdsDate = useAppStore((s) => s.rewardedAdsDate);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const unlockedAllFrames = useAppStore((s) => s.unlockedAllFrames);
  const transactions = useAppStore((s) => s.transactions);

  const navigate = useAppStore((s) => s.navigate);
  const watchRewardedAd = useAppStore((s) => s.watchRewardedAd);
  const buyUpgrade = useAppStore((s) => s.buyUpgrade);
  const buyCoinPack = useAppStore((s) => s.buyCoinPack);

  const streak = evaluateDailyStreak(lastDailyClaimDate, dailyStreak);
  const todayKey = getUtcDateKey();
  const adsToday = rewardedAdsDate === todayKey ? rewardedAdsWatchedToday : 0;
  const adsRemaining = Math.max(0, MAX_REWARDED_ADS_PER_DAY - adsToday);

  const handleWatchAd = async () => {
    if (!isOnline) {
      showAppDialog({
        title: 'Offline',
        message:
          'Rewarded video ads require an internet connection. Your local Classic and Photo puzzles still play offline!',
      });
      return;
    }

    if (watchingAd) return;
    setWatchingAd(true);
    try {
      const res = await watchRewardedAd();
      if (res.ok) {
        showAppDialog({
          title: 'Reward Earned!',
          message: `+${res.coinsAwarded} coins credited to your wallet${
            res.adMode === 'expo-preview' ? ' (Preview Mode)' : ''
          }.`,
        });
      } else {
        showAppDialog({
          title: 'Ad Unavailable',
          message: res.error ?? 'Could not complete rewarded ad.',
        });
      }
    } finally {
      setWatchingAd(false);
    }
  };

  const handleBuyUpgrade = async (
    id: 'unlock_5x5' | 'frame_pack',
    title: string,
    cost: number
  ) => {
    if (busyUpgradeId) return;
    setBusyUpgradeId(id);
    try {
      const res = await buyUpgrade(id);
      if (res.ok) {
        showAppDialog({
          title: 'Unlocked!',
          message: `${title} is now active across TileCraft.`,
        });
      } else {
        showAppDialog({
          title: 'Unable to Unlock',
          message:
            res.error === 'Not enough coins'
              ? `You need ${cost} coins to unlock ${title}.`
              : res.error ?? 'Could not unlock upgrade.',
        });
      }
    } finally {
      setBusyUpgradeId(null);
    }
  };

  const handleBuyPack = async (pack: (typeof COIN_PACKS)[number]) => {
    if (!isOnline) {
      showAppDialog({
        title: 'Offline',
        message: 'Connect to the internet to purchase coin packs.',
      });
      return;
    }
    if (busyPackId) return;
    setBusyPackId(pack.id);
    try {
      const res = await buyCoinPack(pack);
      if (res.cancelled) return;
      if (res.ok) {
        showAppDialog({
          title: 'Purchase Complete!',
          message: `+${res.coinsAwarded.toLocaleString()} coins added to your wallet${
            res.mode === 'sandbox-simulator' ? ' (Preview Simulator)' : ''
          }.`,
        });
      } else {
        showAppDialog({
          title: 'Purchase Failed',
          message: res.error ?? 'Unable to complete purchase.',
        });
      }
    } finally {
      setBusyPackId(null);
    }
  };

  const handleRestore = async () => {
    const res = await restoreStorePurchases();
    showAppDialog({
      title: res.ok ? 'Restore Complete' : 'Restore Failed',
      message: res.message,
    });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigate('menu')}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Coin Shop
          </Text>
          <Text style={styles.syncTag}>
            {!isOnline
              ? '○ Offline · Local Wallet'
              : syncedWithCloud
              ? '● Cloud & Local Synced'
              : '● Local Device Wallet'}
          </Text>
        </View>
        <CoinBadge coins={coins} loading={!economyHydrated} showPlus={false} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>EARN FREE COINS</Text>
        <View style={styles.earnRow}>
          <Pressable
            onPress={() => setDailyModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Daily Streak rewards"
            style={({ pressed }) => [
              styles.earnCard,
              streak.canClaimToday && styles.earnCardHighlight,
              pressed && styles.pressed,
            ]}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons
                name={streak.canClaimToday ? 'flame' : 'checkmark-circle'}
                size={24}
                color={streak.canClaimToday ? COLORS.gold : COLORS.success}
              />
            </View>
            <Text style={styles.earnTitle}>Daily Streak</Text>
            <Text style={styles.earnSub}>
              {streak.canClaimToday
                ? `Day ${streak.nextClaimDay}: +${streak.nextRewardCoins} ¢`
                : `Day ${streak.currentStreak} Claimed`}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleWatchAd}
            disabled={watchingAd || adsRemaining === 0}
            accessibilityRole="button"
            accessibilityLabel={`Watch rewarded ad for ${REWARDED_AD_COINS} coins. ${adsRemaining} remaining today`}
            style={({ pressed }) => [
              styles.earnCard,
              (adsRemaining === 0 || !isOnline) && styles.disabledCard,
              pressed && styles.pressed,
            ]}
          >
            {watchingAd ? (
              <ActivityIndicator color="#38BDF8" size="small" />
            ) : (
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons name="play-circle" size={24} color="#38BDF8" />
              </View>
            )}
            <Text style={styles.earnTitle}>
              {watchingAd ? 'Loading Ad...' : 'Watch Ad'}
            </Text>
            <Text style={styles.earnSub}>
              {!isOnline
                ? 'Requires internet'
                : `+${REWARDED_AD_COINS} ¢ · ${adsRemaining}/${MAX_REWARDED_ADS_PER_DAY} left`}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>UNLOCKS & UPGRADES</Text>
        <View style={styles.stack}>
          {SHOP_UPGRADES.map((upgrade) => {
            const owned =
              (upgrade.id === 'unlock_5x5' && unlockedGridSizes.includes(5)) ||
              (upgrade.id === 'frame_pack' && unlockedAllFrames);
            const isBusy = busyUpgradeId === upgrade.id;
            return (
              <View key={upgrade.id} style={styles.upgradeCard}>
                <View style={styles.upgradeText}>
                  <Text style={styles.upgradeTitle}>{upgrade.title}</Text>
                  <Text style={styles.upgradeDesc}>{upgrade.description}</Text>
                </View>
                <Pressable
                  disabled={owned || isBusy}
                  onPress={() =>
                    handleBuyUpgrade(upgrade.id, upgrade.title, upgrade.coinCost)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    owned
                      ? `${upgrade.title}, owned`
                      : `Unlock ${upgrade.title} for ${upgrade.coinCost} coins`
                  }
                  accessibilityState={{ disabled: owned || isBusy }}
                  style={[styles.upgradeBtn, owned && styles.upgradeBtnOwned]}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#111827" size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.upgradeBtnText,
                        owned && styles.upgradeBtnTextOwned,
                      ]}
                    >
                      {owned ? 'Owned' : `${upgrade.coinCost} ¢`}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>COIN PACKS</Text>
          <Pressable
            onPress={handleRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore previous purchases"
          >
            <Text style={styles.restoreLink}>Restore Purchases</Text>
          </Pressable>
        </View>

        <View style={styles.stack}>
          {COIN_PACKS.map((pack) => {
            const isBusy = busyPackId === pack.id;
            return (
              <Pressable
                key={pack.id}
                disabled={isBusy}
                onPress={() => handleBuyPack(pack)}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${pack.title}, ${pack.coins + pack.bonusCoins} coins for ${pack.priceDisplay}`}
                style={({ pressed }) => [
                  styles.packCard,
                  pack.badge && styles.packCardFeatured,
                  !isOnline && styles.disabledCard,
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
                  {isBusy ? (
                    <ActivityIndicator color={COLORS.gold} size="small" />
                  ) : (
                    <Text style={styles.priceText}>{pack.priceDisplay}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {transactions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>RECENT WALLET ACTIVITY</Text>
            <View style={styles.ledgerCard}>
              {transactions.slice(0, 8).map((tx, idx) => (
                <View
                  key={tx.id}
                  style={[styles.ledgerRow, idx > 0 && styles.ledgerRowBorder]}
                >
                  <View>
                    <Text style={styles.ledgerLabel}>
                      {formatTxLabel(tx.txType)}
                    </Text>
                    <Text style={styles.ledgerMeta}>
                      Bal: {tx.balanceAfter.toLocaleString()} ¢ ·{' '}
                      {tx.synced ? 'Synced' : 'Local'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.ledgerDelta,
                      tx.delta > 0 ? styles.deltaPositive : styles.deltaNegative,
                    ]}
                  >
                    {tx.delta > 0 ? `+${tx.delta}` : tx.delta} ¢
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <MadeByKuboFooter variant="full" />
      </ScrollView>

      <DailyRewardModal
        visible={dailyModalOpen}
        onClose={() => setDailyModalOpen(false)}
      />
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  syncTag: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 6,
  },
  restoreLink: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
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
  earnCardHighlight: {
    borderColor: 'rgba(245, 158, 11, 0.55)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  disabledCard: {
    opacity: 0.55,
  },
  earnTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  earnSub: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
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
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
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
    minWidth: 68,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  priceText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  ledgerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  ledgerRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ledgerLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  ledgerMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  ledgerDelta: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  deltaPositive: {
    color: COLORS.success,
  },
  deltaNegative: {
    color: '#F87171',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
