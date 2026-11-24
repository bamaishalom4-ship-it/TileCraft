import { create } from 'zustand';
import type {
  CoinPack,
  CustomPuzzleItem,
  PickedImageAsset,
  ScreenName,
  ShopUpgrade,
  WinSummary,
} from '../types/app';
import type { CoinTransaction, LocalWalletSnapshot } from '../types/economy';
import type { GridSize } from '../types/puzzle';
import {
  buyCoinPackSynced,
  claimDailyLoginReward,
  creditPuzzleWinSynced,
  hydrateAndSyncEconomy,
  spendCoinsForHint,
  unlockUpgradeSynced,
  watchRewardedAdForCoins,
} from '../services/economyService';
import { saveLocalWallet } from '../services/localWalletDb';

export const HINT_COIN_COST = 25;

export const COIN_PACKS: CoinPack[] = [
  {
    id: 'pack_starter',
    sku: 'com.tilecraft.coins.250',
    title: 'Starter Pouch',
    coins: 250,
    bonusCoins: 0,
    priceDisplay: '$0.99',
  },
  {
    id: 'pack_vault',
    sku: 'com.tilecraft.coins.800',
    title: 'Crafter Vault',
    coins: 800,
    bonusCoins: 150,
    priceDisplay: '$2.99',
    badge: 'POPULAR',
  },
  {
    id: 'pack_chest',
    sku: 'com.tilecraft.coins.2500',
    title: 'Master Chest',
    coins: 2500,
    bonusCoins: 600,
    priceDisplay: '$6.99',
    badge: 'BEST VALUE',
  },
];

export const SHOP_UPGRADES: ShopUpgrade[] = [
  {
    id: 'unlock_5x5',
    title: '5×5 Master Grid',
    description: 'Unlock 24-tile master boards for both classic and custom photo puzzles.',
    coinCost: 150,
  },
  {
    id: 'frame_pack',
    title: 'Retro Arcade Frames',
    description: 'Unlock Crimson, Sunburst, and Cobalt molded vintage puzzle trays.',
    coinCost: 100,
  },
];

interface AppStoreState {
  currentScreen: ScreenName;
  activePuzzleTitle: string;
  isCustomPuzzle: boolean;

  // Economy & Synced Wallet State (SQLite + Supabase)
  economyHydrated: boolean;
  syncedWithCloud: boolean;
  coins: number;
  unlockedGridSizes: GridSize[];
  unlockedAllFrames: boolean;
  dailyStreak: number;
  lastDailyClaimDate: string | null;
  rewardedAdsWatchedToday: number;
  rewardedAdsDate: string | null;
  transactions: CoinTransaction[];

  // Local Custom Library & Flow Payloads
  customPuzzles: CustomPuzzleItem[];
  pendingCropAsset: PickedImageAsset | null;
  lastWinSummary: WinSummary | null;

  // Navigation
  navigate: (screen: ScreenName) => void;
  openCropperWithAsset: (asset: PickedImageAsset) => void;
  setActivePuzzleMeta: (title: string, isCustom: boolean) => void;
  addCustomPuzzle: (item: CustomPuzzleItem) => void;

  // Economy Actions (Local SQLite + Supabase RPC Synced)
  hydrateEconomy: () => Promise<void>;
  recordWin: (summary: WinSummary) => void;
  spendHintCoins: () => Promise<boolean>;
  spendCoins: (amount: number) => boolean;
  setCoinsFromServer: (balance: number) => void;
  claimDailyReward: () => Promise<{ ok: boolean; coinsAwarded: number; error?: string }>;
  watchRewardedAd: () => Promise<{
    ok: boolean;
    coinsAwarded: number;
    adMode?: 'admob-native' | 'expo-preview';
    error?: string;
  }>;
  buyUpgrade: (upgradeId: ShopUpgrade['id']) => Promise<{ ok: boolean; error?: string }>;
  buyCoinPack: (pack: CoinPack) => Promise<{
    ok: boolean;
    coinsAwarded: number;
    mode?: 'revenuecat-native' | 'sandbox-simulator';
    cancelled?: boolean;
    error?: string;
  }>;
}

