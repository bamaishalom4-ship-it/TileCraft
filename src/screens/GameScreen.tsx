import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PuzzleBoard } from '../components/PuzzleBoard';
import { CoinBadge } from '../components/CoinBadge';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { HINT_COIN_COST, useAppStore } from '../store/useAppStore';
import { countCorrectTiles } from '../engine/puzzleEngine';
import { evaluateWinPerformance } from '../utils/imageCropUtils';
import { formatElapsedTime, usePuzzleTimer } from '../hooks/usePuzzleTimer';
import { COLORS } from '../theme/tokens';

/**
 * Active Puzzle Gameplay Screen:
 * - Navigation bar with Back, Puzzle Title, and live Coin Balance
 * - Live telemetry: Moves, Timer (MM:SS), and Placed tiles
 * - Tactile spring-animated PuzzleBoard
 * - Photo Reference Peek modal + Number Badge toggle (for custom photo puzzles)
 * - Coin-powered Hint button + Shuffle button
 * - Automatically transitions to WinScreen upon completion
 */
export const GameScreen: React.FC = () => {
  usePuzzleTimer();
  const [peekVisible, setPeekVisible] = useState(false);
  const winTriggeredRef = useRef(false);

  const gridSize = usePuzzleStore((s) => s.gridSize);
  const board = usePuzzleStore((s) => s.board);
  const moves = usePuzzleStore((s) => s.moves);
  const elapsedSeconds = usePuzzleStore((s) => s.elapsedSeconds);
  const status = usePuzzleStore((s) => s.status);
  const imageUri = usePuzzleStore((s) => s.imageUri);
  const showTileNumbers = usePuzzleStore((s) => s.showTileNumbers);
  const shuffle = usePuzzleStore((s) => s.shuffle);
  const requestHint = usePuzzleStore((s) => s.requestHint);
  const toggleTileNumbers = usePuzzleStore((s) => s.toggleTileNumbers);

  const coins = useAppStore((s) => s.coins);
  const activePuzzleTitle = useAppStore((s) => s.activePuzzleTitle);
  const isCustomPuzzle = useAppStore((s) => s.isCustomPuzzle);
  const navigate = useAppStore((s) => s.navigate);
  const spendCoins = useAppStore((s) => s.spendCoins);
  const recordWin = useAppStore((s) => s.recordWin);

  // Transition to Win Screen once when solved
  useEffect(() => {
    if (status === 'solved' && !winTriggeredRef.current) {
      winTriggeredRef.current = true;
      const { stars, coinsEarned } = evaluateWinPerformance(
        gridSize,
        moves,
        elapsedSeconds
      );

      const timer = setTimeout(() => {
        recordWin({
          puzzleTitle: activePuzzleTitle,
          gridSize,
          moves,
          elapsedSeconds,
          stars,
          coinsEarned,
          imageUri,
          isCustomPuzzle,
        });
      }, 450);

      return () => clearTimeout(timer);
    }

    if (status !== 'solved') {
      winTriggeredRef.current = false;
    }
  }, [
    status,
    gridSize,
    moves,
    elapsedSeconds,
    activePuzzleTitle,
    imageUri,
    isCustomPuzzle,
    recordWin,
  ]);

  const handleUseHint = () => {
    if (status === 'solved') return;

    if (!spendCoins(HINT_COIN_COST)) {
      Alert.alert(
        'Not Enough Coins',
        `Hints cost ${HINT_COIN_COST} coins. Visit the Shop to claim your daily reward or grab a coin pack!`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Shop', onPress: () => navigate('shop') },
        ]
      );
      return;
    }

    requestHint();
  };

  const totalTiles = gridSize * gridSize - 1;
  const correctTiles = countCorrectTiles(board);

  return (
    <View style={styles.screen}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={() => navigate('menu')}
          style={styles.iconBtn}
          accessibilityLabel="Back to Main Menu"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </Pressable>

        <View style={styles.titleCenter}>
          <Text style={styles.puzzleTitle} numberOfLines={1}>
            {activePuzzleTitle}
          </Text>
          <Text style={styles.gridBadgeText}>
            {gridSize}×{gridSize} {imageUri ? 'Photo' : 'Classic'}
          </Text>
        </View>

        <CoinBadge coins={coins} onPress={() => navigate('shop')} />
      </View>

      {/* Stats Strip */}
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

      {/* Core Animated Sliding Board */}
      <PuzzleBoard />

      {/* Bottom Gameplay Controls */}
      <View style={styles.controlsWrap}>
        {imageUri ? (
          <View style={styles.photoToolsRow}>
            <Pressable
              onPress={() => setPeekVisible(true)}
              style={styles.toolChip}
            >
              <Ionicons name="eye-outline" size={16} color={COLORS.textPrimary} />
              <Text style={styles.toolChipText}>Peek Target</Text>
            </Pressable>

            <Pressable onPress={toggleTileNumbers} style={styles.toolChip}>
              <Ionicons
                name={showTileNumbers ? 'pricetag' : 'pricetag-outline'}
                size={15}
                color={showTileNumbers ? COLORS.gold : COLORS.textSecondary}
              />
              <Text style={styles.toolChipText}>
                Numbers: {showTileNumbers ? 'On' : 'Off'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleUseHint}
            disabled={status === 'solved'}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.hintBtn,
              status === 'solved' && styles.disabledBtn,
              pressed && styles.pressedBtn,
            ]}
          >
            <View style={styles.hintRow}>
              <Ionicons name="bulb" size={17} color={COLORS.gold} />
              <Text style={styles.hintBtnText}>Hint</Text>
            </View>
            <Text style={styles.hintCostText}>{HINT_COIN_COST} ¢</Text>
          </Pressable>

          <Pressable
            onPress={shuffle}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.shuffleBtn,
              pressed && styles.pressedBtn,
            ]}
          >
            <Ionicons name="shuffle" size={18} color="#111827" />
            <Text style={styles.shuffleBtnText}>Shuffle</Text>
          </Pressable>
        </View>
      </View>

      {/* Reference Target Image Peek Modal */}
      <Modal
        visible={peekVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPeekVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPeekVisible(false)}
        >
          <View style={styles.peekCard}>
            <Text style={styles.peekTitle}>Target Image</Text>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.peekImage} />
            ) : null}
            <Text style={styles.peekHint}>Tap anywhere to return</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
  },
  puzzleTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  gridBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 9,
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
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  controlsWrap: {
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  photoToolsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toolChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toolChipText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hintBtnText: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  hintCostText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  shuffleBtn: {
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    gap: 6,
  },
  shuffleBtnText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledBtn: {
    opacity: 0.45,
  },
  pressedBtn: {
    transform: [{ scale: 0.97 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  peekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  peekTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  peekImage: {
    width: 280,
    height: 280,
    borderRadius: 14,
  },
  peekHint: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
