import type { GridSize } from './puzzle';

export type CoinTxType =
  | 'daily_reward'
  | 'rewarded_ad'
  | 'puzzle_win'
  | 'hint'
  | 'upgrade_unlock'
  | 'iap_pack'
  | 'marketplace_buy'
  | 'creator_royalty';

export interface CoinTransaction {
  id: string;
  delta: number;
  balanceAfter: number;
  txType: CoinTxType;
  referenceId: string | null;
  createdAt: string;
  synced: boolean;
}

export interface LocalWalletSnapshot {
  coins: number;
  unlockedGridSizes: GridSize[];
  unlockedAllFrames: boolean;
  dailyStreak: number;
  lastDailyClaimDate: string | null; // YYYY-MM-DD (UTC)
  rewardedAdsWatchedToday: number;
  rewardedAdsDate: string | null; // YYYY-MM-DD (UTC)
  updatedAt: string;
}

export interface DailyStreakStatus {
  canClaimToday: boolean;
  currentStreak: number;
  nextClaimDay: number; // 1..7
  nextRewardCoins: number;
}
