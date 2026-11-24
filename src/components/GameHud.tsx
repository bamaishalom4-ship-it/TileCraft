import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FrameThemeId, GridSize } from '../types/puzzle';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { countCorrectTiles } from '../engine/puzzleEngine';
import { formatElapsedTime } from '../hooks/usePuzzleTimer';
import { COLORS, FRAME_THEMES } from '../theme/tokens';

const GRID_SIZES: GridSize[] = [3, 4, 5];
const THEME_IDS: FrameThemeId[] = [
  'classic-black',
  'arcade-red',
  'retro-yellow',
  'cobalt-blue',
];

/**
 * Top & bottom HUD controls for Phase 1:
 * - Grid size selector (3x3, 4x4, 5x5)
 * - Live Move counter, Timer (MM:SS), and Completion progress
 * - Tactile frame color switcher
 * - Hint (wired to A* solver; coin-gated in Phase 4) & Shuffle buttons
 */
export const GameHudTop: React.FC = () => {
  const gridSize = usePuzzleStore((state) => state.gridSize);
  const board = usePuzzleStore((state) => state.board);
  const moves = usePuzzleStore((state) => state.moves);
  const elapsedSeconds = usePuzzleStore((state) => state.elapsedSeconds);
  const setGridSize = usePuzzleStore((state) => state.setGridSize);

  const totalTiles = gridSize * gridSize - 1;
  const correctTiles = countCorrectTiles(board);

  return (
    <View style={styles.topContainer}>
      {/* Title + Grid Size Selector */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>TileCraft</Text>
          <Text style={styles.subtitle}>
            {gridSize}×{gridSize} Sliding Puzzle
          </Text>
        </View>

        <View style={styles.sizeSegmented}>
          {GRID_SIZES.map((size) => {
            const active = size === gridSize;
            return (
              <Pressable
                key={size}
                onPress={() => setGridSize(size)}
                style={[styles.sizePill, active && styles.sizePillActive]}
              >
                <Text
                  style={[styles.sizePillText, active && styles.sizePillTextActive]}
                >
                  {size}×{size}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Live Telemetry Bar: Moves | Time | Placed */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MOVES</Text>
          <Text style={styles.statValue}>{moves}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TIME</Text>
          <Text style={styles.statValue}>{formatElapsedTime(elapsedSeconds)}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>PLACED</Text>
          <Text style={styles.statValue}>
            {correctTiles}/{totalTiles}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const GameHudBottom: React.FC = () => {
  const status = usePuzzleStore((state) => state.status);
  const frameTheme = usePuzzleStore((state) => state.frameTheme);
  const shuffle = usePuzzleStore((state) => state.shuffle);
  const requestHint = usePuzzleStore((state) => state.requestHint);
  const setFrameTheme = usePuzzleStore((state) => state.setFrameTheme);

  return (
    <View style={styles.bottomContainer}>
      {/* Frame Theme Selector (inspired by vintage molded plastic trays) */}
      <View style={styles.themeRow}>
        <Text style={styles.themeLabel}>Frame</Text>
        <View style={styles.swatches}>
          {THEME_IDS.map((id) => {
            const theme = FRAME_THEMES[id];
            const selected = id === frameTheme;
            return (
              <Pressable
                key={id}
                onPress={() => setFrameTheme(id)}
                accessibilityLabel={`Select ${theme.label} frame`}
                style={[
                  styles.swatch,
                  { backgroundColor: theme.frameOuter },
                  selected && styles.swatchSelected,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Primary Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={requestHint}
          disabled={status === 'solved'}
          style={({ pressed }) => [
            styles.button,
            styles.hintButton,
            status === 'solved' && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.hintButtonText}>Hint</Text>
          <Text style={styles.hintSubtext}>A* Solver</Text>
        </Pressable>

        <Pressable
          onPress={shuffle}
          style={({ pressed }) => [
            styles.button,
            styles.shuffleButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.shuffleButtonText}>Shuffle Board</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topContainer: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sizeSegmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sizePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  sizePillActive: {
    backgroundColor: COLORS.gold,
  },
  sizePillText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  sizePillTextActive: {
    color: '#111827',
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  bottomContainer: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  themeLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  swatches: {
    flexDirection: 'row',
    gap: 10,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  swatchSelected: {
    borderColor: COLORS.textPrimary,
    transform: [{ scale: 1.15 }],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintButton: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  hintButtonText: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  hintSubtext: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  shuffleButton: {
    backgroundColor: COLORS.gold,
  },
  shuffleButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
});
