import { create } from 'zustand';
import type {
  Board,
  FrameThemeId,
  GameStatus,
  GridSize,
  HintRecommendation,
  MoveDirection,
} from '../types/puzzle';
import {
  generateSolvableBoard,
  getTileIndexForArrowKey,
  isSolved,
  slideTile,
} from '../engine/puzzleEngine';
import { getNextHint } from '../engine/hintSolver';
import {
  clearActiveGame,
  saveActiveGame,
  type PuzzleMode,
  type SavedActiveGame,
} from '../services/activeGameStorage';

function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface StartNewGameOptions {
  gridSize: GridSize;
  mode: PuzzleMode;
  title: string;
  imageUri: string | null;
  craftedPuzzleId?: string | null;
}

export interface PuzzleStoreState {
  runId: string;
  mode: PuzzleMode;
  puzzleTitle: string;
  gridSize: GridSize;
  board: Board;
  moves: number;
  elapsedSeconds: number;
  status: GameStatus;
  activeHint: HintRecommendation | null;
  frameTheme: FrameThemeId;
  imageUri: string | null;
  craftedPuzzleId: string | null;
  showTileNumbers: boolean;

  // Actions
  setGridSize: (size: GridSize) => void;
  startNewGame: (opts: StartNewGameOptions) => void;
  restoreSavedGame: (saved: SavedActiveGame, resolvedImageUri: string | null) => void;
  tapTile: (tileIndex: number) => boolean;
  slideByDirection: (direction: MoveDirection) => boolean;
  shuffle: () => void;
  requestHint: () => HintRecommendation | null;
  clearHint: () => void;
  tickTimer: () => void;
  persistSnapshot: () => Promise<boolean>;
  setFrameTheme: (theme: FrameThemeId) => void;
  setImageUri: (uri: string | null) => void;
  toggleTileNumbers: () => void;
}

const DEFAULT_GRID_SIZE: GridSize = 4;

function buildSnapshot(state: PuzzleStoreState): SavedActiveGame {
  return {
    version: 1,
    runId: state.runId,
    mode: state.mode,
    puzzleTitle: state.puzzleTitle,
    gridSize: state.gridSize,
    board: state.board,
    moves: state.moves,
    elapsedSeconds: state.elapsedSeconds,
    status: state.status,
    frameTheme: state.frameTheme,
    craftedPuzzleId: state.craftedPuzzleId,
    remoteImageUrl:
      state.mode === 'marketplace' && state.imageUri?.startsWith('http')
        ? state.imageUri
        : null,
    showTileNumbers: state.showTileNumbers,
    savedAt: new Date().toISOString(),
  };
}

export const usePuzzleStore = create<PuzzleStoreState>((set, get) => ({
  runId: createRunId(),
  mode: 'classic',
  puzzleTitle: 'Classic 4×4',
  gridSize: DEFAULT_GRID_SIZE,
  board: generateSolvableBoard(DEFAULT_GRID_SIZE),
  moves: 0,
  elapsedSeconds: 0,
  status: 'idle',
  activeHint: null,
  frameTheme: 'classic-black',
  imageUri: null,
  craftedPuzzleId: null,
  showTileNumbers: true,

  setGridSize: (size: GridSize) => {
    set({
      gridSize: size,
    });
  },

  startNewGame: ({ gridSize, mode, title, imageUri, craftedPuzzleId = null }) => {
    const nextRunId = createRunId();
    const nextBoard = generateSolvableBoard(gridSize);
    set({
      runId: nextRunId,
      mode,
      puzzleTitle: title,
      gridSize,
      board: nextBoard,
      moves: 0,
      elapsedSeconds: 0,
      status: 'idle',
      activeHint: null,
      imageUri,
      craftedPuzzleId,
    });
    saveActiveGame(buildSnapshot(get())).catch(() => {});
  },

  restoreSavedGame: (saved, resolvedImageUri) => {
    set({
      runId: saved.runId,
      mode: saved.mode,
      puzzleTitle: saved.puzzleTitle,
      gridSize: saved.gridSize,
      board: [...saved.board],
      moves: saved.moves,
      elapsedSeconds: saved.elapsedSeconds,
      status: saved.status,
      activeHint: null,
      frameTheme: saved.frameTheme,
      imageUri: resolvedImageUri,
      craftedPuzzleId: saved.craftedPuzzleId,
      showTileNumbers: saved.showTileNumbers,
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

    if (solvedNow) {
      clearActiveGame().catch(() => {});
    } else {
      saveActiveGame(buildSnapshot(get())).catch(() => {});
    }

    return true;
  },

  slideByDirection: (direction: MoveDirection) => {
    const { board, gridSize, status } = get();
    if (status === 'solved') return false;
    const tileIndex = getTileIndexForArrowKey(board, gridSize, direction);
    if (tileIndex === null) return false;
    return get().tapTile(tileIndex);
  },

  shuffle: () => {
    const { gridSize } = get();
    set({
      runId: createRunId(),
      board: generateSolvableBoard(gridSize),
      moves: 0,
      elapsedSeconds: 0,
      status: 'idle',
      activeHint: null,
    });
    saveActiveGame(buildSnapshot(get())).catch(() => {});
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
      const nextSeconds = elapsedSeconds + 1;
      set({ elapsedSeconds: nextSeconds });
      // Persist periodically every 5 seconds of active play without thrashing storage
      if (nextSeconds % 5 === 0) {
        saveActiveGame(buildSnapshot(get())).catch(() => {});
      }
    }
  },

  persistSnapshot: async () => {
    const state = get();
    if (state.status === 'solved') {
      await clearActiveGame();
      return true;
    }
    return await saveActiveGame(buildSnapshot(state));
  },

  setFrameTheme: (frameTheme: FrameThemeId) => {
    set({ frameTheme });
    const state = get();
    if (state.status !== 'solved' && state.moves > 0) {
      saveActiveGame(buildSnapshot(state)).catch(() => {});
    }
  },

  setImageUri: (imageUri: string | null) => set({ imageUri }),

  toggleTileNumbers: () => {
    set((state) => ({ showTileNumbers: !state.showTileNumbers }));
    const state = get();
    if (state.status !== 'solved') {
      saveActiveGame(buildSnapshot(state)).catch(() => {});
    }
  },
}));
