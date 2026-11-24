import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  validateSavedActiveGame,
  type PuzzleMode,
  type SavedActiveGame,
} from '../utils/activeGameUtils';

export { validateSavedActiveGame };
export type { PuzzleMode, SavedActiveGame };

const ACTIVE_GAME_KEY = 'tilecraft_active_game_v1';
const COMPLETED_RUNS_KEY = 'tilecraft_completed_runs_v1';
const ONBOARDING_KEY = 'tilecraft_onboarding_v1';

export interface OnboardingFlags {
  hasCompletedFirstNumberedGame: boolean;
  freeIntroHintUsed: boolean;
}

export async function saveActiveGame(game: SavedActiveGame): Promise<boolean> {
  try {
    // Strip any accidental non-HTTP URLs so temporary object URLs or huge data URIs are never stored
    const safeCopy: SavedActiveGame = {
      ...game,
      remoteImageUrl:
        game.remoteImageUrl && game.remoteImageUrl.startsWith('http')
          ? game.remoteImageUrl
          : null,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(safeCopy));
    return true;
  } catch {
    return false;
  }
}

export async function loadActiveGame(): Promise<SavedActiveGame | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    return validateSavedActiveGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearActiveGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_GAME_KEY);
  } catch {
    // Non-fatal
  }
}

/**
 * Tracks completed run IDs so refreshing or re-triggering win handling never awards coins twice.
 */
export async function loadCompletedRunIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function markRunCompleted(runId: string): Promise<void> {
  try {
    const existing = await loadCompletedRunIds();
    if (existing.includes(runId)) return;
    const next = [runId, ...existing].slice(0, 100);
    await AsyncStorage.setItem(COMPLETED_RUNS_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal
  }
}

export async function loadOnboardingFlags(): Promise<OnboardingFlags> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
    if (!raw) {
      return {
        hasCompletedFirstNumberedGame: false,
        freeIntroHintUsed: false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingFlags>;
    return {
      hasCompletedFirstNumberedGame: Boolean(parsed.hasCompletedFirstNumberedGame),
      freeIntroHintUsed: Boolean(parsed.freeIntroHintUsed),
    };
  } catch {
    return {
      hasCompletedFirstNumberedGame: false,
      freeIntroHintUsed: false,
    };
  }
}

export async function saveOnboardingFlags(flags: OnboardingFlags): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(flags));
  } catch {
    // Non-fatal
  }
}
