import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FrameThemeId, GridSize } from '../types/puzzle';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { useAppStore } from '../store/useAppStore';
import { showAppDialog } from '../store/useDialogStore';
import { pickImageFromGallery } from '../services/imageService';
import { formatElapsedTime } from '../hooks/usePuzzleTimer';
import { CoinBadge } from '../components/CoinBadge';
import { DailyRewardModal } from '../components/DailyRewardModal';
import { InstallPwaBanner } from '../components/InstallPwaBanner';
import { MadeByKuboFooter } from '../components/MadeByKuboFooter';
import { TileCraftWordmark } from '../components/TileCraftWordmark';
import { CityArcadeBackdrop } from '../components/CityArcadeBackdrop';
import { evaluateDailyStreak } from '../utils/economyUtils';
import { COLORS, FONTS, FRAME_THEMES, PALETTE } from '../theme/tokens';

const GRID_OPTIONS: Array<{ size: GridSize; label: string; sub: string }> = [
  { size: 3, label: '3×3', sub: 'Quick' },
  { size: 4, label: '4×4', sub: 'Classic' },
  { size: 5, label: '5×5', sub: 'Master' },
];

const THEME_IDS: FrameThemeId[] = [
  'classic-black',
  'arcade-red',
  'retro-yellow',
  'cobalt-blue',
];

/**
 * TileCraft Home Screen — 16-bit City Arcade visual refresh:
 * - Thin arcade cabinet border framing an original teal city street scene
 * - Oversized stepped TILECRAFT wordmark and bold arcade orange START button
 * - Easy-to-reach Photo Puzzle action and Resume banner when a save exists
 * - Collectible-card cream stock treatment for saved local photo puzzles
 * - All existing puzzle rules, pricing, storage, and accessibility intact
 */
