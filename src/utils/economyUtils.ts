import type { CoinTxType, DailyStreakStatus } from '../types/economy';

/**
 * 7-day escalating daily login reward table (matches Supabase RPC `claim_daily_login_reward`).
 */
export const DAILY_REWARD_SCHEDULE = [40, 50, 65, 80, 100, 125, 200] as const;

export const REWARDED_AD_COINS = 35;
export const MAX_REWARDED_ADS_PER_DAY = 10;

/**
 * Formats a Date into a canonical UTC calendar date string (YYYY-MM-DD).
 */
export function getUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Computes the UTC calendar date string for yesterday relative to `now`.
 */
export function getYesterdayUtcDateKey(now: Date = new Date()): string {
  const prev = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getUtcDateKey(prev);
}

/**
 * Evaluates whether the player can claim their daily login reward today,
 * what day in the 7-day cycle they will advance to, and how many coins they'll earn.
 */
export function evaluateDailyStreak(
  lastClaimDate: string | null,
  storedStreak: number,
  now: Date = new Date()
): DailyStreakStatus {
  const today = getUtcDateKey(now);
  const yesterday = getYesterdayUtcDateKey(now);
  const safeStreak = Math.max(0, Math.min(7, storedStreak));

  if (lastClaimDate === today) {
    const nextDay = (safeStreak % 7) + 1;
    return {
      canClaimToday: false,
      currentStreak: safeStreak || 1,
      nextClaimDay: nextDay,
      nextRewardCoins: DAILY_REWARD_SCHEDULE[nextDay - 1],
    };
  }

  // Continue streak if claimed yesterday; otherwise reset to Day 1
  const nextClaimDay =
    lastClaimDate === yesterday ? (safeStreak % 7) + 1 : 1;

  return {
    canClaimToday: true,
    currentStreak: lastClaimDate === yesterday ? safeStreak : 0,
    nextClaimDay,
    nextRewardCoins: DAILY_REWARD_SCHEDULE[nextClaimDay - 1],
  };
}

/**
 * Human-readable label for transaction history rows in the Wallet & Shop UI.
 */
export function formatTxLabel(txType: CoinTxType): string {
  switch (txType) {
    case 'daily_reward':
      return 'Daily Login Streak';
    case 'rewarded_ad':
      return 'Rewarded Video Ad';
    case 'puzzle_win':
      return 'Puzzle Completion';
    case 'hint':
      return 'A* Hint Used';
    case 'upgrade_unlock':
      return 'Shop Upgrade Unlock';
    case 'iap_pack':
      return 'Coin Pack Purchase';
    case 'marketplace_buy':
      return 'Marketplace Download';
    case 'creator_royalty':
      return 'Creator Royalty Earned';
  }
}
