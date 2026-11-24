/**
 * Supported square grid dimensions for the sliding puzzle.
 * - 3: 3x3 (8-puzzle, beginner)
 * - 4: 4x4 (classic 15-puzzle)
 * - 5: 5x5 (24-puzzle, master — unlockable with coins in Phase 4)
 */
export type GridSize = 3 | 4 | 5;

/**
 * Value representing the empty recessed cavity on the board.
 */
export const BLANK_TILE = 0 as const;

/**
 * Row-major 1D board representation of length gridSize * gridSize.
 * Solved state is [1, 2, ..., N*N - 1, 0].
 */
export type Board = number[];

export interface GridPosition {
  row: number;
  col: number;
}

export type GameStatus = 'idle' | 'playing' | 'solved';

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export interface MoveResult {
  /** Whether the requested tile tap resulted in a valid slide. */
  moved: boolean;
  /** New immutable board array after the slide. */
  board: Board;
  /** Number of individual tile positions shifted (1 for adjacent, >1 for multi-tile line slide). */
  tilesShifted: number;
  /** Direction the tiles moved. */
  direction: MoveDirection | null;
}

export interface HintRecommendation {
  /** Current 1D board index of the tile to tap/slide. */
  tileIndex: number;
  /** Face value of the recommended tile (1..N*N-1). */
  tileValue: number;
  /** Direction the tile will slide into the blank cavity. */
  direction: MoveDirection;
}

export interface SolvabilityReport {
  solvable: boolean;
  inversions: number;
  blankRowFromTop: number;
  blankRowFromBottom: number;
  gridSize: GridSize;
}

/**
 * Visual theme presets inspired by vintage physical sliding tile frames.
 */
export type FrameThemeId = 'classic-black' | 'arcade-red' | 'retro-yellow' | 'cobalt-blue';
