import type {
  Board,
  GridPosition,
  GridSize,
  MoveDirection,
  MoveResult,
} from '../types/puzzle';
import { BLANK_TILE } from '../types/puzzle';
import { ensureSolvable, isSolvable } from './solvability';

/**
 * Creates the canonical solved board for a given grid size:
 * [1, 2, ..., N*N - 1, 0].
 */
export function createSolvedBoard(gridSize: GridSize): Board {
  const totalCells = gridSize * gridSize;
  const board: Board = new Array(totalCells);
  for (let i = 0; i < totalCells - 1; i++) {
    board[i] = i + 1;
  }
  board[totalCells - 1] = BLANK_TILE;
  return board;
}

/**
 * Converts a 1D board index into 0-based (row, col) coordinates.
 */
export function indexToPosition(index: number, gridSize: GridSize): GridPosition {
  return {
    row: Math.floor(index / gridSize),
    col: index % gridSize,
  };
}

/**
 * Converts 0-based (row, col) coordinates into a 1D board index.
 */
export function positionToIndex(row: number, col: number, gridSize: GridSize): number {
  return row * gridSize + col;
}

/**
 * Returns the solved target (row, col) position for a non-blank tile value (1..N*N-1).
 * Essential both for Manhattan distance heuristics and for slicing custom UGC images
 * onto their exact tile coordinates in Phase 2.
 */
export function getTileTargetPosition(tileValue: number, gridSize: GridSize): GridPosition {
  if (tileValue === BLANK_TILE) {
    return { row: gridSize - 1, col: gridSize - 1 };
  }
  return indexToPosition(tileValue - 1, gridSize);
}

/**
 * Checks whether every tile is in its solved target position.
 */
export function isSolved(board: Board): boolean {
  const lastIndex = board.length - 1;
  if (board[lastIndex] !== BLANK_TILE) {
    return false;
  }
  for (let i = 0; i < lastIndex; i++) {
    if (board[i] !== i + 1) {
      return false;
    }
  }
  return true;
}

/**
 * Returns all 1D indices of tiles directly adjacent (orthogonal) to the blank cavity.
 */
export function getAdjacentMovableIndices(board: Board, gridSize: GridSize): number[] {
  const blankIndex = board.indexOf(BLANK_TILE);
  const { row, col } = indexToPosition(blankIndex, gridSize);
  const movable: number[] = [];

  if (row > 0) movable.push(positionToIndex(row - 1, col, gridSize));
  if (row < gridSize - 1) movable.push(positionToIndex(row + 1, col, gridSize));
  if (col > 0) movable.push(positionToIndex(row, col - 1, gridSize));
  if (col < gridSize - 1) movable.push(positionToIndex(row, col + 1, gridSize));

  return movable;
}

/**
 * Returns true if the tile at `tileIndex` can slide (either directly adjacent to the
 * blank cavity, or in the same row/column for a tactile multi-tile line push).
 */
export function canSlideTile(board: Board, tileIndex: number, gridSize: GridSize): boolean {
  if (tileIndex < 0 || tileIndex >= board.length) return false;
  if (board[tileIndex] === BLANK_TILE) return false;

  const blankIndex = board.indexOf(BLANK_TILE);
  const tilePos = indexToPosition(tileIndex, gridSize);
  const blankPos = indexToPosition(blankIndex, gridSize);

  return tilePos.row === blankPos.row || tilePos.col === blankPos.col;
}

/**
 * Slides a tile — or an entire inline column/row of tiles — toward the blank cavity,
 * faithfully replicating the feel of pushing multiple plastic tiles on a physical frame.
 */
