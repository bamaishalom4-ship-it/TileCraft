import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PuzzleBoard } from '../components/PuzzleBoard';
import { CoinBadge } from '../components/CoinBadge';
import { MadeByKuboFooter } from '../components/MadeByKuboFooter';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { HINT_COIN_COST, useAppStore } from '../store/useAppStore';
import { showAppDialog } from '../store/useDialogStore';
import {
  countCorrectTiles,
  getAdjacentMovableIndices,
} from '../engine/puzzleEngine';
import { evaluateWinPerformance } from '../utils/imageCropUtils';
import { formatElapsedTime, usePuzzleTimer } from '../hooks/usePuzzleTimer';
import { COLORS } from '../theme/tokens';

/**
 * Active Puzzle Gameplay Screen:
 * - First-time numbered puzzle goal guidance + highlighted legal first move
 * - One free introductory hint (normal 25 ¢ price remains visible)
 * - Shuffle confirmation dialog when meaningful progress exists
 * - Escape-dismissible Peek Target modal + focus restoration
 * - Pause-safe active timer & idempotent Win Screen transition
 */
export const GameScreen: React.FC = () => {
  usePuzzleTimer();
  const [peekVisible, setPeekVisible] = useState(false);
  const winTriggeredRunRef = useRef<string | null>(null);
  const peekOpenerRef = useRef<HTMLElement | null>(null);

  const runId = usePuzzleStore((s) => s.runId);
  const mode = usePuzzleStore((s) => s.mode);
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
  const persistSnapshot = usePuzzleStore((s) => s.persistSnapshot);

  const economyHydrated = useAppStore((s) => s.economyHydrated);
  const coins = useAppStore((s) => s.coins);
  const activePuzzleTitle = useAppStore((s) => s.activePuzzleTitle);
  const isCustomPuzzle = useAppStore((s) => s.isCustomPuzzle);
  const hasCompletedFirstNumberedGame = useAppStore(
    (s) => s.hasCompletedFirstNumberedGame
  );
  const freeIntroHintUsed = useAppStore((s) => s.freeIntroHintUsed);

  const navigate = useAppStore((s) => s.navigate);
  const spendHintCoins = useAppStore((s) => s.spendHintCoins);
  const consumeFreeIntroHint = useAppStore((s) => s.consumeFreeIntroHint);
  const recordWin = useAppStore((s) => s.recordWin);

  // Escape dismissal & focus restoration for Peek Target modal
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (peekVisible) {
      peekOpenerRef.current = document.activeElement as HTMLElement | null;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPeekVisible(false);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    } else if (peekOpenerRef.current) {
      const el = peekOpenerRef.current;
      peekOpenerRef.current = null;
      if (typeof el.focus === 'function' && document.contains(el)) {
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [peekVisible]);

  // Transition to Win Screen once per unique runId when solved
  useEffect(() => {
    if (status === 'solved' && winTriggeredRunRef.current !== runId) {
      winTriggeredRunRef.current = runId;
      const { stars, coinsEarned } = evaluateWinPerformance(
        gridSize,
        moves,
        elapsedSeconds
      );

      const timer = setTimeout(() => {
        recordWin({
          runId,
          puzzleTitle: activePuzzleTitle,
          gridSize,
          moves,
          elapsedSeconds,
          stars,
          coinsEarned,
          imageUri,
          isCustomPuzzle,
        });
      }, 380);

      return () => clearTimeout(timer);
    }
  }, [
    status,
    runId,
    gridSize,
    moves,
    elapsedSeconds,
    activePuzzleTitle,
    imageUri,
    isCustomPuzzle,
    recordWin,
  ]);

  const showFirstTimeGuide =
    !hasCompletedFirstNumberedGame && mode === 'classic' && !imageUri;

  // Highlight one legal move on move 0 for first-time numbered puzzle players
  const introSuggestedIndex = useMemo(() => {
    if (!showFirstTimeGuide || moves > 0 || status === 'solved') return null;
    const legal = getAdjacentMovableIndices(board, gridSize);
    return legal.length > 0 ? legal[0] : null;
  }, [showFirstTimeGuide, moves, status, board, gridSize]);

  const isFreeIntroHintAvailable = !freeIntroHintUsed;

  const handleBackToMenu = async () => {
    await persistSnapshot();
    navigate('menu');
  };

  const handleUseHint = async () => {
    if (status === 'solved') return;

    if (isFreeIntroHintAvailable) {
      await consumeFreeIntroHint();
      requestHint();
      return;
    }

    const paid = await spendHintCoins();
    if (!paid) {
      showAppDialog({
        title: 'Not Enough Coins',
        message: `Hints cost ${HINT_COIN_COST} coins. Visit the Shop to claim your daily reward or earn more coins!`,
        actions: [
          { label: 'Cancel', style: 'cancel' },
          {
            label: 'Open Shop',
            style: 'primary',
            onPress: () => {
              persistSnapshot().catch(() => {});
              navigate('shop');
            },
          },
        ],
      });
      return;
    }

    requestHint();
  };

  const handleShufflePress = () => {
    if (moves > 0 && status === 'playing') {
      showAppDialog({
        title: 'Shuffle Board?',
        message: `You have made ${moves} ${moves === 1 ? 'move' : 'moves'} in ${formatElapsedTime(elapsedSeconds)}. Shuffling will reset this puzzle and discard your current progress.`,
        actions: [
          { label: 'Keep Playing', style: 'cancel' },
          {
            label: 'Shuffle',
            style: 'destructive',
            onPress: () => shuffle(),
          },
        ],
      });
      return;
    }

    shuffle();
  };

  const totalTiles = gridSize * gridSize - 1;
  const correctTiles = countCorrectTiles(board);

  return (
    <View style={styles.screen}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={handleBackToMenu}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
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

        <CoinBadge
          coins={coins}
          loading={!economyHydrated}
          onPress={() => {
            persistSnapshot().catch(() => {});
            navigate('shop');
          }}
        />
      </View>

      {/* First-Time Numbered Puzzle Goal Guide */}
      {showFirstTimeGuide ? (
        <View style={styles.guideBanner}>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="sparkles" size={16} color="#38BDF8" />
          </View>
          <Text style={styles.guideText}>
            Tap a tile next to the gap. Put the numbers in order, with the gap at the bottom right.
          </Text>
        </View>
      ) : null}

      {/* Stats Strip */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MOVES</Text>
          <Text style={styles.statValue} testID="moves-value">
            {moves}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TIME</Text>
          <Text style={styles.statValue} testID="time-value">
            {formatElapsedTime(elapsedSeconds)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>PLACED</Text>
          <Text style={styles.statValue}>
            {correctTiles}/{totalTiles}
          </Text>
        </View>
      </View>

      {/* Core Animated Sliding Board */}
      <PuzzleBoard
        introSuggestedIndex={introSuggestedIndex}
        isOverlayOpen={peekVisible}
      />

      {/* Bottom Gameplay Controls */}
      <View style={styles.controlsWrap}>
        {imageUri ? (
          <View style={styles.photoToolsRow}>
            <Pressable
              onPress={() => setPeekVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Peek at target image"
              style={styles.toolChip}
            >
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons
                  name="eye-outline"
                  size={16}
                  color={COLORS.textPrimary}
                />
              </View>
              <Text style={styles.toolChipText}>Peek Target</Text>
            </Pressable>

            <Pressable
              onPress={toggleTileNumbers}
              accessibilityRole="button"
              accessibilityLabel={`Tile numbers overlay, currently ${showTileNumbers ? 'on' : 'off'}`}
              accessibilityState={{ selected: showTileNumbers }}
              style={styles.toolChip}
            >
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons
                  name={showTileNumbers ? 'pricetag' : 'pricetag-outline'}
                  size={15}
                  color={showTileNumbers ? COLORS.gold : COLORS.textSecondary}
                />
              </View>
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
            accessibilityRole="button"
            accessibilityLabel={
              isFreeIntroHintAvailable
                ? `Use free introductory hint. Normally ${HINT_COIN_COST} coins`
                : `Use hint for ${HINT_COIN_COST} coins`
            }
            accessibilityState={{ disabled: status === 'solved' }}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.hintBtn,
              status === 'solved' && styles.disabledBtn,
              pressed && styles.pressedBtn,
            ]}
          >
            <View style={styles.hintRow}>
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons name="bulb" size={17} color={COLORS.gold} />
              </View>
              <Text style={styles.hintBtnText}>
                {isFreeIntroHintAvailable ? 'Free Hint' : 'Hint'}
              </Text>
            </View>
            <Text style={styles.hintCostText}>
              {isFreeIntroHintAvailable
                ? `1st free (then ${HINT_COIN_COST} ¢)`
                : `${HINT_COIN_COST} ¢`}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleShufflePress}
            accessibilityRole="button"
            accessibilityLabel="Shuffle board"
            style={({ pressed }) => [
              styles.actionBtn,
              styles.shuffleBtn,
              pressed && styles.pressedBtn,
            ]}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons name="shuffle" size={18} color="#111827" />
            </View>
            <Text style={styles.shuffleBtnText}>Shuffle</Text>
          </Pressable>
        </View>

        <MadeByKuboFooter variant="compact" />
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
          accessibilityViewIsModal
          accessibilityLabel="Close target image preview"
        >
          <View style={styles.peekCard}>
            <Text style={styles.peekTitle}>Target Image</Text>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.peekImage} />
            ) : null}
            <Text style={styles.peekHint}>Tap anywhere or press Esc to return</Text>
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
    paddingVertical: 10,
    gap: 8,
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
  guideBanner: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  guideText: {
    flex: 1,
    color: '#E0F2FE',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
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
    paddingVertical: 8,
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
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  controlsWrap: {
    width: '100%',
    maxWidth: 420,
    gap: 8,
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
    height: 52,
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
    fontSize: 14,
    fontWeight: '800',
  },
  hintCostText: {
    color: COLORS.textSecondary,
    fontSize: 10,
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
