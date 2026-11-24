import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSolvability,
  countInversions,
  ensureSolvable,
  isSolvable,
  isValidBoardPermutation,
} from '../solvability';
import {
  computeManhattanDistance,
  createSolvedBoard,
  generateSolvableBoard,
  getTileIndexForArrowKey,
  isSolved,
  slideTile,
} from '../puzzleEngine';
import { getNextHint } from '../hintSolver';
import type { GridSize } from '../../types/puzzle';

describe('Solvability & Parity Algorithm', () => {
  it('counts inversions accurately while ignoring blank tile 0', () => {
    assert.equal(countInversions([1, 2, 3, 4, 5, 6, 7, 8, 0]), 0);
    assert.equal(countInversions([2, 1, 3, 4, 5, 6, 7, 8, 0]), 1);
    assert.equal(countInversions([8, 7, 6, 5, 4, 3, 2, 1, 0]), 28);
    assert.equal(countInversions([0, 2, 1, 3, 4, 5, 6, 7, 8]), 1);
  });

  it('validates odd-grid (3x3 and 5x5) solvability using even inversion parity', () => {
    // 3x3 solved: 0 inversions (even) -> solvable
    assert.equal(isSolvable(createSolvedBoard(3), 3), true);
    // 3x3 swapped 1 & 2: 1 inversion (odd) -> unsolvable
    assert.equal(isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), false);

    // 5x5 solved -> solvable
    const solved5 = createSolvedBoard(5);
    assert.equal(isSolvable(solved5, 5), true);
    // 5x5 swapped first two tiles -> 1 inversion -> unsolvable
    const unsolvable5 = [...solved5];
    [unsolvable5[0], unsolvable5[1]] = [unsolvable5[1], unsolvable5[0]];
    assert.equal(isSolvable(unsolvable5, 5), false);
  });

  it('rejects Sam Loyd impossible 14-15 puzzle on 4x4 grid', () => {
    const samLoyd1415 = [
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 15, 14, 0,
    ];
    const report = analyzeSolvability(samLoyd1415, 4);
    assert.equal(report.inversions, 1);
    assert.equal(report.blankRowFromBottom, 1);
    assert.equal(report.solvable, false);
  });

  it('accepts valid 4x4 state with blank on an even row from bottom and odd inversions', () => {
    // Start solved and slide tile 12 down into bottom-right blank
    const solved4 = createSolvedBoard(4);
    const afterSlide = slideTile(solved4, 11, 4);
    assert.equal(afterSlide.moved, true);

    const report = analyzeSolvability(afterSlide.board, 4);
    assert.equal(report.blankRowFromBottom, 2); // even row from bottom
    assert.equal(report.inversions, 3); // 13>12, 14>12, 15>12 -> odd inversions
    assert.equal(report.solvable, true);
  });

  it('repairs unsolvable boards into solvable ones via ensureSolvable()', () => {
    const unsolvable3 = [2, 1, 3, 4, 5, 6, 7, 8, 0];
    const repaired3 = ensureSolvable(unsolvable3, 3);
    assert.equal(isSolvable(repaired3, 3), true);

    const unsolvable4 = [
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 15, 14, 0,
    ];
    const repaired4 = ensureSolvable(unsolvable4, 4);
    assert.equal(isSolvable(repaired4, 4), true);
  });

  it('guarantees 100% solvability across 1,500 random boards (3x3, 4x4, 5x5)', () => {
    const sizes: GridSize[] = [3, 4, 5];
    for (const size of sizes) {
      for (let i = 0; i < 500; i++) {
        const board = generateSolvableBoard(size);
        assert.equal(isValidBoardPermutation(board, size), true);
        assert.equal(isSolvable(board, size), true);
        assert.equal(isSolved(board), false);
        assert.ok(computeManhattanDistance(board, size) >= size);
      }
    }
  });
});

