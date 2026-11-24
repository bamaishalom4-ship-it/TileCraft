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
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

/**
 * Active Puzzle Gameplay Screen:
 * - Classic mode: Dusty cream, faded teal, and brick red arcade HUD (Boxing Gym palette)
 * - Photo mode: Sunset peach, dusty blue, and muted mauve HUD (Sunset Office palette)
 *   with the player's photo kept completely unfiltered and unpixelated
 * - Board remains the brightest, clearest focal point on screen (zero distracting animations)
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

  const isPhotoMode = Boolean(imageUri);

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

  const hudSurface = isPhotoMode ? COLORS.photoSurface : COLORS.classicSurface;
  const hudBorder = isPhotoMode ? PALETTE.dustyMauve : PALETTE.cityTeal;
  const hudAccent = isPhotoMode ? PALETTE.sunsetPeach : PALETTE.brickRed;

  return (
    <View style={styles.screen}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={handleBackToMenu}
          style={[
            styles.iconBtn,
            { backgroundColor: hudSurface, borderColor: hudBorder },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="chevron-back" size={20} color={PALETTE.cream} />
        </Pressable>

        <View style={styles.titleCenter}>
          <Text style={styles.puzzleTitle} numberOfLines={1}>
            {activePuzzleTitle.toUpperCase()}
          </Text>
          <Text
            style={[
              styles.gridBadgeText,
              { color: isPhotoMode ? PALETTE.sunsetPeach : PALETTE.dustyCream },
            ]}
          >
            {gridSize}×{gridSize} {imageUri ? 'PHOTO' : 'CLASSIC'}
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

      {/* First-Time Numbered Puzzle Goal Guide (readable sans-serif) */}
      {showFirstTimeGuide ? (
        <View style={styles.guideBanner}>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="sparkles" size={16} color={PALETTE.arcadeOrange} />
          </View>
          <Text style={styles.guideText}>
            Tap a tile next to the gap. Put the numbers in order, with the gap at the bottom right.
          </Text>
        </View>
      ) : null}

      {/* Stats Strip */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: hudSurface,
              borderColor: hudBorder,
              borderTopColor: hudAccent,
            },
          ]}
        >
          <Text
            style={[
              styles.statLabel,
              { color: isPhotoMode ? PALETTE.sunsetPeach : PALETTE.dustyCream },
            ]}
          >
            MOVES
          </Text>
          <Text style={styles.statValue} testID="moves-value">
            {moves}
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: hudSurface,
              borderColor: hudBorder,
              borderTopColor: hudAccent,
            },
          ]}
        >
          <Text
            style={[
              styles.statLabel,
              { color: isPhotoMode ? PALETTE.sunsetPeach : PALETTE.dustyCream },
            ]}
          >
            TIME
          </Text>
          <Text style={styles.statValue} testID="time-value">
            {formatElapsedTime(elapsedSeconds)}
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: hudSurface,
              borderColor: hudBorder,
              borderTopColor: hudAccent,
            },
          ]}
        >
          <Text
            style={[
              styles.statLabel,
              { color: isPhotoMode ? PALETTE.sunsetPeach : PALETTE.dustyCream },
            ]}
          >
            PLACED
          </Text>
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
              style={[
                styles.toolChip,
                { backgroundColor: COLORS.photoSurfaceAlt },
              ]}
            >
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons
                  name="eye-outline"
                  size={16}
                  color={PALETTE.sunsetPeach}
                />
              </View>
              <Text style={styles.toolChipText}>PEEK TARGET</Text>
            </Pressable>

            <Pressable
              onPress={toggleTileNumbers}
              accessibilityRole="button"
              accessibilityLabel={`Tile numbers overlay, currently ${showTileNumbers ? 'on' : 'off'}`}
              accessibilityState={{ selected: showTileNumbers }}
              style={[
                styles.toolChip,
                { backgroundColor: COLORS.photoSurfaceAlt },
              ]}
            >
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons
                  name={showTileNumbers ? 'pricetag' : 'pricetag-outline'}
                  size={15}
                  color={
                    showTileNumbers ? PALETTE.arcadeOrange : PALETTE.sunsetPeach
                  }
                />
              </View>
              <Text style={styles.toolChipText}>
                NUMBERS: {showTileNumbers ? 'ON' : 'OFF'}
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
              { backgroundColor: hudSurface },
              status === 'solved' && styles.disabledBtn,
              pressed && styles.pressedBtn,
            ]}
          >
            <View style={styles.hintRow}>
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons name="bulb" size={16} color={PALETTE.arcadeOrange} />
              </View>
              <Text style={styles.hintBtnText}>
                {isFreeIntroHintAvailable ? 'FREE HINT' : 'HINT'}
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
              isPhotoMode ? styles.shuffleBtnPhoto : styles.shuffleBtnClassic,
              pressed && styles.pressedBtn,
            ]}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons
                name="shuffle"
                size={18}
                color={isPhotoMode ? PALETTE.ink : PALETTE.cream}
              />
            </View>
            <Text
              style={[
                styles.shuffleBtnText,
                { color: isPhotoMode ? PALETTE.ink : PALETTE.cream },
              ]}
            >
              SHUFFLE
            </Text>
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
            <Text style={styles.peekTitle}>TARGET IMAGE</Text>
            {imageUri ? (
              <View style={styles.peekImageFrame}>
                <Image source={{ uri: imageUri }} style={styles.peekImage} />
              </View>
            ) : null}
            <Text style={styles.peekHint}>
              Tap anywhere or press Esc to return
            </Text>
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
    paddingHorizontal: 14,
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
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
  },
  puzzleTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 19,
    letterSpacing: 0.8,
  },
  gridBadgeText: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    letterSpacing: 0.8,
  },
  guideBanner: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.cream,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  guideText: {
    flex: 1,
    color: PALETTE.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  statsRow: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 2,
    borderTopWidth: 3,
  },
  statLabel: {
    fontFamily: FONTS.pixel,
    fontSize: 13,
    letterSpacing: 0.8,
  },
  statValue: {
    color: PALETTE.cream,
    fontSize: 18,
    fontWeight: '900',
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
    gap: 8,
  },
  toolChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  toolChipText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBtn: {
    borderWidth: 2,
    borderColor: PALETTE.arcadeOrange,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.ink,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hintBtnText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 17,
    letterSpacing: 0.8,
  },
  hintCostText: {
    color: PALETTE.dustyCream,
    fontSize: 10,
    fontWeight: '700',
  },
  shuffleBtnClassic: {
    backgroundColor: PALETTE.brickRed,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.brickRedDark,
    flexDirection: 'row',
    gap: 7,
  },
  shuffleBtnPhoto: {
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.arcadeOrangeDeep,
    flexDirection: 'row',
    gap: 7,
  },
  shuffleBtnText: {
    fontFamily: FONTS.pixel,
    fontSize: 18,
    letterSpacing: 1,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  pressedBtn: {
    transform: [{ scale: 0.97 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 15, 22, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  peekCard: {
    backgroundColor: COLORS.cardStock,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 3,
    borderColor: PALETTE.ink,
  },
  peekTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 18,
    letterSpacing: 1,
  },
  peekImageFrame: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
  },
  peekImage: {
    width: 280,
    height: 280,
  },
  peekHint: {
    color: '#4E4B45',
    fontSize: 12,
    fontWeight: '600',
  },
});
