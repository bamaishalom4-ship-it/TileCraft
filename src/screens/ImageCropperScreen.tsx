import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GridSize } from '../types/puzzle';
import { useAppStore } from '../store/useAppStore';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { showAppDialog } from '../store/useDialogStore';
import {
  clampCropOffsets,
  computeSquareCropRegion,
} from '../utils/imageCropUtils';
import { cropAndNormalizeSquareImage } from '../services/imageService';
import { COLORS } from '../theme/tokens';

const ZOOM_MIN = 1.0;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

/**
 * Interactive 1:1 Square Image Cropper & Grid Cut-Line Previewer:
 * - Sized responsively for 320×568, 375×667, and desktop so "Crop & Play" is always reachable
 * - Persists cropped photo durably in IndexedDB (web) / DocumentDirectory (native)
 * - Clearly informs the player that their photo stays private on this device
 */
export const ImageCropperScreen: React.FC = () => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Fit comfortably alongside controls even on 375×667 and 320×568 viewports
  const viewportSize = Math.max(
    180,
    Math.min(screenWidth - 44, Math.floor(screenHeight * 0.36), 300)
  );

  const asset = useAppStore((s) => s.pendingCropAsset);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const navigate = useAppStore((s) => s.navigate);
  const saveAndAddCraftedPuzzle = useAppStore((s) => s.saveAndAddCraftedPuzzle);
  const setActivePuzzleMeta = useAppStore((s) => s.setActivePuzzleMeta);

  const startNewGame = usePuzzleStore((s) => s.startNewGame);

  const [title, setTitle] = useState('My Custom Puzzle');
  const [selectedGrid, setSelectedGrid] = useState<GridSize>(3);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  zoomRef.current = zoom;

  const imageWidth = asset?.width ?? 1000;
  const imageHeight = asset?.height ?? 1000;

  const layout = useMemo(
    () =>
      clampCropOffsets({
        imageWidth,
        imageHeight,
        viewportSize,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      }),
    [imageWidth, imageHeight, viewportSize, zoom, offset.x, offset.y]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartOffsetRef.current = { ...offsetRef.current };
        },
        onPanResponderMove: (_evt, gestureState) => {
          const next = clampCropOffsets({
            imageWidth,
            imageHeight,
            viewportSize,
            zoom: zoomRef.current,
            offsetX: dragStartOffsetRef.current.x + gestureState.dx,
            offsetY: dragStartOffsetRef.current.y + gestureState.dy,
          });
          offsetRef.current = { x: next.offsetX, y: next.offsetY };
          setOffset({ x: next.offsetX, y: next.offsetY });
        },
      }),
    [imageWidth, imageHeight, viewportSize]
  );

  if (!asset) {
    return null;
  }

  const adjustZoom = (delta: number) => {
    const nextZoom = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, Number((zoom + delta).toFixed(2)))
    );
    const clamped = clampCropOffsets({
      imageWidth,
      imageHeight,
      viewportSize,
      zoom: nextZoom,
      offsetX: offset.x,
      offsetY: offset.y,
    });
    setZoom(nextZoom);
    offsetRef.current = { x: clamped.offsetX, y: clamped.offsetY };
    setOffset({ x: clamped.offsetX, y: clamped.offsetY });
  };

  const handleResetCrop = () => {
    setZoom(1);
    setRotation(0);
    offsetRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270));
  };

  const handleConfirmCrop = async () => {
    if (processing) return;
    setProcessing(true);

    try {
      const cropRect = computeSquareCropRegion({
        imageWidth,
        imageHeight,
        viewportSize,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      });

      const croppedUri = await cropAndNormalizeSquareImage(
        asset.uri,
        cropRect,
        rotation
      );

      const cleanTitle = title.trim() || 'Custom Puzzle';
      const saved = await saveAndAddCraftedPuzzle({
        title: cleanTitle,
        sourceImageUri: croppedUri,
        preferredGridSize: selectedGrid,
      });

      if (!saved.ok || !saved.item) {
        showAppDialog({
          title: 'Could Not Save Photo Puzzle',
          message:
            saved.error ??
            'Local storage is unavailable or full, so this photo could not be saved permanently.',
        });
        return;
      }

      startNewGame({
        gridSize: selectedGrid,
        mode: 'photo',
        title: saved.item.title,
        imageUri: saved.item.imageUri,
        craftedPuzzleId: saved.item.id,
      });
      setActivePuzzleMeta(saved.item.title, true);
      navigate('game');
    } catch {
      showAppDialog({
        title: 'Crop Failed',
        message: 'Could not process this image. Please try another photo.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const gridLines = Array.from({ length: selectedGrid - 1 }, (_, i) => i + 1);

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigate('menu')}
          accessibilityRole="button"
          accessibilityLabel="Cancel photo cropper"
          style={styles.iconBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Crop Photo Puzzle</Text>
        <Pressable
          onPress={handleResetCrop}
          accessibilityRole="button"
          accessibilityLabel="Reset crop position and zoom"
          style={styles.resetPill}
        >
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive Square Viewport with Live Tile Grid Overlay */}
        <View
          style={[
            styles.cropViewport,
            { width: viewportSize, height: viewportSize },
          ]}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri: asset.uri }}
            resizeMode="cover"
            style={{
              width: layout.renderedWidth,
              height: layout.renderedHeight,
              transform: [
                { translateX: layout.offsetX },
                { translateY: layout.offsetY },
                { rotate: `${rotation}deg` },
              ],
            }}
          />

          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {gridLines.map((line) => (
              <View
                key={`v-${line}`}
                style={[
                  styles.verticalLine,
                  { left: `${(line / selectedGrid) * 100}%` },
                ]}
              />
            ))}
            {gridLines.map((line) => (
              <View
                key={`h-${line}`}
                style={[
                  styles.horizontalLine,
                  { top: `${(line / selectedGrid) * 100}%` },
                ]}
              />
            ))}
            <View
              style={[
                styles.blankPreview,
                {
                  width: `${100 / selectedGrid}%`,
                  height: `${100 / selectedGrid}%`,
                },
              ]}
            >
              <Text style={styles.blankPreviewText}>GAP</Text>
            </View>
          </View>
        </View>

        {/* Zoom & Rotate Controls */}
        <View style={styles.toolsRow}>
          <Pressable
            onPress={() => adjustZoom(-ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            accessibilityState={{ disabled: zoom <= ZOOM_MIN }}
            style={[styles.toolBtn, zoom <= ZOOM_MIN && styles.toolDisabled]}
          >
            <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
          </Pressable>

          <View style={styles.zoomReadout}>
            <Text style={styles.zoomText}>{zoom.toFixed(2)}×</Text>
          </View>

          <Pressable
            onPress={() => adjustZoom(ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            accessibilityState={{ disabled: zoom >= ZOOM_MAX }}
            style={[styles.toolBtn, zoom >= ZOOM_MAX && styles.toolDisabled]}
          >
            <Ionicons name="add" size={18} color={COLORS.textPrimary} />
          </Pressable>

          <Pressable
            onPress={handleRotate}
            accessibilityRole="button"
            accessibilityLabel="Rotate photo 90 degrees"
            style={styles.rotateBtn}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={COLORS.textPrimary}
              />
            </View>
            <Text style={styles.rotateText}>Rotate</Text>
          </Pressable>
        </View>

        {/* Puzzle Title & Grid Preview Selector */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>PUZZLE TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Name your puzzle..."
            placeholderTextColor={COLORS.textMuted}
            accessibilityLabel="Custom puzzle title"
            maxLength={32}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>BOARD SIZE</Text>
          <View style={styles.gridRow} accessibilityRole="radiogroup">
            {([3, 4, 5] as GridSize[]).map((size) => {
              const unlocked = unlockedGridSizes.includes(size);
              const active = selectedGrid === size;
              return (
                <Pressable
                  key={size}
                  onPress={() => {
                    if (!unlocked) {
                      showAppDialog({
                        title: '5×5 Grid Locked',
                        message:
                          'Unlock the 5×5 Master Grid in the Shop to play 5×5 photo puzzles.',
                        actions: [
                          { label: 'OK', style: 'cancel' },
                          {
                            label: 'Open Shop',
                            style: 'primary',
                            onPress: () => navigate('shop'),
                          },
                        ],
                      });
                      return;
                    }
                    setSelectedGrid(size);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={
                    unlocked
                      ? `${size} by ${size} grid`
                      : `${size} by ${size} grid, locked`
                  }
                  accessibilityState={{ selected: active, disabled: !unlocked }}
                  style={[
                    styles.gridChip,
                    active && styles.gridChipActive,
                    !unlocked && styles.toolDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.gridChipText,
                      active && styles.gridChipTextActive,
                    ]}
                  >
                    {size}×{size} {!unlocked ? '🔒' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom CTA + Privacy Notice (always easy to reach on small phones) */}
      <View style={styles.footerBar}>
        <Text style={styles.privacyNote}>
          Stays private on your device unless you choose to publish it later.
        </Text>
        <Pressable
          onPress={handleConfirmCrop}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel="Crop and play puzzle"
          style={({ pressed }) => [
            styles.confirmBtn,
            pressed && styles.pressed,
          ]}
        >
          {processing ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <>
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <Ionicons name="crop" size={18} color="#111827" />
              </View>
              <Text style={styles.confirmBtnText}>Crop & Play</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  resetPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 10,
  },
  cropViewport: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#090B10',
    borderWidth: 2.5,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  blankPreview: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 19, 29, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankPreviewText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  toolsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomReadout: {
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rotateBtn: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rotateText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  toolDisabled: {
    opacity: 0.45,
  },
  formCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: COLORS.gold,
  },
  gridChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  gridChipTextActive: {
    color: COLORS.gold,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 6,
  },
  privacyNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  confirmBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
});
