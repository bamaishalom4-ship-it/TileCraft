import type { GridSize } from './puzzle';

export type ScreenName = 'menu' | 'game' | 'win' | 'shop' | 'cropper';

export interface CustomPuzzleItem {
  id: string;
  title: string;
  imageUri: string;
  preferredGridSize: GridSize;
  createdAt: string;
  /** True when created locally on device (eligible to publish in Phase 3). */
  isLocalUpload: boolean;
}

export interface PickedImageAsset {
  uri: string;
  width: number;
  height: number;
}

export interface WinSummary {
  puzzleTitle: string;
  gridSize: GridSize;
  moves: number;
  elapsedSeconds: number;
  stars: 1 | 2 | 3;
  coinsEarned: number;
  imageUri: string | null;
  isCustomPuzzle: boolean;
}

export interface CoinPack {
  id: string;
  sku: string;
  title: string;
  coins: number;
  bonusCoins: number;
  priceDisplay: string;
  badge?: string;
}

export interface ShopUpgrade {
  id: 'unlock_5x5' | 'frame_pack';
  title: string;
  description: string;
  coinCost: number;
}
