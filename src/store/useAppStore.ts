import { create } from 'zustand';
import type {
  CoinPack,
  CustomPuzzleItem,
  PickedImageAsset,
  ScreenName,
  ShopUpgrade,
  WinSummary,
} from '../types/app';
import type { GridSize } from '../types/puzzle';

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
  /** Local preview balance (synced to SQLite + Supabase ledger in Phase 4). */
  coins: number;
  unlockedGridSizes: GridSize[];
  unlockedAllFrames: boolean;
  dailyClaimedToday: boolean;
  customPuzzles: CustomPuzzleItem[];
  pendingCropAsset: PickedImageAsset | null;
  lastWinSummary: WinSummary | null;

  // Navigation
  navigate: (screen: ScreenName) => void;
  openCropperWithAsset: (asset: PickedImageAsset) => void;
  setActivePuzzleMeta: (title: string, isCustom: boolean) => void;

  // Custom Puzzles
  addCustomPuzzle: (item: CustomPuzzleItem) => void;

  // Win & Local Economy Preview (upgraded to server-verified RPCs in Phase 4)
  recordWin: (summary: WinSummary) => void;
  spendCoins: (amount: number) => boolean;
  grantCoins: (amount: number) => void;
  setCoinsFromServer: (balance: number) => void;
  claimDailyRewardPreview: () => boolean;
  purchaseUpgrade: (upgradeId: ShopUpgrade['id']) => boolean;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  currentScreen: 'menu',
  activePuzzleTitle: 'Classic 15-Puzzle',
  isCustomPuzzle: false,
  coins: 200, // Starter welcome coins
  unlockedGridSizes: [3, 4],
  unlockedAllFrames: false,
  dailyClaimedToday: false,
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

  recordWin: (summary) =>
    set((state) => ({
      lastWinSummary: summary,
      coins: state.coins + summary.coinsEarned,
      currentScreen: 'win',
    })),

  spendCoins: (amount) => {
    const { coins } = get();
    if (coins < amount) return false;
    set({ coins: coins - amount });
    return true;
  },

  grantCoins: (amount) =>
    set((state) => ({ coins: state.coins + amount })),

  setCoinsFromServer: (balance) =>
    set({ coins: Math.max(0, Math.floor(balance)) }),

  claimDailyRewardPreview: () => {
    const { dailyClaimedToday } = get();
    if (dailyClaimedToday) return false;
    set((state) => ({
      dailyClaimedToday: true,
      coins: state.coins + 50,
    }));
    return true;
  },

  purchaseUpgrade: (upgradeId) => {
    const upgrade = SHOP_UPGRADES.find((u) => u.id === upgradeId);
    if (!upgrade) return false;

    const state = get();
    if (upgradeId === 'unlock_5x5' && state.unlockedGridSizes.includes(5)) {
      return false;
    }
    if (upgradeId === 'frame_pack' && state.unlockedAllFrames) {
      return false;
    }
    if (state.coins < upgrade.coinCost) {
      return false;
    }

    set({
      coins: state.coins - upgrade.coinCost,
      unlockedGridSizes:
        upgradeId === 'unlock_5x5'
          ? [...state.unlockedGridSizes, 5]
          : state.unlockedGridSizes,
      unlockedAllFrames:
        upgradeId === 'frame_pack' ? true : state.unlockedAllFrames,
    });
    return true;
  },
}));
