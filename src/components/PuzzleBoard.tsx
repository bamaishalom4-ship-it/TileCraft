import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BLANK_TILE, type MoveDirection } from '../types/puzzle';
import { canSlideTile } from '../engine/puzzleEngine';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { useDialogStore } from '../store/useDialogStore';
import { COLORS, FRAME_THEMES } from '../theme/tokens';
import { PuzzleTile } from './PuzzleTile';

const FRAME_PADDING = 14;
const CAVITY_PADDING = 6;
const TILE_GAP = 4;

const ARROW_KEY_TO_DIRECTION: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

interface PuzzleBoardProps {
  /** Optional legal move index highlighted on a first-time player's very first move. */
  introSuggestedIndex?: number | null;
  /** True when any modal/dialog overlays the game screen (disables board keyboard capture). */
  isOverlayOpen?: boolean;
}

/**
 * Responsive molded-frame sliding puzzle board with touch/click sliding AND
 * focus-scoped Arrow-key movement on web/desktop keyboards.
 *
 * Arrow-key convention:
 * Pressing an arrow key slides the adjacent tile INTO the empty gap in that direction
 * (e.g., ArrowUp slides the tile below the gap upward into the gap).
 */
export const PuzzleBoard: React.FC<PuzzleBoardProps> = ({
  introSuggestedIndex = null,
  isOverlayOpen = false,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [boardFocused, setBoardFocused] = useState(false);
  const boardDomRef = useRef<View | null>(null);

  const board = usePuzzleStore((state) => state.board);
  const gridSize = usePuzzleStore((state) => state.gridSize);
  const status = usePuzzleStore((state) => state.status);
  const activeHint = usePuzzleStore((state) => state.activeHint);
  const frameThemeId = usePuzzleStore((state) => state.frameTheme);
  const imageUri = usePuzzleStore((state) => state.imageUri);
  const showTileNumbers = usePuzzleStore((state) => state.showTileNumbers);
  const tapTile = usePuzzleStore((state) => state.tapTile);
  const slideByDirection = usePuzzleStore((state) => state.slideByDirection);
  const dialogOpen = useDialogStore((state) => state.current !== null);

  const theme = FRAME_THEMES[frameThemeId];

  // Responsive board clamp that fits cleanly on narrow phones (320x568, 375x667) and desktop
  const outerBoardSize = Math.min(
    screenWidth - 32,
    Math.max(248, screenHeight - 310),
    400
  );
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

  // Scoped Arrow-key listener on web: only fires when board (or its tiles) has focus
  // and never intercepts keys inside inputs, textareas, or open modals/dialogs.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const node = boardDomRef.current as unknown as HTMLElement | null;
    if (!node) return;

    // Guarantee DOM focusability & accessible region semantics on react-native-web
    node.tabIndex = 0;
    node.setAttribute('role', 'region');
    node.setAttribute(
      'aria-label',
      `${gridSize} by ${gridSize} sliding puzzle board. Press Arrow keys to slide a tile into the gap.`
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOverlayOpen || dialogOpen) return;

      const direction = ARROW_KEY_TO_DIRECTION[event.key];
      if (!direction) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (!activeEl) return;

      const tag = activeEl.tagName?.toUpperCase();
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        activeEl.isContentEditable
      ) {
        return;
      }

      if (!node.contains(activeEl)) {
        return;
      }

      // Board has focus and is handling this arrow key -> prevent page scroll
      event.preventDefault();
      slideByDirection(direction);
    };

    const handleFocusIn = () => setBoardFocused(true);
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !node.contains(next)) {
        setBoardFocused(false);
      }
    };

    node.addEventListener('keydown', handleKeyDown);
    node.addEventListener('focusin', handleFocusIn);
    node.addEventListener('focusout', handleFocusOut);

    return () => {
      node.removeEventListener('keydown', handleKeyDown);
      node.removeEventListener('focusin', handleFocusIn);
      node.removeEventListener('focusout', handleFocusOut);
    };
  }, [gridSize, slideByDirection, isOverlayOpen, dialogOpen]);

  const tileEntries = useMemo(() => {
    const entries: Array<{ value: number; index: number }> = [];
    for (let i = 0; i < board.length; i++) {
      const value = board[i];
      if (value !== BLANK_TILE) {
        entries.push({ value, index: i });
      }
    }
    entries.sort((a, b) => a.value - b.value);
    return entries;
  }, [board]);

  return (
    <View style={styles.container}>
      <View
        ref={boardDomRef}
        testID="puzzle-board"
        accessible={false}
        accessibilityLabel={`${gridSize} by ${gridSize} sliding puzzle board. Use arrow keys to slide a tile into the gap.`}
        style={[
          styles.outerFrame,
          boardFocused && styles.outerFrameFocused,
          {
            width: outerBoardSize,
            height: outerBoardSize,
            backgroundColor: theme.frameOuter,
            borderTopColor: boardFocused ? COLORS.gold : theme.frameBevelLight,
            borderLeftColor: boardFocused ? COLORS.gold : theme.frameBevelLight,
            borderBottomColor: boardFocused ? COLORS.gold : theme.frameBevelDark,
            borderRightColor: boardFocused ? COLORS.gold : theme.frameBevelDark,
          },
        ]}
      >
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
                isMovable={canSlideTile(board, index, gridSize)}
                isHinted={activeHint?.tileValue === value}
                isIntroSuggested={introSuggestedIndex === index}
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

      {Platform.OS === 'web' ? (
        <Text style={styles.keyboardTip}>
          Keyboard: focus the board and press Arrow keys to slide a tile into the gap
        </Text>
      ) : null}
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
  outerFrameFocused: {
    shadowColor: COLORS.gold,
    shadowOpacity: 0.35,
  },
  cavity: {
    borderRadius: 14,
    padding: CAVITY_PADDING,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardTip: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
