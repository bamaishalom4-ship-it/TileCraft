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
import {
  deleteCraftedPuzzle,
  loadCraftedPuzzleById,
  loadCraftedPuzzles,
  saveCraftedPuzzle,
} from '../services/craftedPuzzleDb';
import {
  clearActiveGame,
  loadActiveGame,
  loadCompletedRunIds,
  loadOnboardingFlags,
  markRunCompleted,
  saveOnboardingFlags,
  type SavedActiveGame,
} from '../services/activeGameStorage';
import { resolveIdempotentWinCoins } from '../utils/activeGameUtils';

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
    description:
      'Unlock 24-tile master boards for both classic and custom photo puzzles.',
    coinCost: 150,
  },
  {
    id: 'frame_pack',
    title: 'Retro Arcade Frames',
    description:
      'Unlock Crimson, Sunburst, and Cobalt molded vintage puzzle trays.',
    coinCost: 100,
  },
];

interface AppStoreState {
  currentScreen: ScreenName;
  activePuzzleTitle: string;
  isCustomPuzzle: boolean;

  // Hydration & Synced Wallet State
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

  // Durable Crafted Puzzles & Active Game Save
  customPuzzles: CustomPuzzleItem[];
  storageWarning: string | null;
  savedActiveGame: SavedActiveGame | null;
  completedRunIds: string[];

  // First-Time Onboarding
  hasCompletedFirstNumberedGame: boolean;
  freeIntroHintUsed: boolean;

  // Flow Payloads
  pendingCropAsset: PickedImageAsset | null;
  lastWinSummary: WinSummary | null;

  // Navigation & Lifecycle
  navigate: (screen: ScreenName) => void;
  openCropperWithAsset: (asset: PickedImageAsset) => void;
  setActivePuzzleMeta: (title: string, isCustom: boolean) => void;

  // Durable Crafted Puzzles & Active Game Helpers
  saveAndAddCraftedPuzzle: (input: {
    title: string;
    sourceImageUri: string;
    preferredGridSize: GridSize;
  }) => Promise<{ ok: boolean; item?: CustomPuzzleItem; error?: string }>;
  removeCraftedPuzzle: (id: string) => Promise<void>;
  refreshSavedActiveGame: () => Promise<SavedActiveGame | null>;
  clearSavedActiveGame: () => Promise<void>;
  resolveImageForSavedGame: (saved: SavedActiveGame) => Promise<string | null>;

  // Onboarding
  consumeFreeIntroHint: () => Promise<void>;
  markFirstNumberedGameCompleted: () => Promise<void>;

  // Economy Actions
  hydrateApp: () => Promise<void>;
  recordWin: (summary: WinSummary & { runId: string }) => Promise<void>;
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
  activePuzzleTitle: 'Classic 4×4',
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
  storageWarning: null,
  savedActiveGame: null,
  completedRunIds: [],

  hasCompletedFirstNumberedGame: false,
  freeIntroHintUsed: false,

  pendingCropAsset: null,
  lastWinSummary: null,

  navigate: (currentScreen) => {
    set({ currentScreen });
    if (currentScreen === 'menu') {
      loadActiveGame()
        .then((saved) => set({ savedActiveGame: saved }))
        .catch(() => {});
    }
  },

  openCropperWithAsset: (asset) =>
    set({
      pendingCropAsset: asset,
      currentScreen: 'cropper',
    }),

  setActivePuzzleMeta: (activePuzzleTitle, isCustomPuzzle) =>
    set({ activePuzzleTitle, isCustomPuzzle }),

