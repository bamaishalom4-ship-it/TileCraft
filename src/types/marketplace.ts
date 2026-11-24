import type { GridSize } from './puzzle';

export type PuzzleCategory =
  | 'Art'
  | 'Nature'
  | 'Pets'
  | 'Retro'
  | 'Travel'
  | 'Abstract'
  | 'Other';

export const PUZZLE_CATEGORIES: PuzzleCategory[] = [
  'Art',
  'Nature',
  'Pets',
  'Retro',
  'Travel',
  'Abstract',
  'Other',
];

export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

export type FlagReason = 'nsfw' | 'violence' | 'hate' | 'copyright' | 'spam';

export type MarketplaceSort = 'trending' | 'newest' | 'lowest-price';

export interface MarketplacePuzzle {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  category: PuzzleCategory;
  imageUrl: string;
  storagePath: string;
  recommendedGridSize: GridSize;
  coinPrice: number;
  downloadCount: number;
  flagCount: number;
  moderationStatus: ModerationStatus;
  createdAt: string;
  /** True when the current player owns or authored this puzzle. */
  isOwned?: boolean;
}

export interface PublishPuzzlePayload {
  localImageUri: string;
  title: string;
  category: PuzzleCategory;
  recommendedGridSize: GridSize;
  coinPrice: number;
}

export interface PublishPuzzleResult {
  ok: boolean;
  puzzle?: MarketplacePuzzle;
  moderationStatus?: ModerationStatus;
  message: string;
}

export interface DownloadPuzzleResult {
  ok: boolean;
  alreadyOwned?: boolean;
  coinsCharged?: number;
  newBalance?: number;
  error?: string;
}

export interface FlagPuzzleResult {
  ok: boolean;
  quarantined?: boolean;
  message: string;
}
