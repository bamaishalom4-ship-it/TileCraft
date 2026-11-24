import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GridSize, MoveDirection } from '../types/puzzle';
import { getTileTargetPosition, indexToPosition } from '../engine/puzzleEngine';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

interface PuzzleTileProps {
  tileValue: number;
  currentIndex: number;
  gridSize: GridSize;
  cellSize: number;
  tileGap: number;
  boardInnerSize: number;
  isMovable: boolean;
  isHinted: boolean;
  isIntroSuggested: boolean;
  hintDirection: MoveDirection | null;
  isSolvedBoard: boolean;
  imageUri: string | null;
  showTileNumbers: boolean;
  onPress: (currentIndex: number) => void;
}

const DIRECTION_ARROWS: Record<MoveDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

/**
 * Individual tactile sliding tile:
 * - Classic mode: chunky dusty-cream block with crisp ink border, warm tactile lip,
 *   and bold high-contrast numerals readable at 3×3, 4×4, and 5×5.
 * - Photo mode: player's photo slice stays completely unfiltered and unpixelated.
 * - Preserves spring transitions, first-move tutorial highlight, A* hint pulse,
 *   and full accessibility semantics.
 */
export const PuzzleTile: React.FC<PuzzleTileProps> = React.memo(
  ({
    tileValue,
    currentIndex,
    gridSize,
    cellSize,
    tileGap,
    boardInnerSize,
    isMovable,
    isHinted,
    isIntroSuggested,
    hintDirection,
    isSolvedBoard,
    imageUri,
    showTileNumbers,
    onPress,
  }) => {
    const { row, col } = indexToPosition(currentIndex, gridSize);
    const targetX = col * cellSize;
    const targetY = row * cellSize;

    const translateX = useRef(new Animated.Value(targetX)).current;
    const translateY = useRef(new Animated.Value(targetY)).current;
    const pulse = useRef(new Animated.Value(1)).current;
    const isFirstMount = useRef(true);

    useEffect(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        translateX.setValue(targetX);
        translateY.setValue(targetY);
        return;
      }

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: targetX,
          tension: 230,
          friction: 22,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: targetY,
          tension: 230,
          friction: 22,
          useNativeDriver: true,
        }),
      ]).start();
    }, [targetX, targetY, translateX, translateY]);

    const highlighted = isHinted || isIntroSuggested;

    useEffect(() => {
      if (!highlighted) {
        pulse.setValue(1);
        return;
      }

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.94,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [highlighted, pulse]);

    const tileRenderSize = cellSize - tileGap;
    const isInCorrectSlot = currentIndex === tileValue - 1;
    const targetPos = getTileTargetPosition(tileValue, gridSize);
    const fontSize = gridSize === 3 ? 36 : gridSize === 4 ? 27 : 21;

    const accessibilityLabel = `Tile ${tileValue}, row ${row + 1} column ${col + 1}${
      isHinted
        ? ', recommended hint move'
        : isIntroSuggested
        ? ', suggested first move'
        : isMovable
        ? ', movable'
        : ''
    }${isInCorrectSlot ? ', in correct position' : ''}`;

    const borderColor = isHinted
      ? PALETTE.arcadeOrange
      : isIntroSuggested
      ? PALETTE.arcadeOrange
      : isSolvedBoard
      ? PALETTE.brickRed
      : PALETTE.ink;

    return (
      <Animated.View
        style={[
          styles.tileWrapper,
          {
            width: cellSize,
            height: cellSize,
            padding: tileGap / 2,
            transform: [{ translateX }, { translateY }, { scale: pulse }],
          },
        ]}
      >
        <Pressable
          onPress={() => onPress(currentIndex)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !isMovable || isSolvedBoard }}
          style={({ pressed }) => [
            styles.tileFace,
            {
              width: tileRenderSize,
              height: tileRenderSize,
              borderRadius: gridSize === 5 ? 6 : 8,
              backgroundColor: imageUri
                ? PALETTE.ink
                : isHinted
                ? COLORS.tileHintBg
                : isIntroSuggested
                ? '#FDE4BA'
                : isInCorrectSlot
                ? COLORS.tileCorrectBg
                : COLORS.tileFace,
              borderColor,
              borderWidth: highlighted ? 2.5 : 2,
              borderBottomWidth: imageUri ? 2 : 4,
              borderBottomColor: highlighted
                ? PALETTE.arcadeOrangeDeep
                : imageUri
                ? PALETTE.ink
                : '#BFA982',
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          {/* Crisp top tactile bevel ONLY on numbered Classic tiles (never over photos) */}
          {!imageUri ? (
            <View style={styles.bevelHighlight} pointerEvents="none" />
          ) : null}

          {imageUri ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image
                source={{ uri: imageUri }}
                resizeMode="cover"
                style={{
                  width: boardInnerSize,
                  height: boardInnerSize,
                  transform: [
                    { translateX: -targetPos.col * cellSize },
                    { translateY: -targetPos.row * cellSize },
                  ],
                }}
              />
            </View>
          ) : null}

          {(!imageUri || showTileNumbers) && (
            <View
              style={
                imageUri
                  ? styles.photoBadge
                  : isIntroSuggested && gridSize === 5
                  ? styles.numberLiftSmall
                  : undefined
              }
            >
              <Text
                style={[
                  styles.tileNumber,
                  {
                    fontSize: imageUri ? 12 : fontSize,
                    color: imageUri ? PALETTE.cream : COLORS.tileText,
                  },
                ]}
              >
                {tileValue}
              </Text>
            </View>
          )}

          {isInCorrectSlot && !highlighted && !imageUri && (
            <View style={styles.correctDot} />
          )}

          {isIntroSuggested && !isHinted && (
            <View
              style={[
                styles.tryBadge,
                gridSize === 5 && styles.tryBadgeCompact,
              ]}
            >
              <Text
                style={[
                  styles.tryBadgeText,
                  gridSize === 5 && styles.tryBadgeTextCompact,
                ]}
              >
                TAP
              </Text>
            </View>
          )}

          {isHinted && hintDirection && (
            <View style={styles.hintArrowBadge}>
              <Text style={styles.hintArrowText}>
                {DIRECTION_ARROWS[hintDirection]}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }
);

PuzzleTile.displayName = 'PuzzleTile';

const styles = StyleSheet.create({
  tileWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  tileFace: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bevelHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.tileHighlight,
  },
  tileNumber: {
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  photoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(22, 24, 32, 0.84)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PALETTE.cream,
  },
  correctDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: PALETTE.brickRed,
    borderWidth: 1,
    borderColor: PALETTE.ink,
  },
  tryBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: PALETTE.arcadeOrange,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
  },
  tryBadgeCompact: {
    bottom: 2,
    right: 2,
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderWidth: 1,
  },
  tryBadgeText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  tryBadgeTextCompact: {
    fontSize: 9,
    lineHeight: 11,
  },
  numberLiftSmall: {
    marginBottom: 9,
  },
  hintArrowBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: PALETTE.arcadeOrange,
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintArrowText: {
    color: PALETTE.ink,
    fontSize: 13,
    fontWeight: '900',
  },
});