function toWalletSnapshot(s: AppStoreState): LocalWalletSnapshot {
  return {
    coins: s.coins,
    unlockedGridSizes: s.unlockedGridSizes,
    unlockedAllFrames: s.unlockedAllFrames,
    dailyStreak: s.dailyStreak,
    lastDailyClaimDate: s.lastDailyClaimDate,
    rewardedAdsWatchedToday: s.rewardedAdsWatchedToday,
    rewardedAdsDate: s.rewardedAdsDate,
    updatedAt: new Date().toISOString(),
  };
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  currentScreen: 'menu',
  activePuzzleTitle: 'Classic 15-Puzzle',
  isCustomPuzzle: false,

  economyHydrated: false,
  syncedWithCloud: false,
  coins: 200,
  unlockedGridSizes: [3, 4],
  unlockedAllFrames: false,
  dailyStreak: 0,
  lastDailyClaimDate: null,
  rewardedAdsWatchedToday: 0,
  rewardedAdsDate: null,
  transactions: [],

  customPuzzles: [],
  pendingCropAsset: null,
  lastWinSummary: null,

  navigate: (currentScreen) => set({ currentScreen }),

  openCropperWithAsset: (asset) =>
    set({
      pendingCropAsset: asset,
      currentScreen: 'cropper',
    }),

  setActivePuzzleMeta: (activePuzzleTitle, isCustomPuzzle) =>
    set({ activePuzzleTitle, isCustomPuzzle }),

  addCustomPuzzle: (item) =>
    set((state) => ({
      customPuzzles: [item, ...state.customPuzzles],
      pendingCropAsset: null,
    })),

  hydrateEconomy: async () => {
    const res = await hydrateAndSyncEconomy();
    set({
      economyHydrated: true,
      syncedWithCloud: res.syncedWithCloud,
      coins: res.wallet.coins,
      unlockedGridSizes: res.wallet.unlockedGridSizes,
      unlockedAllFrames: res.wallet.unlockedAllFrames,
      dailyStreak: res.wallet.dailyStreak,
      lastDailyClaimDate: res.wallet.lastDailyClaimDate,
      rewardedAdsWatchedToday: res.wallet.rewardedAdsWatchedToday,
      rewardedAdsDate: res.wallet.rewardedAdsDate,
      transactions: res.transactions,
    });
  },

  recordWin: (summary) => {
    const snapshot = toWalletSnapshot(get());
    // Optimistically navigate to Win Screen immediately for snappy feel
    set((state) => ({
      lastWinSummary: summary,
      coins: state.coins + summary.coinsEarned,
      currentScreen: 'win',
    }));

    // Persist to SQLite & reconcile with Supabase win reward RPC in background
    creditPuzzleWinSynced(
      snapshot,
      summary.gridSize,
      summary.stars,
      summary.coinsEarned
    )
      .then(({ wallet, tx }) => {
        set((state) => ({
          coins: wallet.coins,
          transactions: [tx, ...state.transactions].slice(0, 30),
        }));
      })
      .catch(() => {});
  },

  spendHintCoins: async () => {
    const snapshot = toWalletSnapshot(get());
    const res = await spendCoinsForHint(snapshot, HINT_COIN_COST);
    if (!res.ok) return false;

    set((state) => ({
      coins: res.wallet.coins,
      transactions: res.tx
        ? [res.tx, ...state.transactions].slice(0, 30)
        : state.transactions,
    }));
    return true;
  },

  spendCoins: (amount) => {
    const state = get();
    if (state.coins < amount) return false;
    const nextCoins = state.coins - amount;
    set({ coins: nextCoins });
    saveLocalWallet({ ...toWalletSnapshot(state), coins: nextCoins }).catch(() => {});
    return true;
  },

  setCoinsFromServer: (balance) => {
    const safeBalance = Math.max(0, Math.floor(balance));
    const state = get();
    set({ coins: safeBalance });
    saveLocalWallet({ ...toWalletSnapshot(state), coins: safeBalance }).catch(() => {});
  },

  claimDailyReward: async () => {
    const res = await claimDailyLoginReward(toWalletSnapshot(get()));
    set((state) => ({
      coins: res.wallet.coins,
      dailyStreak: res.wallet.dailyStreak,
      lastDailyClaimDate: res.wallet.lastDailyClaimDate,
      transactions: res.tx
        ? [res.tx, ...state.transactions].slice(0, 30)
        : state.transactions,
    }));
    return { ok: res.ok, coinsAwarded: res.coinsAwarded, error: res.error };
  },

  watchRewardedAd: async () => {
    const res = await watchRewardedAdForCoins(toWalletSnapshot(get()));
    if (res.ok) {
      set((state) => ({
        coins: res.wallet.coins,
        rewardedAdsWatchedToday: res.wallet.rewardedAdsWatchedToday,
        rewardedAdsDate: res.wallet.rewardedAdsDate,
        transactions: res.tx
          ? [res.tx, ...state.transactions].slice(0, 30)
          : state.transactions,
      }));
    }
    return {
      ok: res.ok,
      coinsAwarded: res.coinsAwarded,
      adMode: res.adMode,
      error: res.error,
    };
  },

  buyUpgrade: async (upgradeId) => {
    const upgrade = SHOP_UPGRADES.find((u) => u.id === upgradeId);
    if (!upgrade) return { ok: false, error: 'Unknown upgrade' };

    const res = await unlockUpgradeSynced(toWalletSnapshot(get()), upgrade);
    if (res.ok) {
      set((state) => ({
        coins: res.wallet.coins,
        unlockedGridSizes: res.wallet.unlockedGridSizes,
        unlockedAllFrames: res.wallet.unlockedAllFrames,
        transactions: res.tx
          ? [res.tx, ...state.transactions].slice(0, 30)
          : state.transactions,
      }));
    }
    return { ok: res.ok, error: res.error };
  },

  buyCoinPack: async (pack) => {
    const res = await buyCoinPackSynced(toWalletSnapshot(get()), pack);
    if (res.ok) {
      set((state) => ({
        coins: res.wallet.coins,
        transactions: res.tx
          ? [res.tx, ...state.transactions].slice(0, 30)
          : state.transactions,
      }));
    }
    return {
      ok: res.ok,
      coinsAwarded: res.coinsAwarded,
      mode: res.mode,
      cancelled: res.cancelled,
      error: res.error,
    };
  },
}));