export const MainMenuScreen: React.FC = () => {
  const [picking, setPicking] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [dailyModalOpen, setDailyModalOpen] = useState(false);

  const gridSize = usePuzzleStore((s) => s.gridSize);
  const frameTheme = usePuzzleStore((s) => s.frameTheme);
  const setGridSize = usePuzzleStore((s) => s.setGridSize);
  const setFrameTheme = usePuzzleStore((s) => s.setFrameTheme);
  const startNewGame = usePuzzleStore((s) => s.startNewGame);
  const restoreSavedGame = usePuzzleStore((s) => s.restoreSavedGame);

  const economyHydrated = useAppStore((s) => s.economyHydrated);
  const coins = useAppStore((s) => s.coins);
  const dailyStreak = useAppStore((s) => s.dailyStreak);
  const lastDailyClaimDate = useAppStore((s) => s.lastDailyClaimDate);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const unlockedAllFrames = useAppStore((s) => s.unlockedAllFrames);
  const customPuzzles = useAppStore((s) => s.customPuzzles);
  const storageWarning = useAppStore((s) => s.storageWarning);
  const savedActiveGame = useAppStore((s) => s.savedActiveGame);

  const navigate = useAppStore((s) => s.navigate);
  const openCropperWithAsset = useAppStore((s) => s.openCropperWithAsset);
  const setActivePuzzleMeta = useAppStore((s) => s.setActivePuzzleMeta);
  const resolveImageForSavedGame = useAppStore((s) => s.resolveImageForSavedGame);
  const clearSavedActiveGame = useAppStore((s) => s.clearSavedActiveGame);

  const streakStatus = evaluateDailyStreak(lastDailyClaimDate, dailyStreak);

  /**
   * Protects an in-progress saved game from being silently overwritten.
   */
  const confirmStartIfActiveSave = (onConfirmNew: () => void) => {
    if (savedActiveGame && savedActiveGame.moves > 0) {
      showAppDialog({
        title: 'Replace Unfinished Game?',
        message: `You have "${savedActiveGame.puzzleTitle}" (${savedActiveGame.gridSize}×${savedActiveGame.gridSize}, ${savedActiveGame.moves} moves, ${formatElapsedTime(savedActiveGame.elapsedSeconds)}) saved. Starting a new puzzle will replace it.`,
        actions: [
          {
            label: 'Resume Saved',
            style: 'default',
            onPress: () => {
              handleResumeSavedGame();
            },
          },
          {
            label: 'Start New',
            style: 'primary',
            onPress: () => {
              clearSavedActiveGame().catch(() => {});
              onConfirmNew();
            },
          },
        ],
      });
      return;
    }
    onConfirmNew();
  };

  const handleResumeSavedGame = async () => {
    if (!savedActiveGame || resuming) return;
    setResuming(true);
    try {
      const resolvedUri = await resolveImageForSavedGame(savedActiveGame);
      if (savedActiveGame.mode === 'photo' && !resolvedUri) {
        showAppDialog({
          title: 'Saved Photo Missing',
          message:
            'The saved photo for this puzzle could not be restored from device storage. You can start a fresh puzzle instead.',
          actions: [
            {
              label: 'Clear Save',
              style: 'primary',
              onPress: () => {
                clearSavedActiveGame().catch(() => {});
              },
            },
          ],
        });
        return;
      }

      restoreSavedGame(savedActiveGame, resolvedUri);
      setActivePuzzleMeta(
        savedActiveGame.puzzleTitle,
        savedActiveGame.mode === 'photo'
      );
      navigate('game');
    } finally {
      setResuming(false);
    }
  };

  const handlePlayQuick3x3 = () => {
    confirmStartIfActiveSave(() => {
      startNewGame({
        gridSize: 3,
        mode: 'classic',
        title: 'Quick 3×3',
        imageUri: null,
      });
      setActivePuzzleMeta('Quick 3×3', false);
      navigate('game');
    });
  };

  const handlePlaySelectedClassic = () => {
    confirmStartIfActiveSave(() => {
      const label =
        gridSize === 3
          ? 'Quick 3×3'
          : gridSize === 4
          ? 'Classic 4×4'
          : 'Master 5×5';
      startNewGame({
        gridSize,
        mode: 'classic',
        title: label,
        imageUri: null,
      });
      setActivePuzzleMeta(label, false);
      navigate('game');
    });
  };

  const handleSelectGridSize = (size: GridSize) => {
    if (!unlockedGridSizes.includes(size)) {
      showAppDialog({
        title: '5×5 Master Grid Locked',
        message: 'Unlock the 5×5 Master Grid in the Shop for 150 coins!',
        actions: [
          { label: 'Not Now', style: 'cancel' },
          {
            label: 'Open Shop',
            style: 'primary',
            onPress: () => navigate('shop'),
          },
        ],
      });
      return;
    }
    setGridSize(size);
  };

  const handleSelectFrame = (id: FrameThemeId) => {
    if (id !== 'classic-black' && !unlockedAllFrames) {
      showAppDialog({
        title: 'Retro Frame Pack Locked',
        message:
          'Unlock Brick Red, Sunset Peach, and Dusk Mauve trays in the Shop for 100 coins!',
        actions: [
          { label: 'Cancel', style: 'cancel' },
          {
            label: 'Open Shop',
            style: 'primary',
            onPress: () => navigate('shop'),
          },
        ],
      });
      return;
    }
    setFrameTheme(id);
  };

  const handleCreateCustomPuzzle = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await pickImageFromGallery();
      if (result.status === 'denied') {
        showAppDialog({
          title: 'Photo Permission Needed',
          message:
            'Please allow photo library access so you can turn a photo into a sliding puzzle.',
        });
      } else if (result.status === 'picked' && result.asset) {
        openCropperWithAsset(result.asset);
      }
    } catch {
      showAppDialog({
        title: 'Could Not Open Photos',
        message: 'Please try selecting an image again.',
      });
    } finally {
      setPicking(false);
    }
  };

  const handlePlaySavedCustom = (
    id: string,
    title: string,
    imageUri: string,
    preferredSize: GridSize
  ) => {
    confirmStartIfActiveSave(() => {
      const sizeToUse = unlockedGridSizes.includes(preferredSize)
        ? preferredSize
        : 4;
      startNewGame({
        gridSize: sizeToUse,
        mode: 'photo',
        title,
        imageUri,
        craftedPuzzleId: id,
      });
      setActivePuzzleMeta(title, true);
      navigate('game');
    });
  };

  const savedThumbUri =
    savedActiveGame?.mode === 'photo'
      ? customPuzzles.find((p) => p.id === savedActiveGame.craftedPuzzleId)
          ?.imageUri ?? null
      : savedActiveGame?.remoteImageUrl ?? null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Compact Arcade Status Bar */}
      <View style={styles.topUtilityBar}>
        <View style={styles.arcadeTag}>
          <View style={styles.arcadeTagDot} />
          <Text style={styles.arcadeTagText}>SLIDING PUZZLE ARCADE</Text>
        </View>

        <CoinBadge
          coins={coins}
          loading={!economyHydrated}
          onPress={() => navigate('shop')}
        />
      </View>

      {/* 16-Bit City Arcade Cabinet Hero */}
      <View style={styles.cabinetOuter} testID="arcade-hero-cabinet">
        <View style={styles.cabinetInner}>
          {/* Pixel-Art City Street Scene */}
          <View style={styles.sceneStage}>
            <CityArcadeBackdrop />

            {/* Subtle top decorative pixel trim */}
            <View
              style={styles.cabinetCornerRow}
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <View style={styles.cornerPixel} />
              <View style={styles.cornerLine} />
              <View style={styles.cornerPixel} />
            </View>

            {/* Oversized Stepped Orange TILECRAFT Wordmark */}
            <View style={styles.wordmarkContainer}>
              <TileCraftWordmark maxWidth={388} />
            </View>

            {/* Spacer so the pixel skyline & lit storefront windows stay clearly visible */}
            <View style={styles.sceneWindowSpacer} />
          </View>

          {/* Dark Arcade Marquee Bar with Large START Button */}
          <View style={styles.cabinetFooter}>
            <Pressable
              testID="start-quick-puzzle-btn"
              onPress={handlePlayQuick3x3}
              accessibilityRole="button"
              accessibilityLabel="Start a quick 3 by 3 puzzle"
              style={({ pressed }) => [
                styles.startButton,
                pressed && styles.pressedScale,
              ]}
            >
              <View style={styles.startButtonInset}>
                <Text style={styles.startButtonLabel}>START</Text>
                <View style={styles.startSubBadge}>
                  <Text style={styles.startSubText}>QUICK 3×3</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Resume Active Game Banner (shown whenever a valid unfinished save exists) */}
      {savedActiveGame ? (
        <Pressable
          onPress={handleResumeSavedGame}
          disabled={resuming}
          accessibilityRole="button"
          accessibilityLabel={`Resume puzzle ${savedActiveGame.puzzleTitle}, ${savedActiveGame.gridSize} by ${savedActiveGame.gridSize}, ${savedActiveGame.moves} moves`}
          style={({ pressed }) => [
            styles.resumeCard,
            pressed && styles.pressedScale,
          ]}
        >
          {savedThumbUri ? (
            <Image source={{ uri: savedThumbUri }} style={styles.resumeThumb} />
          ) : (
            <View
              style={styles.resumeIconWrap}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons name="play" size={20} color={PALETTE.cream} />
            </View>
          )}
          <View style={styles.resumeTextWrap}>
            <Text style={styles.resumeEyebrow}>IN PROGRESS</Text>
            <Text style={styles.resumeTitle} numberOfLines={1}>
              Resume · {savedActiveGame.puzzleTitle}
            </Text>
            <Text style={styles.resumeMeta}>
              {savedActiveGame.gridSize}×{savedActiveGame.gridSize} ·{' '}
              {savedActiveGame.moves} moves ·{' '}
              {formatElapsedTime(savedActiveGame.elapsedSeconds)}
            </Text>
          </View>
          <View style={styles.resumePill}>
            <Text style={styles.resumePillText}>
              {resuming ? '...' : 'RESUME'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Secondary Primary Action: Make a Photo Puzzle (Sunset Office accent) */}
      <Pressable
        testID="make-photo-puzzle-btn"
        onPress={handleCreateCustomPuzzle}
        disabled={picking}
        accessibilityRole="button"
        accessibilityLabel="Make a photo puzzle from your device"
        style={({ pressed }) => [
          styles.photoCta,
          pressed && styles.pressedScale,
        ]}
      >
        <View
          style={styles.photoIconWrap}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Ionicons name="images" size={20} color={PALETTE.ink} />
        </View>
        <View style={styles.photoTextWrap}>
          <Text style={styles.photoTitle}>
            {picking ? 'OPENING PHOTOS...' : 'MAKE A PHOTO PUZZLE'}
          </Text>
          <Text style={styles.photoSubtitle}>
            Crop any photo into tiles. Stays private on your device.
          </Text>
        </View>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Ionicons name="chevron-forward" size={18} color={PALETTE.sunsetPeach} />
        </View>
      </Pressable>

      {/* Board Size & Tray Frame Panel (Dusty Teal / Cream / Brick accents) */}
      <View style={styles.controlPanel}>
        <View style={styles.boardHeaderRow}>
          <Text style={styles.sectionEyebrow}>BOARD SIZE</Text>
          <Pressable
            onPress={handlePlaySelectedClassic}
            accessibilityRole="button"
            accessibilityLabel={`Play ${gridSize} by ${gridSize} classic puzzle`}
            style={({ pressed }) => [
              styles.playSizeLink,
              pressed && styles.pressedScale,
            ]}
          >
            <Text style={styles.playSizeLinkText}>
              PLAY {gridSize}×{gridSize} →
            </Text>
          </Pressable>
        </View>

        <View style={styles.gridRow} accessibilityRole="radiogroup">
          {GRID_OPTIONS.map((opt) => {
            const unlocked = unlockedGridSizes.includes(opt.size);
            const selected = gridSize === opt.size;
            return (
              <Pressable
                key={opt.size}
                onPress={() => handleSelectGridSize(opt.size)}
                accessibilityRole="radio"
                accessibilityLabel={
                  unlocked
                    ? `${opt.label} ${opt.sub} board`
                    : `${opt.label} Master board, locked, 150 coins`
                }
                accessibilityState={{ selected, disabled: !unlocked }}
                style={[
                  styles.gridOption,
                  selected && styles.gridOptionActive,
                  !unlocked && styles.gridOptionLocked,
                ]}
              >
                <View style={styles.gridOptionHeader}>
                  <Text
                    style={[
                      styles.gridOptionTitle,
                      selected && styles.gridOptionTitleActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {!unlocked && (
                    <View
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                    >
                      <Ionicons
                        name="lock-closed"
                        size={12}
                        color={PALETTE.arcadeOrange}
                      />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.gridOptionSub,
                    selected && styles.gridOptionSubActive,
                  ]}
                >
                  {unlocked ? opt.sub.toUpperCase() : '150 ¢'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.framePickerRow}>
          <Text style={styles.framePickerLabel}>TRAY FRAME</Text>
          <View style={styles.frameSwatches} accessibilityRole="radiogroup">
            {THEME_IDS.map((id) => {
              const t = FRAME_THEMES[id];
              const locked = id !== 'classic-black' && !unlockedAllFrames;
              const selected = frameTheme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => handleSelectFrame(id)}
                  accessibilityRole="radio"
                  accessibilityLabel={
                    locked
                      ? `${t.label} frame, locked`
                      : `${t.label} frame`
                  }
                  accessibilityState={{ selected, disabled: locked }}
                  style={[
                    styles.frameSwatch,
                    { backgroundColor: t.frameOuter },
                    selected && styles.frameSwatchSelected,
                  ]}
                >
                  {locked && (
                    <View
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                    >
                      <Ionicons name="lock-closed" size={11} color={PALETTE.cream} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Storage Warning (if browser IndexedDB failed) */}
      {storageWarning ? (
        <View style={styles.warningCard} accessibilityRole="alert">
          <Ionicons name="warning-outline" size={16} color={PALETTE.arcadeOrange} />
          <Text style={styles.warningText}>{storageWarning}</Text>
        </View>
      ) : null}

      {/* Saved Crafted Photo Puzzles — Cream Card Stock Treatment */}
      {customPuzzles.length > 0 && (
        <View style={styles.librarySection}>
          <View style={styles.libraryHeader}>
            <Text style={styles.sectionEyebrow}>YOUR CRAFTED PUZZLES</Text>
            <Text style={styles.libraryCount}>
              {customPuzzles.length} saved locally
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.libraryList}
          >
            {customPuzzles.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  handlePlaySavedCustom(
                    item.id,
                    item.title,
                    item.imageUri,
                    item.preferredGridSize
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Play saved photo puzzle ${item.title}, ${item.preferredGridSize} by ${item.preferredGridSize}`}
                style={({ pressed }) => [
                  styles.customCardStock,
                  pressed && styles.pressedScale,
                ]}
              >
                <View style={styles.customCardHeader}>
                  <Text style={styles.customCardTitle} numberOfLines={1}>
                    {item.title.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.customThumbFrame}>
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.customThumbImg}
                  />
                </View>
                <View style={styles.customCardFooter}>
                  <View style={styles.customSizePill}>
                    <Text style={styles.customSizePillText}>
                      {item.preferredGridSize}×{item.preferredGridSize}
                    </Text>
                  </View>
                  <Text style={styles.customPlayTag}>PLAY</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Secondary Destinations: Shop & Marketplace (Night Bus Stop palette) */}
      <View style={styles.dualRow}>
        <Pressable
          onPress={() => navigate('shop')}
          accessibilityRole="button"
          accessibilityLabel="Open Coin Shop for upgrades, daily rewards, and packs"
          style={({ pressed }) => [
            styles.halfCard,
            pressed && styles.pressedScale,
          ]}
        >
          <View
            style={[styles.halfIconBox, { backgroundColor: '#3A2E47' }]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="cart" size={18} color={PALETTE.amberWindow} />
          </View>
          <Text style={styles.halfCardTitle}>COIN SHOP</Text>
          <Text style={styles.halfCardSub}>Unlocks & daily coins</Text>
        </Pressable>

        <Pressable
          onPress={() => navigate('marketplace')}
          accessibilityRole="button"
          accessibilityLabel="Open Community Marketplace"
          style={({ pressed }) => [
            styles.halfCard,
            pressed && styles.pressedScale,
          ]}
        >
          <View
            style={[styles.halfIconBox, { backgroundColor: '#243C4A' }]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="globe-outline" size={18} color={PALETTE.sunsetPeach} />
          </View>
          <Text style={styles.halfCardTitle}>MARKETPLACE</Text>
          <Text style={styles.halfCardSub}>Community puzzles</Text>
        </Pressable>
      </View>

      {/* Daily Streak & Install Banner (Placed below primary play actions) */}
      {economyHydrated && streakStatus.canClaimToday ? (
        <Pressable
          onPress={() => setDailyModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Claim Day ${streakStatus.nextClaimDay} daily reward of ${streakStatus.nextRewardCoins} coins`}
          style={({ pressed }) => [
            styles.dailyBanner,
            pressed && styles.pressedScale,
          ]}
        >
          <View style={styles.dailyBannerLeft}>
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons name="flame" size={20} color={PALETTE.arcadeOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyBannerTitle}>
                DAY {streakStatus.nextClaimDay} DAILY REWARD READY
              </Text>
              <Text style={styles.dailyBannerSub}>
                Claim +{streakStatus.nextRewardCoins} free coins
              </Text>
            </View>
          </View>
          <View style={styles.claimPill}>
            <Text style={styles.claimPillText}>CLAIM</Text>
          </View>
        </Pressable>
      ) : null}

      <InstallPwaBanner />

      <MadeByKuboFooter variant="full" />

      <DailyRewardModal
        visible={dailyModalOpen}
        onClose={() => setDailyModalOpen(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.nightBg,
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  topUtilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  arcadeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.nightSurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  arcadeTagDot: {
    width: 7,
    height: 7,
    backgroundColor: PALETTE.arcadeOrange,
  },
  arcadeTagText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  /* Thin Arcade Cabinet Border framing the Pixel City Hero */
  cabinetOuter: {
    backgroundColor: PALETTE.brickRed,
    padding: 3,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 0,
    elevation: 8,
  },
  cabinetInner: {
    backgroundColor: PALETTE.ink,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  sceneStage: {
    position: 'relative',
    width: '100%',
    minHeight: 204,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    justifyContent: 'space-between',
    backgroundColor: PALETTE.cityTealDark,
  },
  cabinetCornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cornerPixel: {
    width: 6,
    height: 6,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 1,
    borderColor: PALETTE.ink,
  },
  cornerLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(183, 74, 60, 0.75)',
  },
  wordmarkContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sceneWindowSpacer: {
    height: 112,
  },
  cabinetFooter: {
    backgroundColor: PALETTE.ink,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: PALETTE.brickRed,
  },
  startButton: {
    backgroundColor: PALETTE.arcadeOrange,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
    borderBottomWidth: 5,
    borderBottomColor: PALETTE.arcadeOrangeDeep,
    padding: 3,
  },
  startButtonInset: {
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: PALETTE.cream,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  startButtonLabel: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: 3,
    textShadowColor: PALETTE.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  startSubBadge: {
    backgroundColor: PALETTE.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PALETTE.cream,
  },
  startSubText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  /* Resume Active Game Card */
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3C42',
    borderRadius: 8,
    padding: 10,
    gap: 10,
    borderWidth: 2,
    borderColor: PALETTE.cityTeal,
  },
  resumeThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.cream,
  },
  resumeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: PALETTE.cityTeal,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTextWrap: {
    flex: 1,
    gap: 1,
  },
  resumeEyebrow: {
    fontFamily: FONTS.pixel,
    color: PALETTE.sunsetPeach,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  resumeTitle: {
    color: PALETTE.cream,
    fontSize: 14,
    fontWeight: '800',
  },
  resumeMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  resumePill: {
    backgroundColor: PALETTE.cream,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  resumePillText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 14,
    letterSpacing: 0.6,
  },

  /* Make a Photo Puzzle CTA (Sunset Office palette) */
  photoCta: {
    backgroundColor: COLORS.photoSurface,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 2,
    borderColor: PALETTE.dustyMauve,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.ink,
  },
  photoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: PALETTE.sunsetPeach,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTextWrap: {
    flex: 1,
    gap: 2,
  },
  photoTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 16,
    letterSpacing: 0.6,
  },
  photoSubtitle: {
    color: '#D8CDD9',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  /* Board Size & Tray Frame Panel */
  controlPanel: {
    backgroundColor: COLORS.classicSurface,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 2,
    borderColor: PALETTE.cityTeal,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.ink,
  },
  boardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 15,
    letterSpacing: 1,
  },
  playSizeLink: {
    backgroundColor: PALETTE.brickRed,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  playSizeLinkText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridOption: {
    flex: 1,
    backgroundColor: '#1A343B',
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  gridOptionActive: {
    backgroundColor: PALETTE.cream,
    borderColor: PALETTE.ink,
    borderBottomWidth: 4,
  },
  gridOptionLocked: {
    opacity: 0.78,
  },
  gridOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridOptionTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 19,
  },
  gridOptionTitleActive: {
    color: PALETTE.ink,
  },
  gridOptionSub: {
    fontFamily: FONTS.pixel,
    color: '#A5C1C6',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  gridOptionSubActive: {
    color: PALETTE.brickRed,
  },
  framePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  framePickerLabel: {
    fontFamily: FONTS.pixel,
    color: PALETTE.dustyCream,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  frameSwatches: {
    flexDirection: 'row',
    gap: 9,
  },
  frameSwatch: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameSwatchSelected: {
    borderWidth: 2.5,
    borderColor: PALETTE.arcadeOrange,
    transform: [{ scale: 1.08 }],
  },

  /* Storage Warning */
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3A2322',
    borderRadius: 8,
    padding: 10,
    borderWidth: 2,
    borderColor: PALETTE.brickRed,
  },
  warningText: {
    flex: 1,
    color: PALETTE.cream,
    fontSize: 12,
    lineHeight: 16,
  },

  /* Collectible Cards Visual Treatment for Saved Crafted Puzzles */
  librarySection: {
    gap: 8,
  },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  libraryList: {
    gap: 10,
    paddingRight: 8,
    paddingBottom: 4,
  },
  customCardStock: {
    width: 128,
    backgroundColor: COLORS.cardStock,
    borderRadius: 8,
    padding: 6,
    gap: 5,
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
    borderBottomWidth: 5,
  },
  customCardHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: PALETTE.ink,
    paddingBottom: 3,
  },
  customCardTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  customThumbFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.ink,
  },
  customThumbImg: {
    width: '100%',
    height: '100%',
  },
  customCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 1,
  },
  customSizePill: {
    backgroundColor: PALETTE.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customSizePillText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 12,
  },
  customPlayTag: {
    fontFamily: FONTS.pixel,
    color: PALETTE.brickRed,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  /* Secondary Destinations (Night Bus Stop palette) */
  dualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.nightSurface,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: '#3A3452',
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.ink,
  },
  halfIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  halfCardTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 16,
    letterSpacing: 0.6,
  },
  halfCardSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },

  /* Daily Reward Banner */
  dailyBanner: {
    backgroundColor: COLORS.nightSurfacePurple,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 2,
    borderColor: PALETTE.arcadeOrange,
  },
  dailyBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailyBannerTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  dailyBannerSub: {
    color: PALETTE.sunsetPeach,
    fontSize: 12,
    fontWeight: '600',
  },
  claimPill: {
    backgroundColor: PALETTE.arcadeOrange,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  claimPillText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  pressedScale: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
