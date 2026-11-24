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
import { evaluateDailyStreak } from '../utils/economyUtils';
import { COLORS, FRAME_THEMES } from '../theme/tokens';

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
 * TileCraft Home Screen:
 * - Player-facing copy & prominent primary play actions above the fold on mobile
 * - Resume active saved game with overwrite protection before starting a new game
 * - Quick 3x3 launch, Make a photo puzzle (private on device), & direct size/frame controls
 * - Daily login streak & install prompt placed cleanly below primary play actions
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
          'Unlock Crimson, Sunburst, and Cobalt vintage trays in the Shop for 100 coins!',
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

  const currentTheme = FRAME_THEMES[frameTheme];
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
      {/* Top Bar: Brand + Coins */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.miniLogoFrame,
              { backgroundColor: currentTheme.frameOuter },
            ]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <View style={styles.miniLogoGrid}>
              <View style={styles.miniTile} />
              <View style={styles.miniTileGold} />
              <View style={styles.miniTile} />
              <View style={styles.miniBlank} />
            </View>
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandTitle} accessibilityRole="header">
              TileCraft
            </Text>
            <Text style={styles.brandTagline}>
              Turn any photo into a sliding puzzle.
            </Text>
          </View>
        </View>

        <CoinBadge
          coins={coins}
          loading={!economyHydrated}
          onPress={() => navigate('shop')}
        />
      </View>

      {/* Resume Active Game Card (shown whenever a valid unfinished save exists) */}
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
              <Ionicons name="play-circle" size={26} color="#10B981" />
            </View>
          )}
          <View style={styles.resumeTextWrap}>
            <Text style={styles.resumeEyebrow}>IN PROGRESS</Text>
            <Text style={styles.resumeTitle} numberOfLines={1}>
              Resume puzzle · {savedActiveGame.puzzleTitle}
            </Text>
            <Text style={styles.resumeMeta}>
              {savedActiveGame.gridSize}×{savedActiveGame.gridSize} ·{' '}
              {savedActiveGame.moves} moves ·{' '}
              {formatElapsedTime(savedActiveGame.elapsedSeconds)}
            </Text>
          </View>
          <View style={styles.resumePill}>
            <Text style={styles.resumePillText}>
              {resuming ? '...' : 'Resume'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Primary Play Actions (Always above the fold at 375×667) */}
      <View style={styles.primaryStack}>
        <Pressable
          onPress={handlePlayQuick3x3}
          accessibilityRole="button"
          accessibilityLabel="Play a quick 3 by 3 puzzle"
          style={({ pressed }) => [
            styles.primaryCta,
            pressed && styles.pressedScale,
          ]}
        >
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="play" size={20} color="#111827" />
          </View>
          <View style={styles.ctaTextGroup}>
            <Text style={styles.primaryCtaText}>Play a quick puzzle</Text>
            <Text style={styles.primaryCtaSub}>Starts a 3×3 board right away</Text>
          </View>
        </Pressable>

        <Pressable
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
            style={styles.featureIconWrap}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="images" size={22} color={COLORS.gold} />
          </View>
          <View style={styles.featureTextWrap}>
            <Text style={styles.featureTitle}>
              {picking ? 'Opening Photos...' : 'Make a photo puzzle'}
            </Text>
            <Text style={styles.featureSubtitle}>
              Crop any photo into tiles. Stays private on your device.
            </Text>
          </View>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </View>
        </Pressable>
      </View>

      {/* Direct Board Size & Frame Controls (no extra menus needed) */}
      <View style={styles.heroCard}>
        <View style={styles.boardHeaderRow}>
          <Text style={styles.sectionEyebrow}>CHOOSE BOARD SIZE</Text>
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
              Play {gridSize}×{gridSize} →
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
                        size={13}
                        color={COLORS.gold}
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
                  {unlocked ? opt.sub : '150 ¢'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.framePickerRow}>
          <Text style={styles.framePickerLabel}>Tray Frame</Text>
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
                      <Ionicons name="lock-closed" size={11} color="#F8FAFC" />
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
          <Ionicons name="warning-outline" size={16} color={COLORS.gold} />
          <Text style={styles.warningText}>{storageWarning}</Text>
        </View>
      ) : null}

      {/* Saved Crafted Photo Puzzles (persisted in IndexedDB / device storage) */}
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
                  styles.customThumbCard,
                  pressed && styles.pressedScale,
                ]}
              >
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.customThumbImg}
                />
                <View style={styles.customThumbMeta}>
                  <Text style={styles.customThumbTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.customThumbSize}>
                    {item.preferredGridSize}×{item.preferredGridSize}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Secondary Destinations: Shop & Community Marketplace */}
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
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="cart" size={20} color={COLORS.gold} />
          </View>
          <Text style={styles.halfCardTitle}>Coin Shop</Text>
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
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="globe-outline" size={20} color="#38BDF8" />
          </View>
          <Text style={styles.halfCardTitle}>Marketplace</Text>
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
              <Ionicons name="flame" size={20} color={COLORS.gold} />
            </View>
            <View>
              <Text style={styles.dailyBannerTitle}>
                Day {streakStatus.nextClaimDay} Daily Reward Ready
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
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTextWrap: {
    flex: 1,
  },
  miniLogoFrame: {
    width: 42,
    height: 42,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  miniLogoGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  miniTile: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: COLORS.tileFace,
  },
  miniTileGold: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },
  miniBlank: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  brandTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTagline: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.55)',
  },
  resumeThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  resumeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTextWrap: {
    flex: 1,
    gap: 1,
  },
  resumeEyebrow: {
    color: '#6EE7B7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resumeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  resumeMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  resumePill: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resumePillText: {
    color: '#064E3B',
    fontSize: 12,
    fontWeight: '900',
  },
  primaryStack: {
    gap: 10,
  },
  primaryCta: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
  },
  ctaTextGroup: {
    alignItems: 'flex-start',
  },
  primaryCtaText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  primaryCtaSub: {
    color: '#451A03',
    fontSize: 11,
    fontWeight: '700',
  },
  photoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 13,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.42)',
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  featureSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  boardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  playSizeLink: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playSizeLinkText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '800',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridOption: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  gridOptionActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: COLORS.gold,
  },
  gridOptionLocked: {
    opacity: 0.8,
  },
  gridOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridOptionTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  gridOptionTitleActive: {
    color: COLORS.gold,
  },
  gridOptionSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  gridOptionSubActive: {
    color: '#FDE68A',
  },
  framePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  framePickerLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  frameSwatches: {
    flexDirection: 'row',
    gap: 10,
  },
  frameSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameSwatchSelected: {
    borderColor: COLORS.textPrimary,
    transform: [{ scale: 1.12 }],
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  warningText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 12,
  },
  librarySection: {
    gap: 8,
  },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryCount: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  libraryList: {
    gap: 10,
  },
  customThumbCard: {
    width: 118,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customThumbImg: {
    width: 118,
    height: 118,
  },
  customThumbMeta: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  customThumbTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  customThumbSize: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  dualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  halfCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  halfCardSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  dailyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  dailyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailyBannerTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  dailyBannerSub: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
  },
  claimPill: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  claimPillText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '900',
  },
  pressedScale: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
