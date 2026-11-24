import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { useAppStore } from '../store/useAppStore';

/**
 * Drives the 1-second active play clock strictly while:
 * 1. The user is actively on the Game screen (`currentScreen === 'game'`),
 * 2. The board is in `'playing'` state (starts on first move, stops on win), AND
 * 3. The browser tab / native app is foreground & visible.
 *
 * Time spent away from a closed, refreshed, or backgrounded tab is NEVER counted,
 * and active game progress is flushed immediately on hide/unload.
 */
export function usePuzzleTimer(): void {
  const status = usePuzzleStore((state) => state.status);
  const tickTimer = usePuzzleStore((state) => state.tickTimer);
  const persistSnapshot = usePuzzleStore((state) => state.persistSnapshot);
  const currentScreen = useAppStore((state) => state.currentScreen);

  useEffect(() => {
    if (status !== 'playing' || currentScreen !== 'game') {
      return;
    }

    let isForeground =
      Platform.OS === 'web'
        ? typeof document === 'undefined' || document.visibilityState === 'visible'
        : AppState.currentState === 'active';

    const intervalId = setInterval(() => {
      if (isForeground) {
        tickTimer();
      }
    }, 1000);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisibility = () => {
        isForeground = document.visibilityState === 'visible';
        if (!isForeground) {
          persistSnapshot().catch(() => {});
        }
      };

      const handlePageHide = () => {
        isForeground = false;
        persistSnapshot().catch(() => {});
      };

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pagehide', handlePageHide);

      return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handlePageHide);
        persistSnapshot().catch(() => {});
      };
    }

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      isForeground = nextState === 'active';
      if (!isForeground) {
        persistSnapshot().catch(() => {});
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSub.remove();
      persistSnapshot().catch(() => {});
    };
  }, [status, currentScreen, tickTimer, persistSnapshot]);
}

/**
 * Formats seconds as MM:SS for the game HUD.
 */
export function formatElapsedTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