  saveAndAddCraftedPuzzle: async ({ title, sourceImageUri, preferredGridSize }) => {
    const id = `crafted_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();

    const res = await saveCraftedPuzzle({
      id,
      title,
      sourceImageUri,
      preferredGridSize,
      createdAt,
      isLocalUpload: true,
    });

    if (!res.ok || !res.item) {
      return {
        ok: false,
        error:
          res.error ??
          'Could not save your photo puzzle to device storage. Please check available browser storage.',
      };
    }

    set((state) => ({
      customPuzzles: [res.item!, ...state.customPuzzles],
      pendingCropAsset: null,
      storageWarning: null,
    }));

    return { ok: true, item: res.item };
  },

  removeCraftedPuzzle: async (id) => {
    await deleteCraftedPuzzle(id);
    set((state) => ({
      customPuzzles: state.customPuzzles.filter((p) => p.id !== id),
    }));
  },

  refreshSavedActiveGame: async () => {
    const saved = await loadActiveGame();
    set({ savedActiveGame: saved });
    return saved;
  },

  clearSavedActiveGame: async () => {
    await clearActiveGame();
    set({ savedActiveGame: null });
  },

  resolveImageForSavedGame: async (saved) => {
    if (saved.mode === 'classic') return null;
    if (saved.mode === 'marketplace') return saved.remoteImageUrl;
    if (saved.craftedPuzzleId) {
      const inMem = get().customPuzzles.find(
        (p) => p.id === saved.craftedPuzzleId
      );
      if (inMem) return inMem.imageUri;
      const fromDb = await loadCraftedPuzzleById(saved.craftedPuzzleId);
      if (fromDb) {
        set((state) => ({
          customPuzzles: [
            fromDb,
            ...state.customPuzzles.filter((p) => p.id !== fromDb.id),
          ],
        }));
        return fromDb.imageUri;
      }
    }
    return null;
  },

  consumeFreeIntroHint: async () => {
    const nextFlags = {
      hasCompletedFirstNumberedGame: get().hasCompletedFirstNumberedGame,
      freeIntroHintUsed: true,
    };
    set({ freeIntroHintUsed: true });
    await saveOnboardingFlags(nextFlags);
  },

  markFirstNumberedGameCompleted: async () => {
    if (get().hasCompletedFirstNumberedGame) return;
    const nextFlags = {
      hasCompletedFirstNumberedGame: true,
      freeIntroHintUsed: get().freeIntroHintUsed,
    };
    set({ hasCompletedFirstNumberedGame: true });
    await saveOnboardingFlags(nextFlags);
  },

  hydrateApp: async () => {
    const [economyRes, craftedRes, savedGame, completedRuns, onboarding] =
      await Promise.all([
        hydrateAndSyncEconomy(),
        loadCraftedPuzzles(),
        loadActiveGame(),
        loadCompletedRunIds(),
        loadOnboardingFlags(),
      ]);

    set({
      economyHydrated: true,
      syncedWithCloud: economyRes.syncedWithCloud,
      coins: economyRes.wallet.coins,
      unlockedGridSizes: economyRes.wallet.unlockedGridSizes,
      unlockedAllFrames: economyRes.wallet.unlockedAllFrames,
      dailyStreak: economyRes.wallet.dailyStreak,
      lastDailyClaimDate: economyRes.wallet.lastDailyClaimDate,
      rewardedAdsWatchedToday: economyRes.wallet.rewardedAdsWatchedToday,
      rewardedAdsDate: economyRes.wallet.rewardedAdsDate,
      transactions: economyRes.transactions,
      customPuzzles: craftedRes.items,
      storageWarning: craftedRes.ok ? null : (craftedRes.error ?? null),
      savedActiveGame: savedGame,
      completedRunIds: completedRuns,
      hasCompletedFirstNumberedGame: onboarding.hasCompletedFirstNumberedGame,
      freeIntroHintUsed: onboarding.freeIntroHintUsed,
    });
  },

  recordWin: async (summary) => {
    const state = get();
    await clearActiveGame();

    // Idempotency guard: never award completion coins twice for the same runId
    const { coinsToGrant, alreadyRewarded, updatedCompletedRunIds } =
      resolveIdempotentWinCoins(
        summary.runId,
        state.completedRunIds,
        summary.coinsEarned
      );

    if (!alreadyRewarded) {
      await markRunCompleted(summary.runId);
    }

    if (!summary.isCustomPuzzle) {
      await get().markFirstNumberedGameCompleted();
    }

    const snapshot = toWalletSnapshot(get());

    set({
      savedActiveGame: null,
      completedRunIds: updatedCompletedRunIds,
      lastWinSummary: {
        ...summary,
        coinsEarned: coinsToGrant,
      },
      coins: state.coins + coinsToGrant,
      currentScreen: 'win',
    });

    if (!alreadyRewarded && coinsToGrant > 0) {
      try {
        const { wallet, tx } = await creditPuzzleWinSynced(
          snapshot,
          summary.gridSize,
          summary.stars,
          coinsToGrant,
          summary.runId
        );
        set((s) => ({
          coins: wallet.coins,
          transactions: [tx, ...s.transactions].slice(0, 30),
        }));
      } catch {
        // Optimistic local state already saved
      }
    }
  },

  spendHintCoins: async () => {
    if (!get().economyHydrated) return false;
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
    if (!state.economyHydrated || state.coins < amount) return false;
    const nextCoins = state.coins - amount;
    set({ coins: nextCoins });
    saveLocalWallet({ ...toWalletSnapshot(state), coins: nextCoins }).catch(() => {});
    return true;
  },

  setCoinsFromServer: (balance) => {
    if (!get().economyHydrated) return;
    const safeBalance = Math.max(0, Math.floor(balance));
    const state = get();
    set({ coins: safeBalance });
    saveLocalWallet({ ...toWalletSnapshot(state), coins: safeBalance }).catch(() => {});
  },

  claimDailyReward: async () => {
    if (!get().economyHydrated) {
      return { ok: false, coinsAwarded: 0, error: 'Loading wallet...' };
    }
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
    if (!get().economyHydrated) {
      return { ok: false, coinsAwarded: 0, error: 'Loading wallet...' };
    }
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
    if (!get().economyHydrated) return { ok: false, error: 'Loading wallet...' };
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
    if (!get().economyHydrated) {
      return { ok: false, coinsAwarded: 0, error: 'Loading wallet...' };
    }
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
