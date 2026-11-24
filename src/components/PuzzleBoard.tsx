import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BLANK_TILE } from '../types/puzzle';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { FRAME_THEMES } from '../theme/tokens';
import { PuzzleTile } from './PuzzleTile';

const FRAME_PADDING = 14;
const CAVITY_PADDING = 6;
const TILE_GAP = 4;

/**
 * Responsive molded-frame sliding puzzle board.
 * Styled after classic physical 15-puzzle plastic trays with a recessed cavity
 * and smooth spring-animated tiles.
 */
export const PuzzleBoard: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();

  const board = usePuzzleStore((state) => state.board);
  const gridSize = usePuzzleStore((state) => state.gridSize);
  const status = usePuzzleStore((state) => state.status);
  const activeHint = usePuzzleStore((state) => state.activeHint);
  const frameThemeId = usePuzzleStore((state) => state.frameTheme);
  const imageUri = usePuzzleStore((state) => state.imageUri);
  const showTileNumbers = usePuzzleStore((state) => state.showTileNumbers);
  const tapTile = usePuzzleStore((state) => state.tapTile);

  const theme = FRAME_THEMES[frameThemeId];

  // Clamp outer frame width so the board looks great on phones and tablets alike
  const outerBoardSize = Math.min(screenWidth - 32, 420);
  const cavitySize = outerBoardSize - FRAME_PADDING * 2;
  const innerPlayfieldSize = cavitySize - CAVITY_PADDING * 2;
  const cellSize = innerPlayfieldSize / gridSize;

  const handleTilePress = useCallback(
    (tileIndex: number) => {
      const moved = tapTile(tileIndex);
      if (moved && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [tapTile]
  );

  // Build a stable ordered list of non-blank tile values (1..N*N-1) mapped to their current index
  const tileEntries = useMemo(() => {
    const entries: Array<{ value: number; index: number }> = [];
    for (let i = 0; i < board.length; i++) {
      const value = board[i];
      if (value !== BLANK_TILE) {
        entries.push({ value, index: i });
      }
    }
    // Sort by tile value so React component order stays 100% stable across moves
    entries.sort((a, b) => a.value - b.value);
    return entries;
  }, [board]);

  return (
    <View style={styles.container}>
      {/* Outer Molded Frame */}
      <View
        style={[
          styles.outerFrame,
          {
            width: outerBoardSize,
            height: outerBoardSize,
            backgroundColor: theme.frameOuter,
            borderTopColor: theme.frameBevelLight,
            borderLeftColor: theme.frameBevelLight,
            borderBottomColor: theme.frameBevelDark,
            borderRightColor: theme.frameBevelDark,
          },
        ]}
      >
        {/* Recessed Inner Tray Cavity */}
        <View
          style={[
            styles.cavity,
            {
              width: cavitySize,
              height: cavitySize,
              backgroundColor: theme.cavityBg,
              borderColor: theme.cavityBorder,
            },
          ]}
        >
          {/* Playfield where tiles slide on exact cell coordinates */}
          <View
            style={{
              width: innerPlayfieldSize,
              height: innerPlayfieldSize,
              position: 'relative',
            }}
          >
            {tileEntries.map(({ value, index }) => (
              <PuzzleTile
                key={`${gridSize}-${value}`}
                tileValue={value}
                currentIndex={index}
                gridSize={gridSize}
                cellSize={cellSize}
                tileGap={TILE_GAP}
                boardInnerSize={innerPlayfieldSize}
                isHinted={activeHint?.tileValue === value}
                hintDirection={
                  activeHint?.tileValue === value ? activeHint.direction : null
                }
                isSolvedBoard={status === 'solved'}
                imageUri={imageUri}
                showTileNumbers={showTileNumbers}
                onPress={handleTilePress}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  outerFrame: {
    borderRadius: 22,
    padding: FRAME_PADDING,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  cavity: {
    borderRadius: 14,
    padding: CAVITY_PADDING,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
