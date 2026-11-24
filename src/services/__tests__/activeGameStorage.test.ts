import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIdempotentWinCoins,
  validateSavedActiveGame,
} from '../../utils/activeGameUtils';
import { createSolvedBoard, slideTile } from '../../engine/puzzleEngine';

describe('Active Game Save, Resume & Idempotent Win Rewards', () => {
  it('accepts a valid unfinished 4x4 classic save and preserves exact board, moves, and elapsed time', () => {
    const solved = createSolvedBoard(4);
    const moved = slideTile(solved, 14, 4).board;

    const validated = validateSavedActiveGame({
      version: 1,
      runId: 'run_test_1',
      mode: 'classic',
      puzzleTitle: 'Classic 4×4',
      gridSize: 4,
      board: moved,
      moves: 7,
      elapsedSeconds: 42,
      status: 'playing',
      frameTheme: 'arcade-red',
      craftedPuzzleId: null,
      remoteImageUrl: null,
      showTileNumbers: true,
      savedAt: '2026-11-24T01:00:00Z',
    });

    assert.ok(validated);
    assert.deepEqual(validated.board, moved);
    assert.equal(validated.moves, 7);
    assert.equal(validated.elapsedSeconds, 42);
    assert.equal(validated.frameTheme, 'arcade-red');
  });

  it('rejects solved boards and mathematically unsolvable saves', () => {
    const solved3 = createSolvedBoard(3);
    assert.equal(
      validateSavedActiveGame({
        version: 1,
        runId: 'run_solved',
        mode: 'classic',
        puzzleTitle: 'Quick 3×3',
        gridSize: 3,
        board: solved3,
        moves: 10,
        elapsedSeconds: 20,
        status: 'playing',
        frameTheme: 'classic-black',
        craftedPuzzleId: null,
        remoteImageUrl: null,
        showTileNumbers: true,
        savedAt: '2026-11-24T01:00:00Z',
      }),
      null
    );

    const unsolvable3 = [2, 1, 3, 4, 5, 6, 7, 8, 0];
    assert.equal(
      validateSavedActiveGame({
        version: 1,
        runId: 'run_bad',
        mode: 'classic',
        puzzleTitle: 'Bad 3×3',
        gridSize: 3,
        board: unsolvable3,
        moves: 2,
        elapsedSeconds: 5,
        status: 'playing',
        frameTheme: 'classic-black',
        craftedPuzzleId: null,
        remoteImageUrl: null,
        showTileNumbers: true,
        savedAt: '2026-11-24T01:00:00Z',
      }),
      null
    );
  });

  it('strips temporary blob:/data: URLs from remoteImageUrl while preserving durable craftedPuzzleId', () => {
    const board = slideTile(createSolvedBoard(3), 7, 3).board;
    const validated = validateSavedActiveGame({
      version: 1,
      runId: 'run_photo_1',
      mode: 'photo',
      puzzleTitle: 'Sunset Cat',
      gridSize: 3,
      board,
      moves: 3,
      elapsedSeconds: 11,
      status: 'playing',
      frameTheme: 'classic-black',
      craftedPuzzleId: 'crafted_12345',
      remoteImageUrl: 'blob:https://tilecraft-five.vercel.app/dead-object-url',
      showTileNumbers: true,
      savedAt: '2026-11-24T01:00:00Z',
    });

    assert.ok(validated);
    assert.equal(validated.craftedPuzzleId, 'crafted_12345');
    assert.equal(validated.remoteImageUrl, null);
  });

  it('awards completion coins once per runId and blocks duplicate payouts', () => {
    const first = resolveIdempotentWinCoins('run_abc', [], 35);
    assert.equal(first.alreadyRewarded, false);
    assert.equal(first.coinsToGrant, 35);
    assert.deepEqual(first.updatedCompletedRunIds, ['run_abc']);

    const second = resolveIdempotentWinCoins(
      'run_abc',
      first.updatedCompletedRunIds,
      35
    );
    assert.equal(second.alreadyRewarded, true);
    assert.equal(second.coinsToGrant, 0);
  });
});
