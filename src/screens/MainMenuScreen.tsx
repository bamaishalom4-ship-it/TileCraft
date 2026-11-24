import React, { useState } from 'react';
import {
  Alert,
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
import { pickImageFromGallery } from '../services/imageService';
import { CoinBadge } from '../components/CoinBadge';
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
 * TileCraft Main Menu:
 * - Play Classic numbered boards (3x3, 4x4, 5x5)
 * - Pick & crop a custom gallery photo into a 1:1 sliding puzzle
 * - Replay saved local custom puzzles
 * - Access the Coin Shop & Phase 3 UGC Marketplace entry point
 */
export const MainMenuScreen: React.FC = () => {
  const [picking, setPicking] = useState(false);

  const gridSize = usePuzzleStore((s) => s.gridSize);
  const frameTheme = usePuzzleStore((s) => s.frameTheme);
  const setGridSize = usePuzzleStore((s) => s.setGridSize);
  const setFrameTheme = usePuzzleStore((s) => s.setFrameTheme);
  const setImageUri = usePuzzleStore((s) => s.setImageUri);
  const shuffle = usePuzzleStore((s) => s.shuffle);

  const coins = useAppStore((s) => s.coins);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const unlockedAllFrames = useAppStore((s) => s.unlockedAllFrames);
  const customPuzzles = useAppStore((s) => s.customPuzzles);
  const navigate = useAppStore((s) => s.navigate);
  const openCropperWithAsset = useAppStore((s) => s.openCropperWithAsset);
  const setActivePuzzleMeta = useAppStore((s) => s.setActivePuzzleMeta);

  const handleSelectGridSize = (size: GridSize) => {
    if (!unlockedGridSizes.includes(size)) {
      Alert.alert(
        '5×5 Master Grid Locked',
        'Unlock the 5×5 Master Grid in the Shop for 150 coins!',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Shop', onPress: () => navigate('shop') },
        ]
      );
      return;
    }
    setGridSize(size);
  };

  const handleSelectFrame = (id: FrameThemeId) => {
    if (id !== 'classic-black' && !unlockedAllFrames) {
      Alert.alert(
        'Retro Frame Pack Locked',
        'Unlock Crimson, Sunburst, and Cobalt vintage trays in the Shop for 100 coins!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Shop', onPress: () => navigate('shop') },
        ]
      );
      return;
    }
    setFrameTheme(id);
  };

  const handlePlayClassic = () => {
    setImageUri(null);
    shuffle();
    const label = gridSize === 3 ? '8-Puzzle' : gridSize === 4 ? 'Classic 15-Puzzle' : 'Master 24-Puzzle';
    setActivePuzzleMeta(label, false);
    navigate('game');
  };

  const handleCreateCustomPuzzle = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await pickImageFromGallery();
      if (result.status === 'denied') {
        Alert.alert(
          'Photo Permission Needed',
          'Please allow photo library access in Settings to craft custom sliding puzzles.'
        );
      } else if (result.status === 'picked' && result.asset) {
        openCropperWithAsset(result.asset);
      }
    } catch {
      Alert.alert('Could Not Open Gallery', 'Please try again.');
    } finally {
      setPicking(false);
    }
  };

  const handlePlaySavedCustom = (
    title: string,
    imageUri: string,
    preferredSize: GridSize
  ) => {
    const sizeToUse = unlockedGridSizes.includes(preferredSize) ? preferredSize : 4;
    setGridSize(sizeToUse);
    setImageUri(imageUri);
    shuffle();
    setActivePuzzleMeta(title, true);
    navigate('game');
  };

  const currentTheme = FRAME_THEMES[frameTheme];

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
          >
            <View style={styles.miniLogoGrid}>
              <View style={styles.miniTile} />
              <View style={styles.miniTile} />
              <View style={styles.miniTile} />
              <View style={styles.miniBlank} />
            </View>
          </View>
          <View>
            <Text style={styles.brandTitle}>TileCraft</Text>
            <Text style={styles.brandTagline}>Tactile Sliding Puzzle & UGC</Text>
          </View>
        </View>

        <CoinBadge coins={coins} onPress={() => navigate('shop')} />
      </View>

      {/* Hero Play Card */}
      <View style={styles.heroCard}>
        <Text style={styles.sectionEyebrow}>CHOOSE BOARD SIZE</Text>
        <View style={styles.gridRow}>
          {GRID_OPTIONS.map((opt) => {
            const unlocked = unlockedGridSizes.includes(opt.size);
            const selected = gridSize === opt.size;
            return (
              <Pressable
                key={opt.size}
                onPress={() => handleSelectGridSize(opt.size)}
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
                    <Ionicons
                      name="lock-closed"
                      size={14}
                      color={COLORS.gold}
                    />
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

        {/* Retro Molded Frame Picker */}
        <View style={styles.framePickerRow}>
          <Text style={styles.framePickerLabel}>Tray Frame</Text>
          <View style={styles.frameSwatches}>
            {THEME_IDS.map((id) => {
              const t = FRAME_THEMES[id];
              const locked = id !== 'classic-black' && !unlockedAllFrames;
              const selected = frameTheme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => handleSelectFrame(id)}
                  style={[
                    styles.frameSwatch,
                    { backgroundColor: t.frameOuter },
                    selected && styles.frameSwatchSelected,
                  ]}
                >
                  {locked && (
                    <Ionicons name="lock-closed" size={11} color="#F8FAFC" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Primary Play CTA */}
        <Pressable
          onPress={handlePlayClassic}
          style={({ pressed }) => [
            styles.primaryCta,
            pressed && styles.pressedScale,
          ]}
        >
          <Ionicons name="play" size={20} color="#111827" />
          <Text style={styles.primaryCtaText}>Play Classic {gridSize}×{gridSize}</Text>
        </Pressable>
      </View>

      {/* Create Custom Photo Puzzle Card */}
      <Pressable
        onPress={handleCreateCustomPuzzle}
        disabled={picking}
        style={({ pressed }) => [
          styles.featureCard,
          styles.photoCard,
          pressed && styles.pressedScale,
        ]}
      >
        <View style={styles.featureIconWrap}>
          <Ionicons name="images" size={24} color={COLORS.gold} />
        </View>
        <View style={styles.featureTextWrap}>
          <Text style={styles.featureTitle}>
            {picking ? 'Opening Gallery...' : 'Craft Custom Photo Puzzle'}
          </Text>
          <Text style={styles.featureSubtitle}>
            Pick any image, pan & zoom in our 1:1 square grid cropper, and play instantly.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </Pressable>

      {/* Secondary Actions: Shop & Marketplace */}
      <View style={styles.dualRow}>
        <Pressable
          onPress={() => navigate('shop')}
          style={({ pressed }) => [
            styles.halfCard,
            pressed && styles.pressedScale,
          ]}
        >
          <Ionicons name="cart" size={22} color={COLORS.gold} />
          <Text style={styles.halfCardTitle}>Coin Shop</Text>
          <Text style={styles.halfCardSub}>Packs, Daily & Unlocks</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert(
              'UGC Marketplace (Phase 3)',
              'Browse, download, and publish moderated community puzzles powered by Supabase — coming next in Phase 3!'
            )
          }
          style={({ pressed }) => [
            styles.halfCard,
            pressed && styles.pressedScale,
          ]}
        >
          <Ionicons name="globe-outline" size={22} color="#38BDF8" />
          <Text style={styles.halfCardTitle}>Marketplace</Text>
          <Text style={styles.halfCardSub}>Phase 3 Cloud UGC</Text>
        </Pressable>
      </View>

      {/* Player's Crafted Local Puzzles */}
      {customPuzzles.length > 0 && (
        <View style={styles.librarySection}>
          <Text style={styles.sectionEyebrow}>YOUR CRAFTED PUZZLES</Text>
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
                    item.title,
                    item.imageUri,
                    item.preferredGridSize
                  )
                }
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniLogoFrame: {
    width: 44,
    height: 44,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  miniLogoGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  miniTile: {
    width: 13,
    height: 13,
    borderRadius: 3,
    backgroundColor: COLORS.tileFace,
  },
  miniBlank: {
    width: 13,
    height: 13,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  brandTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  brandTagline: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionEyebrow: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridOption: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
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
    fontSize: 18,
    fontWeight: '900',
  },
  gridOptionTitleActive: {
    color: COLORS.gold,
  },
  gridOptionSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  gridOptionSubActive: {
    color: '#FDE68A',
  },
  framePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
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
  primaryCta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryCtaText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoCard: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  featureSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  dualRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  halfCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  halfCardSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  librarySection: {
    gap: 10,
  },
  libraryList: {
    gap: 12,
  },
  customThumbCard: {
    width: 124,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customThumbImg: {
    width: 124,
    height: 124,
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
  pressedScale: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
