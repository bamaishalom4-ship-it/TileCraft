import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BLANK_TILE, type MoveDirection } from '../types/puzzle';
import { canSlideTile, indexToPosition } from '../engine/puzzleEngine';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { useDialogStore } from '../store/useDialogStore';
import { FRAME_THEMES, PALETTE } from '../theme/tokens';
import { PuzzleTile } from './PuzzleTile';

const FRAME_PADDING = 12;
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
 * Chunky 16-bit tactile sliding puzzle tray with touch/click sliding AND
 * focus-scoped Arrow-key movement on web/desktop keyboards.
 * - Classic boards use the faded teal / dusty cream / brick red gym palette.
 * - Photo boards use Sunset Office mauve/peach tray accents (when on default frame)
 *   while leaving the player's image completely unfiltered and unpixelated.
 * - Empty slot is rendered with a recessed marker so the gap is unmistakable.
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

  const isPhotoMode = Boolean(imageUri);
  const baseTheme = FRAME_THEMES[frameThemeId];
  const theme =
    isPhotoMode && frameThemeId === 'classic-black'
      ? {
          ...baseTheme,
          frameOuter: '#5D4C66',
          frameBevelLight: PALETTE.sunsetPeach,
          frameBevelDark: '#261E2E',
          cavityBg: PALETTE.ink,
          cavityBorder: '#0B0D12',
          accent: PALETTE.sunsetPeach,
        }
      : baseTheme;

  // Responsive board clamp that fits cleanly on narrow phones (320x568, 375x667) and desktop
  const outerBoardSize = Math.min(
    screenWidth - 28,
    Math.max(252, screenHeight - 296),
    404
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

  const { tileEntries, blankIndex } = useMemo(() => {
    const entries: Array<{ value: number; index: number }> = [];
    let gapIdx = -1;
    for (let i = 0; i < board.length; i++) {
      const value = board[i];
      if (value === BLANK_TILE) {
        gapIdx = i;
      } else {
        entries.push({ value, index: i });
      }
    }
    entries.sort((a, b) => a.value - b.value);
    return { tileEntries: entries, blankIndex: gapIdx };
  }, [board]);

  const blankPos =
    blankIndex >= 0 ? indexToPosition(blankIndex, gridSize) : null;

  return (
    <View style={styles.container}>
      {/* Hard ink outer arcade tray shell */}
      <View
        style={[
          styles.inkShell,
          boardFocused && styles.inkShellFocused,
        ]}
      >
        <View
          ref={boardDomRef}
          testID="puzzle-board"
          accessible={false}
          accessibilityLabel={`${gridSize} by ${gridSize} sliding puzzle board. Use arrow keys to slide a tile into the gap.`}
          style={[
            styles.outerFrame,
            {
              width: outerBoardSize,
              height: outerBoardSize,
              backgroundColor: theme.frameOuter,
              borderTopColor: boardFocused
                ? PALETTE.arcadeOrange
                : theme.frameBevelLight,
              borderLeftColor: boardFocused
                ? PALETTE.arcadeOrange
                : theme.frameBevelLight,
              borderBottomColor: boardFocused
                ? PALETTE.arcadeOrange
                : theme.frameBevelDark,
              borderRightColor: boardFocused
                ? PALETTE.arcadeOrange
                : theme.frameBevelDark,
            },
          ]}
        >
          {/* Subtle chunky corner accent rivets */}
          <View
            style={[styles.cornerPin, styles.pinTL, { backgroundColor: theme.accent }]}
            pointerEvents="none"
          />
          <View
            style={[styles.cornerPin, styles.pinTR, { backgroundColor: theme.accent }]}
            pointerEvents="none"
          />
          <View
            style={[styles.cornerPin, styles.pinBL, { backgroundColor: theme.accent }]}
            pointerEvents="none"
          />
          <View
            style={[styles.cornerPin, styles.pinBR, { backgroundColor: theme.accent }]}
            pointerEvents="none"
          />

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
              {/* Recessed empty gap marker so the open slot is immediately obvious */}
              {blankPos ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.emptySlotWell,
                    {
                      left: blankPos.col * cellSize + TILE_GAP / 2,
                      top: blankPos.row * cellSize + TILE_GAP / 2,
                      width: cellSize - TILE_GAP,
                      height: cellSize - TILE_GAP,
                      borderColor: isPhotoMode ? '#4F405B' : '#2C4952',
                      backgroundColor: '#0F1117',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.emptySlotInner,
                      { borderColor: isPhotoMode ? '#3A2E44' : '#1F343B' },
                    ]}
                  />
                </View>
              ) : null}

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
      </View>

      {Platform.OS === 'web' ? (
        <Text
          style={[
            styles.keyboardTip,
            isPhotoMode && styles.keyboardTipPhoto,
          ]}
        >
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
  inkShell: {
    borderRadius: 14,
    padding: 3,
    backgroundColor: PALETTE.ink,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 10,
  },
  inkShellFocused: {
    backgroundColor: PALETTE.arcadeOrange,
  },
  outerFrame: {
    borderRadius: 11,
    padding: FRAME_PADDING,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cornerPin: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: PALETTE.ink,
  },
  pinTL: { top: 4, left: 4 },
  pinTR: { top: 4, right: 4 },
  pinBL: { bottom: 4, left: 4 },
  pinBR: { bottom: 4, right: 4 },
  cavity: {
    borderRadius: 8,
    padding: CAVITY_PADDING,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotWell: {
    position: 'absolute',
    borderRadius: 7,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotInner: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
  },
  keyboardTip: {
    color: '#A7C3C8',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  keyboardTipPhoto: {
    color: '#C7B8CC',
  },
});