export function slideTile(board: Board, tileIndex: number, gridSize: GridSize): MoveResult {
  if (!canSlideTile(board, tileIndex, gridSize)) {
    return { moved: false, board, tilesShifted: 0, direction: null };
  }

  const blankIndex = board.indexOf(BLANK_TILE);
  const tilePos = indexToPosition(tileIndex, gridSize);
  const blankPos = indexToPosition(blankIndex, gridSize);
  const nextBoard = [...board];

  let direction: MoveDirection;
  let tilesShifted = 0;

  if (tilePos.row === blankPos.row) {
    // Horizontal slide along the same row
    const step = tilePos.col < blankPos.col ? -1 : 1;
    direction = tilePos.col < blankPos.col ? 'right' : 'left';
    tilesShifted = Math.abs(blankPos.col - tilePos.col);

    for (let col = blankPos.col; col !== tilePos.col; col += step) {
      const destIdx = positionToIndex(tilePos.row, col, gridSize);
      const srcIdx = positionToIndex(tilePos.row, col + step, gridSize);
      nextBoard[destIdx] = nextBoard[srcIdx];
    }
    nextBoard[tileIndex] = BLANK_TILE;
  } else {
    // Vertical slide along the same column
    const step = tilePos.row < blankPos.row ? -1 : 1;
    direction = tilePos.row < blankPos.row ? 'down' : 'up';
    tilesShifted = Math.abs(blankPos.row - tilePos.row);

    for (let row = blankPos.row; row !== tilePos.row; row += step) {
      const destIdx = positionToIndex(row, tilePos.col, gridSize);
      const srcIdx = positionToIndex(row + step, tilePos.col, gridSize);
      nextBoard[destIdx] = nextBoard[srcIdx];
    }
    nextBoard[tileIndex] = BLANK_TILE;
  }

  return {
    moved: true,
    board: nextBoard,
    tilesShifted,
    direction,
  };
}

/**
 * Generates a uniformly distributed, mathematically solvable, non-solved puzzle board.
 *
 * Strategy:
 * 1. Perform an unbiased Fisher-Yates shuffle on the canonical board.
 * 2. Pass through `ensureSolvable()` which verifies inversion + blank-row parity
 *    and applies a single transposition if parity is invalid.
 * 3. Guard against dealing an already-solved board or trivially 1-move-away board.
 * 4. Assert `isSolvable()` as a final safety invariant.
 */
export function generateSolvableBoard(
  gridSize: GridSize,
  rng: () => number = Math.random
): Board {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board = createSolvedBoard(gridSize);

    // Fisher-Yates unbiased shuffle
    for (let i = board.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = board[i];
      board[i] = board[j];
      board[j] = tmp;
    }

    const candidate = ensureSolvable(board, gridSize);

    // Avoid starting already solved or trivially close to solved
    if (!isSolved(candidate) && computeManhattanDistance(candidate, gridSize) >= gridSize) {
      if (!isSolvable(candidate, gridSize)) {
        throw new Error('Invariant violation: generated board failed solvability check.');
      }
      return candidate;
    }
  }

  // Deterministic fallback if a custom/seeded RNG happened to produce solved boards repeatedly
  const fallback = createSolvedBoard(gridSize);
  const last = fallback.length - 1;
  // Two valid legal slides from solved state guarantees solvability
  const firstMove = slideTile(fallback, last - 1, gridSize).board;
  return slideTile(firstMove, last - 1 - gridSize, gridSize).board;
}

/**
 * Computes total Manhattan distance of all non-blank tiles from their solved coordinates.
 * Used as an admissible heuristic for the Hint Solver and for difficulty/progress indicators.
 */
export function computeManhattanDistance(board: Board, gridSize: GridSize): number {
  let distance = 0;

  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    if (tile === BLANK_TILE) continue;

    const currentRow = Math.floor(i / gridSize);
    const currentCol = i % gridSize;
    const targetRow = Math.floor((tile - 1) / gridSize);
    const targetCol = (tile - 1) % gridSize;

    distance += Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol);
  }

  return distance;
}

/**
 * Counts how many non-blank tiles are currently resting in their exact final slot.
 */
export function countCorrectTiles(board: Board): number {
  let correct = 0;
  for (let i = 0; i < board.length - 1; i++) {
    if (board[i] === i + 1) {
      correct++;
    }
  }
  return correct;
}