describe('Sliding Mechanics (Single & Multi-Tile Line Push)', () => {
  it('supports pushing an entire row of tiles toward the blank cavity', () => {
    // 4x4 solved: blank is at index 15 (row 3, col 3). Tapping index 12 (tile 13)
    // should push tiles 13, 14, 15 one cell right and leave blank at index 12.
    const solved4 = createSolvedBoard(4);
    const result = slideTile(solved4, 12, 4);

    assert.equal(result.moved, true);
    assert.equal(result.direction, 'right');
    assert.equal(result.tilesShifted, 3);
    assert.deepEqual(result.board.slice(12, 16), [0, 13, 14, 15]);
    assert.equal(isSolvable(result.board, 4), true);
  });

  it('supports pushing an entire column of tiles toward the blank cavity', () => {
    // 3x3 solved: blank at index 8 (row 2, col 2). Tap index 2 (tile 3).
    const solved3 = createSolvedBoard(3);
    const result = slideTile(solved3, 2, 3);

    assert.equal(result.moved, true);
    assert.equal(result.direction, 'down');
    assert.equal(result.tilesShifted, 2);
    assert.deepEqual(result.board, [1, 2, 0, 4, 5, 3, 7, 8, 6]);
    assert.equal(isSolvable(result.board, 3), true);
  });

  it('rejects diagonal/non-aligned tile taps without mutating the board', () => {
    const solved3 = createSolvedBoard(3);
    const result = slideTile(solved3, 4, 3); // center tile when blank is bottom-right
    assert.equal(result.moved, false);
    assert.deepEqual(result.board, solved3);
  });

  it('maps arrow keys to sliding the adjacent tile INTO the gap in that direction', () => {
    // 3x3 board with blank at center (index 4: row 1, col 1)
    // [1, 2, 3,
    //  4, 0, 6,
    //  7, 5, 8]
    const centerBlank = [1, 2, 3, 4, 0, 6, 7, 5, 8];
    // ArrowUp slides tile below blank (index 7, value 5) upward
    assert.equal(getTileIndexForArrowKey(centerBlank, 3, 'up'), 7);
    // ArrowDown slides tile above blank (index 1, value 2) downward
    assert.equal(getTileIndexForArrowKey(centerBlank, 3, 'down'), 1);
    // ArrowLeft slides tile right of blank (index 5, value 6) leftward
    assert.equal(getTileIndexForArrowKey(centerBlank, 3, 'left'), 5);
    // ArrowRight slides tile left of blank (index 3, value 4) rightward
    assert.equal(getTileIndexForArrowKey(centerBlank, 3, 'right'), 3);

    // At bottom-right corner (index 8), ArrowUp and ArrowLeft have no tile to slide
    const cornerBlank = createSolvedBoard(3);
    assert.equal(getTileIndexForArrowKey(cornerBlank, 3, 'up'), null);
    assert.equal(getTileIndexForArrowKey(cornerBlank, 3, 'left'), null);
    assert.equal(getTileIndexForArrowKey(cornerBlank, 3, 'down'), 5);
    assert.equal(getTileIndexForArrowKey(cornerBlank, 3, 'right'), 7);
  });
});

describe('A* Hint Solver', () => {
  it('completely solves random 3x3 puzzles by repeatedly following hint recommendations', () => {
    for (let trial = 0; trial < 10; trial++) {
      let board = generateSolvableBoard(3);
      let steps = 0;

      while (!isSolved(board) && steps < 40) {
        const hint = getNextHint(board, 3);
        assert.ok(hint, 'Expected a valid hint for solvable 3x3 board');
        const next = slideTile(board, hint.tileIndex, 3);
        assert.equal(next.moved, true);
        board = next.board;
        steps++;
      }

      assert.equal(isSolved(board), true, `Trial ${trial} should be solved via A* hints`);
    }
  });

  it('returns fast, valid next-move hints for 4x4 and 5x5 boards', () => {
    for (const size of [4, 5] as GridSize[]) {
      const board = generateSolvableBoard(size);
      const startMs = Date.now();
      const hint = getNextHint(board, size);
      const elapsedMs = Date.now() - startMs;

      assert.ok(hint, `Expected a valid hint for ${size}x${size} board`);
      const next = slideTile(board, hint.tileIndex, size);
      assert.equal(next.moved, true);
      assert.ok(elapsedMs < 500, `Hint took ${elapsedMs}ms (expected <500ms)`);
    }
  });
});
