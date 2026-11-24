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
import { COLORS } from '../theme/tokens';

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
 * Individual tactile sliding tile with smooth spring transitions,
 * first-move tutorial highlight, A* hint pulse, and full accessibility semantics.
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
    const fontSize = gridSize === 3 ? 34 : gridSize === 4 ? 26 : 20;

    const accessibilityLabel = `Tile ${tileValue}, row ${row + 1} column ${col + 1}${
      isHinted
        ? ', recommended hint move'
        : isIntroSuggested
        ? ', suggested first move'
        : isMovable
        ? ', movable'
        : ''
    }${isInCorrectSlot ? ', in correct position' : ''}`;

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
              borderRadius: gridSize === 5 ? 7 : 10,
              backgroundColor: isHinted
                ? COLORS.tileHintBg
                : isIntroSuggested && !imageUri
                ? '#FEF9C3'
                : isInCorrectSlot && !imageUri
                ? COLORS.tileCorrectBg
                : COLORS.tileFace,
              borderColor: isHinted
                ? COLORS.tileHintBorder
                : isIntroSuggested
                ? '#38BDF8'
                : isSolvedBoard
                ? COLORS.tileCorrectBorder
                : COLORS.tileShadow,
              borderWidth: highlighted ? 2.5 : 1.5,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <View style={styles.bevelHighlight} pointerEvents="none" />

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
            <View style={imageUri ? styles.photoBadge : undefined}>
              <Text
                style={[
                  styles.tileNumber,
                  {
                    fontSize: imageUri ? 12 : fontSize,
                    color: imageUri ? COLORS.textPrimary : COLORS.tileText,
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
            <View style={styles.tryBadge}>
              <Text style={styles.tryBadgeText}>TAP</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  bevelHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '40%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  tileNumber: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  photoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 19, 29, 0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  correctDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  tryBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tryBadgeText: {
    color: '#082F49',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hintArrowBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.gold,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintArrowText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
});
