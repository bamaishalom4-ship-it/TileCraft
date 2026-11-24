import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoinTransaction, LocalWalletSnapshot } from '../types/economy';

const WEB_WALLET_KEY = 'tilecraft_wallet_v1';
const WEB_LEDGER_KEY = 'tilecraft_ledger_v1';

export const DEFAULT_WALLET_SNAPSHOT: LocalWalletSnapshot = {
  coins: 200,
  unlockedGridSizes: [3, 4],
  unlockedAllFrames: false,
  dailyStreak: 0,
  lastDailyClaimDate: null,
  rewardedAdsWatchedToday: 0,
  rewardedAdsDate: null,
  updatedAt: new Date(0).toISOString(),
};

/**
 * Web local wallet implementation backed by AsyncStorage (localStorage),
 * avoiding expo-sqlite native/WASM overhead in browser previews.
 */
export async function loadLocalWallet(): Promise<LocalWalletSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(WEB_WALLET_KEY);
    if (!raw) return { ...DEFAULT_WALLET_SNAPSHOT };
    return {
      ...DEFAULT_WALLET_SNAPSHOT,
      ...(JSON.parse(raw) as Partial<LocalWalletSnapshot>),
    };
  } catch {
    return { ...DEFAULT_WALLET_SNAPSHOT };
  }
}

export async function saveLocalWallet(
  snapshot: LocalWalletSnapshot
): Promise<void> {
  try {
    await AsyncStorage.setItem(WEB_WALLET_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal storage error
  }
}

export async function loadLocalTransactions(
  limit = 30
): Promise<CoinTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(WEB_LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CoinTransaction[];
    return parsed.slice(0, limit);
  } catch {
    return [];
  }
}

export async function appendLocalTransaction(
  tx: CoinTransaction
): Promise<void> {
  try {
    const existing = await loadLocalTransactions(50);
    const updated = [
      tx,
      ...existing.filter((item) => item.id !== tx.id),
    ].slice(0, 50);
    await AsyncStorage.setItem(WEB_LEDGER_KEY, JSON.stringify(updated));
  } catch {
    // Non-fatal storage error
  }
}
