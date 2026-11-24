import type { Board, FrameThemeId, GameStatus, GridSize } from '../types/puzzle';
import { isSolvable, isValidBoardPermutation } from '../engine/solvability';
import { isSolved } from '../engine/puzzleEngine';

export type PuzzleMode = 'classic' | 'photo' | 'marketplace';

export interface SavedActiveGame {
  version: 1;
  runId: string;
  mode: PuzzleMode;
  puzzleTitle: string;
  gridSize: GridSize;
  board: Board;
  moves: number;
  elapsedSeconds: number;
  status: GameStatus;
  frameTheme: FrameThemeId;
  /** Stable ID referencing IndexedDB/DocumentDirectory for local crafted photo puzzles. */
  craftedPuzzleId: string | null;
  /** HTTPS URL only for remote Marketplace puzzles (never blob:/data: URLs). */
  remoteImageUrl: string | null;
  showTileNumbers: boolean;
  savedAt: string;
}

/**
 * Pure validator ensuring a restored save is structurally valid, mathematically solvable,
 * and still unfinished before offering "Resume puzzle".
 */
export function validateSavedActiveGame(raw: unknown): SavedActiveGame | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SavedActiveGame>;

  if (data.version !== 1) return null;
  if (data.gridSize !== 3 && data.gridSize !== 4 && data.gridSize !== 5) return null;
  if (!Array.isArray(data.board)) return null;
  if (!isValidBoardPermutation(data.board, data.gridSize)) return null;
  if (!isSolvable(data.board, data.gridSize)) return null;
  if (isSolved(data.board) || data.status === 'solved') return null;
  if (typeof data.moves !== 'number' || data.moves < 0) return null;
  if (typeof data.elapsedSeconds !== 'number' || data.elapsedSeconds < 0) return null;
  if (typeof data.runId !== 'string' || !data.runId) return null;

  return {
    version: 1,
    runId: data.runId,
    mode:
      data.mode === 'photo' || data.mode === 'marketplace'
        ? data.mode
        : 'classic',
    puzzleTitle:
      typeof data.puzzleTitle === 'string' && data.puzzleTitle.trim()
        ? data.puzzleTitle
        : `${data.gridSize}×${data.gridSize} Puzzle`,
    gridSize: data.gridSize,
    board: [...data.board],
    moves: Math.floor(data.moves),
    elapsedSeconds: Math.floor(data.elapsedSeconds),
    status: data.status === 'playing' ? 'playing' : 'idle',
    frameTheme:
      data.frameTheme === 'arcade-red' ||
      data.frameTheme === 'retro-yellow' ||
      data.frameTheme === 'cobalt-blue'
        ? data.frameTheme
        : 'classic-black',
    craftedPuzzleId:
      typeof data.craftedPuzzleId === 'string' ? data.craftedPuzzleId : null,
    remoteImageUrl:
      typeof data.remoteImageUrl === 'string' &&
      data.remoteImageUrl.startsWith('http')
        ? data.remoteImageUrl
        : null,
    showTileNumbers:
      typeof data.showTileNumbers === 'boolean' ? data.showTileNumbers : true,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
  };
}

/**
 * Pure idempotent reward calculator: ensures a completed runId never awards
 * completion coins more than once.
 */
export function resolveIdempotentWinCoins(
  runId: string,
  completedRunIds: string[],
  proposedCoins: number
): { coinsToGrant: number; alreadyRewarded: boolean; updatedCompletedRunIds: string[] } {
  const alreadyRewarded = completedRunIds.includes(runId);
  if (alreadyRewarded) {
    return {
      coinsToGrant: 0,
      alreadyRewarded: true,
      updatedCompletedRunIds: completedRunIds,
    };
  }

  return {
    coinsToGrant: Math.max(0, Math.floor(proposedCoins)),
    alreadyRewarded: false,
    updatedCompletedRunIds: [runId, ...completedRunIds].slice(0, 100),
  };
}
