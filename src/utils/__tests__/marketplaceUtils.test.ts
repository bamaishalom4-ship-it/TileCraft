import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCreatorRoyalty,
  filterAndSortMarketplace,
  shouldAutoQuarantine,
  validatePuzzleTitleSafety,
} from '../marketplaceUtils';
import type { MarketplacePuzzle } from '../../types/marketplace';

const SAMPLE_PUZZLES: MarketplacePuzzle[] = [
  {
    id: '1',
    authorId: 'a1',
    authorName: 'Alice',
    title: 'Sunset Harbor',
    category: 'Nature',
    imageUrl: 'https://example.com/1.jpg',
    storagePath: 'a1/1.jpg',
    recommendedGridSize: 4,
    coinPrice: 25,
    downloadCount: 100,
    flagCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-11-20T00:00:00Z',
  },
  {
    id: '2',
    authorId: 'a2',
    authorName: 'Bob',
    title: 'Retro Arcade',
    category: 'Retro',
    imageUrl: 'https://example.com/2.jpg',
    storagePath: 'a2/2.jpg',
    recommendedGridSize: 3,
    coinPrice: 0,
    downloadCount: 250,
    flagCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-11-22T00:00:00Z',
  },
  {
    id: '3',
    authorId: 'a3',
    authorName: 'Charlie',
    title: 'Quarantined Item',
    category: 'Art',
    imageUrl: 'https://example.com/3.jpg',
    storagePath: 'a3/3.jpg',
    recommendedGridSize: 4,
    coinPrice: 15,
    downloadCount: 999,
    flagCount: 3,
    moderationStatus: 'flagged',
    createdAt: '2026-11-23T00:00:00Z',
  },
];

describe('Marketplace Moderation & Business Rules', () => {
  it('blocks NSFW terms and enforces title length bounds', () => {
    assert.equal(validatePuzzleTitleSafety('A').valid, false);
    assert.equal(validatePuzzleTitleSafety('Explicit NSFW art').valid, false);
    assert.equal(validatePuzzleTitleSafety('Neon Retro Skyline').valid, true);
  });

  it('computes creator royalty matching Postgres RPC (20%, min 5 coins for paid)', () => {
    assert.equal(calculateCreatorRoyalty(0), 0);
    assert.equal(calculateCreatorRoyalty(15), 5);
    assert.equal(calculateCreatorRoyalty(25), 5);
    assert.equal(calculateCreatorRoyalty(50), 10);
  });

  it('auto-quarantines puzzles reaching 3 community flags', () => {
    assert.equal(shouldAutoQuarantine(0), false);
    assert.equal(shouldAutoQuarantine(2), false);
    assert.equal(shouldAutoQuarantine(3), true);
  });

  it('filters out non-approved items and sorts trending / newest / lowest-price accurately', () => {
    const trending = filterAndSortMarketplace(SAMPLE_PUZZLES, {
      category: 'All',
      searchQuery: '',
      sort: 'trending',
    });
    assert.equal(trending.length, 2);
    assert.equal(trending[0].id, '2');

    const natureOnly = filterAndSortMarketplace(SAMPLE_PUZZLES, {
      category: 'Nature',
      searchQuery: 'harbor',
      sort: 'newest',
    });
    assert.equal(natureOnly.length, 1);
    assert.equal(natureOnly[0].id, '1');

    const lowest = filterAndSortMarketplace(SAMPLE_PUZZLES, {
      category: 'All',
      searchQuery: '',
      sort: 'lowest-price',
    });
    assert.equal(lowest[0].coinPrice, 0);
  });
});
