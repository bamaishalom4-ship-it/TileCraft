import type {
  MarketplacePuzzle,
  MarketplaceSort,
  PuzzleCategory,
} from '../types/marketplace';

export const AUTO_QUARANTINE_FLAG_THRESHOLD = 3;

const CLIENT_BLOCKED_TERMS = [
  'nsfw',
  'nude',
  'naked',
  'porn',
  'xxx',
  'hentai',
  'gore',
  'explicit',
];

/**
 * Fast client-side title safety check executed before uploading bytes to Storage
 * (mirrored server-side inside the `moderate-puzzle` Supabase Edge Function).
 */
export function validatePuzzleTitleSafety(title: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = title.trim();
  if (trimmed.length < 2) {
    return { valid: false, reason: 'Title must be at least 2 characters.' };
  }
  if (trimmed.length > 40) {
    return { valid: false, reason: 'Title must be 40 characters or fewer.' };
  }

  const lower = trimmed.toLowerCase();
  for (const term of CLIENT_BLOCKED_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(lower)) {
      return {
        valid: false,
        reason: 'Title violates TileCraft SFW community guidelines.',
      };
    }
  }

  return { valid: true };
}

/**
 * Calculates the creator royalty credited when another player unlocks a paid UGC puzzle.
 * Matches the PostgreSQL RPC `purchase_marketplace_puzzle`: 20% rounded up, min 5 coins.
 */
export function calculateCreatorRoyalty(coinPrice: number): number {
  if (coinPrice <= 0) return 0;
  return Math.max(5, Math.ceil(coinPrice * 0.2));
}

/**
 * Returns true if a puzzle has reached the community flag threshold for auto-quarantine.
 */
export function shouldAutoQuarantine(flagCount: number): boolean {
  return flagCount >= AUTO_QUARANTINE_FLAG_THRESHOLD;
}

/**
 * Filters approved puzzles by category and search query, then sorts for the Marketplace feed.
 */
export function filterAndSortMarketplace(
  puzzles: MarketplacePuzzle[],
  options: {
    category: PuzzleCategory | 'All';
    searchQuery: string;
    sort: MarketplaceSort;
  }
): MarketplacePuzzle[] {
  const q = options.searchQuery.trim().toLowerCase();

  const filtered = puzzles.filter((p) => {
    if (p.moderationStatus !== 'approved') return false;
    if (options.category !== 'All' && p.category !== options.category) return false;
    if (q.length > 0) {
      const hay = `${p.title} ${p.authorName} ${p.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (options.sort === 'trending') {
      return b.downloadCount - a.downloadCount;
    }
    if (options.sort === 'lowest-price') {
      return a.coinPrice - b.coinPrice || b.downloadCount - a.downloadCount;
    }
    // newest
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
