import { useEffect } from 'react';
import { usePuzzleStore } from '../store/usePuzzleStore';

/**
 * Drives the 1-second game clock while the puzzle is actively being played.
 * Starts automatically on the player's first valid tile move and halts on solve.
 */
export function usePuzzleTimer(): void {
  const status = usePuzzleStore((state) => state.status);
  const tickTimer = usePuzzleStore((state) => state.tickTimer);

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const intervalId = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [status, tickTimer]);
}

/**
 * Formats seconds as MM:SS for the game HUD.
 */
export function formatElapsedTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
