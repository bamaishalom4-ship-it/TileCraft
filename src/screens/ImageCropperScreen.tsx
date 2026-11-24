import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
 * - Drag (pan) the photo inside the square crop viewport
 * - Zoom in/out (1.0x – 3.0x) and rotate in 90° increments
 * - Toggle live 3×3 / 4×4 / 5×5 cut lines to see exact tile boundaries before playing
 * - Crops & normalizes output to 1024×1024 JPEG via `expo-image-manipulator`
 */
export const ImageCropperScreen: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const viewportSize = Math.min(screenWidth - 40, 340);

  const asset = useAppStore((s) => s.pendingCropAsset);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const navigate = useAppStore((s) => s.navigate);
  const addCustomPuzzle = useAppStore((s) => s.addCustomPuzzle);
  const setActivePuzzleMeta = useAppStore((s) => s.setActivePuzzleMeta);

  const setGridSize = usePuzzleStore((s) => s.setGridSize);
  const setImageUri = usePuzzleStore((s) => s.setImageUri);
  const shuffle = usePuzzleStore((s) => s.shuffle);

  const [title, setTitle] = useState('My Custom Puzzle');
  const [selectedGrid, setSelectedGrid] = useState<GridSize>(4);
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
      addCustomPuzzle({
        id: `local_${Date.now()}`,
        title: cleanTitle,
        imageUri: croppedUri,
        preferredGridSize: selectedGrid,
        createdAt: new Date().toISOString(),
        isLocalUpload: true,
      });

      setGridSize(selectedGrid);
      setImageUri(croppedUri);
      shuffle();
      setActivePuzzleMeta(cleanTitle, true);
      navigate('game');
    } catch {
      Alert.alert(
        'Crop Failed',
        'Could not process this image. Please try another photo.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const gridLines = Array.from({ length: selectedGrid - 1 }, (_, i) => i + 1);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigate('menu')} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Crop 1:1 Puzzle</Text>
        <Pressable onPress={handleResetCrop} style={styles.resetPill}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

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

        {/* Non-interactive Grid Cut Lines Overlay */}
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
          {/* Bottom-right cavity preview badge */}
          <View
            style={[
              styles.blankPreview,
              {
                width: `${100 / selectedGrid}%`,
                height: `${100 / selectedGrid}%`,
              },
            ]}
          >
            <Text style={styles.blankPreviewText}>OPEN</Text>
          </View>
        </View>
      </View>

      <Text style={styles.dragTip}>Drag photo to position · Use controls to zoom</Text>

      {/* Zoom & Rotate Controls */}
      <View style={styles.toolsRow}>
        <Pressable
          onPress={() => adjustZoom(-ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          style={[styles.toolBtn, zoom <= ZOOM_MIN && styles.toolDisabled]}
        >
          <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
        </Pressable>

        <View style={styles.zoomReadout}>
          <Text style={styles.zoomText}>{zoom.toFixed(2)}×</Text>
        </View>

        <Pressable
          onPress={() => adjustZoom(ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          style={[styles.toolBtn, zoom >= ZOOM_MAX && styles.toolDisabled]}
        >
          <Ionicons name="add" size={20} color={COLORS.textPrimary} />
        </Pressable>

        <Pressable onPress={handleRotate} style={styles.rotateBtn}>
          <Ionicons name="refresh-outline" size={18} color={COLORS.textPrimary} />
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
          maxLength={32}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>PREVIEW GRID SIZE</Text>
        <View style={styles.gridRow}>
          {([3, 4, 5] as GridSize[]).map((size) => {
            const unlocked = unlockedGridSizes.includes(size);
            const active = selectedGrid === size;
            return (
              <Pressable
                key={size}
                onPress={() => {
                  if (!unlocked) {
                    Alert.alert(
                      '5×5 Locked',
                      'Unlock 5×5 Master Grid in the Shop to play 5×5 custom puzzles.'
                    );
                    return;
                  }
                  setSelectedGrid(size);
                }}
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

      {/* Confirm & Play Button */}
      <Pressable
        onPress={handleConfirmCrop}
        disabled={processing}
        style={({ pressed }) => [
          styles.confirmBtn,
          pressed && styles.pressed,
        ]}
      >
        {processing ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <>
            <Ionicons name="crop" size={19} color="#111827" />
            <Text style={styles.confirmBtnText}>Crop & Play Puzzle</Text>
          </>
        )}
      </Pressable>
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
    paddingVertical: 12,
    alignItems: 'center',
    gap: 14,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  resetPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  cropViewport: {
    borderRadius: 18,
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
  dragTip: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  toolsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomReadout: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rotateBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
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
    fontSize: 13,
    fontWeight: '700',
  },
  toolDisabled: {
    opacity: 0.45,
  },
  formCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
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
    height: 44,
    borderRadius: 12,
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
    height: 40,
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
  confirmBtn: {
    width: '100%',
    height: 54,
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
