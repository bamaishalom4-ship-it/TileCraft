import type { Board, GridSize, SolvabilityReport } from '../types/puzzle';
import { BLANK_TILE } from '../types/puzzle';

/**
 * Validates that a board contains every tile value from 0 to N*N - 1 exactly once.
 */
export function isValidBoardPermutation(board: Board, gridSize: GridSize): boolean {
  const expectedLength = gridSize * gridSize;
  if (board.length !== expectedLength) {
    return false;
  }

  const seen = new Uint8Array(expectedLength);
  for (let i = 0; i < expectedLength; i++) {
    const val = board[i];
    if (!Number.isInteger(val) || val < 0 || val >= expectedLength || seen[val] === 1) {
      return false;
    }
    seen[val] = 1;
  }
  return true;
}

/**
 * Counts the number of inversions in a sliding puzzle board (ignoring the blank tile `0`).
 *
 * An inversion is any pair (i, j) with i < j where board[i] > board[j]
 * and neither board[i] nor board[j] is 0.
 *
 * Time complexity: O(N^4) — at most 24*23/2 = 276 comparisons for a 5x5 board,
 * executing in microseconds.
 */
export function countInversions(board: Board): number {
  let inversions = 0;
  const len = board.length;

  for (let i = 0; i < len - 1; i++) {
    const left = board[i];
    if (left === BLANK_TILE) continue;

    for (let j = i + 1; j < len; j++) {
      const right = board[j];
      if (right === BLANK_TILE) continue;

      if (left > right) {
        inversions++;
      }
    }
  }

  return inversions;
}

/**
 * Computes full parity diagnostics for an N×N sliding puzzle whose goal state
 * places the blank tile at the bottom-right corner: [1, 2, ..., N*N - 1, 0].
 *
 * Mathematical Solvability Theorem:
 * 1. When N is ODD (3x3, 5x5):
 *    - Horizontal moves do not change inversions.
 *    - Vertical moves shift the blank past (N - 1) tiles (an even count),
 *      which changes inversions by an even number.
 *    - Therefore, inversion parity is invariant. Since the solved state has 0
 *      inversions (even), a board is solvable iff `inversions % 2 === 0`.
 *
 * 2. When N is EVEN (4x4):
 *    - Horizontal moves leave both inversions and blank row unchanged.
 *    - Vertical moves change blankRowFromBottom by ±1 (flipping parity) AND
 *      shift the blank past (N - 1) tiles (odd), flipping inversion parity.
 *    - Therefore, `(inversions + blankRowFromBottom) % 2` is invariant.
 *    - In the solved state, `inversions = 0` and `blankRowFromBottom = 1` (sum = 1, odd).
 *    - A board is solvable iff `(inversions + blankRowFromBottom) % 2 === 1`.
 */
export function analyzeSolvability(board: Board, gridSize: GridSize): SolvabilityReport {
  if (!isValidBoardPermutation(board, gridSize)) {
    throw new Error(
      `Invalid board permutation for ${gridSize}x${gridSize} grid (length=${board.length}).`
    );
  }

  const inversions = countInversions(board);
  const blankIndex = board.indexOf(BLANK_TILE);
  const blankRowFromTop = Math.floor(blankIndex / gridSize); // 0-indexed from top
  const blankRowFromBottom = gridSize - blankRowFromTop; // 1-indexed from bottom

  const isOddGrid = gridSize % 2 === 1;
  const solvable = isOddGrid
    ? inversions % 2 === 0
    : (inversions + blankRowFromBottom) % 2 === 1;

  return {
    solvable,
    inversions,
    blankRowFromTop,
    blankRowFromBottom,
    gridSize,
  };
}

/**
 * Returns true if and only if the board can legally reach the solved state
 * [1, 2, ..., N*N - 1, 0] via valid sliding moves.
 */
export function isSolvable(board: Board, gridSize: GridSize): boolean {
  return analyzeSolvability(board, gridSize).solvable;
}

/**
 * Guarantees a board permutation is mathematically solvable in O(1) repair time.
 *
 * If the board is unsolvable, swapping any two non-blank tiles performs a single
 * transposition (an odd permutation), which flips inversion parity by ±1 (mod 2)
 * without moving the blank tile's row — turning every unsolvable state into a
 * guaranteed solvable state.
 */
export function ensureSolvable(board: Board, gridSize: GridSize): Board {
  const copy = [...board];
  if (isSolvable(copy, gridSize)) {
    return copy;
  }

  // Locate the first two non-blank tiles and swap them to invert parity.
  let firstIdx = -1;
  let secondIdx = -1;

  for (let i = 0; i < copy.length; i++) {
    if (copy[i] !== BLANK_TILE) {
      if (firstIdx === -1) {
        firstIdx = i;
      } else {
        secondIdx = i;
        break;
      }
    }
  }

  if (firstIdx !== -1 && secondIdx !== -1) {
    const temp = copy[firstIdx];
    copy[firstIdx] = copy[secondIdx];
    copy[secondIdx] = temp;
  }

  return copy;
}
