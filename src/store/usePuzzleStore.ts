import { create } from 'zustand';
import type {
  Board,
  FrameThemeId,
  GameStatus,
  GridSize,
  HintRecommendation,
} from '../types/puzzle';
import {
  generateSolvableBoard,
  isSolved,
  slideTile,
} from '../engine/puzzleEngine';
import { getNextHint } from '../engine/hintSolver';

export interface PuzzleStoreState {
  gridSize: GridSize;
  board: Board;
  moves: number;
  elapsedSeconds: number;
  status: GameStatus;
  activeHint: HintRecommendation | null;
  frameTheme: FrameThemeId;
  /** Phase 2 readiness: optional square cropped image URI for photo/UGC puzzles. */
  imageUri: string | null;
  showTileNumbers: boolean;

  // Actions
  setGridSize: (size: GridSize) => void;
  tapTile: (tileIndex: number) => boolean;
  shuffle: () => void;
  requestHint: () => HintRecommendation | null;
  clearHint: () => void;
  tickTimer: () => void;
  setFrameTheme: (theme: FrameThemeId) => void;
  setImageUri: (uri: string | null) => void;
  toggleTileNumbers: () => void;
}

const DEFAULT_GRID_SIZE: GridSize = 4;

export const usePuzzleStore = create<PuzzleStoreState>((set, get) => ({
  gridSize: DEFAULT_GRID_SIZE,
  board: generateSolvableBoard(DEFAULT_GRID_SIZE),
  moves: 0,
  elapsedSeconds: 0,
  status: 'idle',
  activeHint: null,
  frameTheme: 'classic-black',
  imageUri: null,
  showTileNumbers: true,

  setGridSize: (size: GridSize) => {
    set({
      gridSize: size,
      board: generateSolvableBoard(size),
      moves: 0,
      elapsedSeconds: 0,
      status: 'idle',
      activeHint: null,
    });
  },

  tapTile: (tileIndex: number) => {
    const { board, gridSize, status, moves } = get();
    if (status === 'solved') {
      return false;
    }

    const result = slideTile(board, tileIndex, gridSize);
    if (!result.moved) {
      return false;
    }

    const solvedNow = isSolved(result.board);

    set({
      board: result.board,
      moves: moves + 1,
      status: solvedNow ? 'solved' : 'playing',
      activeHint: null,
    });

    return true;
  },

  shuffle: () => {
    const { gridSize } = get();
    set({
      board: generateSolvableBoard(gridSize),
      moves: 0,
      elapsedSeconds: 0,
      status: 'idle',
      activeHint: null,
    });
  },

  requestHint: () => {
    const { board, gridSize, status } = get();
    if (status === 'solved') {
      return null;
    }
    const hint = getNextHint(board, gridSize);
    set({ activeHint: hint });
    return hint;
  },

  clearHint: () => set({ activeHint: null }),

  tickTimer: () => {
    const { status, elapsedSeconds } = get();
    if (status === 'playing') {
      set({ elapsedSeconds: elapsedSeconds + 1 });
    }
  },

  setFrameTheme: (frameTheme: FrameThemeId) => set({ frameTheme }),

  setImageUri: (imageUri: string | null) => set({ imageUri }),

  toggleTileNumbers: () =>
    set((state) => ({ showTileNumbers: !state.showTileNumbers })),
}));
