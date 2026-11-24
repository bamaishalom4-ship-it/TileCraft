import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GridSize } from '../types/puzzle';
import {
  PUZZLE_CATEGORIES,
  type MarketplacePuzzle,
  type PuzzleCategory,
} from '../types/marketplace';
import { publishPuzzleToMarketplace } from '../services/marketplaceService';
import { calculateCreatorRoyalty } from '../utils/marketplaceUtils';
import { showAppDialog } from '../store/useDialogStore';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

const PRICE_PRESETS = [0, 15, 25, 50];

interface PublishPuzzleModalProps {
  visible: boolean;
  localImageUri: string | null;
  initialTitle?: string;
  initialGridSize?: GridSize;
  onClose: () => void;
  onPublished?: (puzzle: MarketplacePuzzle) => void;
}

/**
 * Explicit public-upload modal for sharing a private local photo puzzle
 * to the public Marketplace. Requires deliberate confirmation before uploading.
 */
export const PublishPuzzleModal: React.FC<PublishPuzzleModalProps> = ({
  visible,
  localImageUri,
  initialTitle = 'My TileCraft Puzzle',
  initialGridSize = 4,
  onClose,
  onPublished,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState<PuzzleCategory>('Art');
  const [gridSize, setGridSize] = useState<GridSize>(initialGridSize);
  const [coinPrice, setCoinPrice] = useState<number>(25);
  const [confirmedPublic, setConfirmedPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setGridSize(initialGridSize);
    setConfirmedPublic(false);
  }, [initialTitle, initialGridSize, visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (visible) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !submitting) {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    } else if (previousFocusRef.current) {
      const el = previousFocusRef.current;
      previousFocusRef.current = null;
      if (typeof el.focus === 'function' && document.contains(el)) {
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [visible, submitting, onClose]);

  if (!localImageUri) return null;

  const royalty = calculateCreatorRoyalty(coinPrice);

  const handlePublish = async () => {
    if (!confirmedPublic) {
      showAppDialog({
        title: 'Confirmation Required',
        message:
          'Please confirm that you want to upload this photo publicly and that it follows our safe-for-work guidelines.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await publishPuzzleToMarketplace({
        localImageUri,
        title,
        category,
        recommendedGridSize: gridSize,
        coinPrice,
      });

      if (!result.ok) {
        showAppDialog({ title: 'Upload Not Completed', message: result.message });
        return;
      }

      if (result.puzzle && onPublished) {
        onPublished(result.puzzle);
      }

      onClose();
      showAppDialog({
        title:
          result.moderationStatus === 'approved'
            ? 'Published Live!'
            : 'Submitted for Review',
        message: result.message,
        actions: [{ label: 'Done', style: 'primary' }],
      });
    } catch (err) {
      showAppDialog({
        title: 'Upload Error',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to upload puzzle right now.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>PUBLISH TO MARKETPLACE</Text>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Close publish dialog"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color={PALETTE.cream} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.privacyCallout}>
              <Ionicons name="globe-outline" size={16} color={PALETTE.sunsetPeach} />
              <Text style={styles.privacyCalloutText}>
                Private photo puzzles stay on your device. Publishing uploads a copy publicly for other players.
              </Text>
            </View>

            <View style={styles.topPreview}>
              <Image source={{ uri: localImageUri }} style={styles.thumb} />
              <View style={styles.titleInputWrap}>
                <Text style={styles.label}>PUZZLE TITLE</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter a catchy title..."
                  placeholderTextColor={COLORS.textMuted}
                  accessibilityLabel="Puzzle title"
                  maxLength={40}
                  style={styles.input}
                />
                <Text style={styles.royaltyHint}>
                  {coinPrice > 0
                    ? `You earn +${royalty} ¢ royalty per download`
                    : 'Free puzzles grow downloads fastest!'}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipWrap}>
              {PUZZLE_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    accessibilityRole="button"
                    accessibilityLabel={`Category ${cat}`}
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cat.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>RECOMMENDED GRID</Text>
            <View style={styles.row}>
              {([3, 4, 5] as GridSize[]).map((size) => {
                const active = gridSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setGridSize(size)}
                    accessibilityRole="button"
                    accessibilityLabel={`${size} by ${size} grid`}
                    accessibilityState={{ selected: active }}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        active && styles.optionPillTextActive,
                      ]}
                    >
                      {size}×{size}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>DOWNLOAD PRICE</Text>
            <View style={styles.row}>
              {PRICE_PRESETS.map((price) => {
                const active = coinPrice === price;
                return (
                  <Pressable
                    key={price}
                    onPress={() => setCoinPrice(price)}
                    accessibilityRole="button"
                    accessibilityLabel={price === 0 ? 'Free' : `${price} coins`}
                    accessibilityState={{ selected: active }}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        active && styles.optionPillTextActive,
                      ]}
                    >
                      {price === 0 ? 'FREE' : `${price} ¢`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setConfirmedPublic((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmedPublic }}
              accessibilityLabel="Confirm public upload and safe-for-work guidelines"
              style={styles.pledgeRow}
            >
              <Ionicons
                name={confirmedPublic ? 'checkbox' : 'square-outline'}
                size={22}
                color={confirmedPublic ? PALETTE.arcadeOrange : COLORS.textMuted}
              />
              <Text style={styles.pledgeText}>
                I understand this photo will be uploaded publicly for other players, contains no NSFW or private content, and will be scanned by moderation.
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePublish}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Upload publicly and run safety scan"
              style={({ pressed }) => [
                styles.submitBtn,
                !confirmedPublic && styles.submitBtnMuted,
                pressed && styles.pressed,
              ]}
            >
              {submitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={PALETTE.ink} size="small" />
                  <Text style={styles.submitText}>UPLOADING & SCANNING...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color={PALETTE.ink} />
                  <Text style={styles.submitText}>PUBLISH PUBLICLY</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 15, 22, 0.82)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.nightSurface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '88%',
    borderWidth: 2.5,
    borderColor: PALETTE.dustyMauve,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.ink,
  },
  headerTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 19,
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
    gap: 11,
  },
  privacyCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.nightSurfacePurple,
    borderRadius: 8,
    padding: 10,
    borderWidth: 2,
    borderColor: PALETTE.dustyMauve,
  },
  privacyCalloutText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  topPreview: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 82,
    height: 82,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: PALETTE.cream,
  },
  titleInputWrap: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontFamily: FONTS.pixel,
    color: PALETTE.sunsetPeach,
    fontSize: 14,
    letterSpacing: 0.8,
  },
  input: {
    height: 40,
    borderRadius: 6,
    backgroundColor: '#191C2B',
    borderWidth: 2,
    borderColor: PALETTE.ink,
    paddingHorizontal: 11,
    color: PALETTE.cream,
    fontSize: 14,
    fontWeight: '600',
  },
  royaltyHint: {
    color: PALETTE.amberWindow,
    fontSize: 11,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  chipActive: {
    backgroundColor: PALETTE.cream,
  },
  chipText: {
    fontFamily: FONTS.pixel,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  chipTextActive: {
    color: PALETTE.ink,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  optionPill: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillActive: {
    backgroundColor: PALETTE.cream,
  },
  optionPillText: {
    fontFamily: FONTS.pixel,
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  optionPillTextActive: {
    color: PALETTE.ink,
  },
  pledgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.nightSurfacePurple,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    marginTop: 4,
  },
  pledgeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  submitBtn: {
    height: 50,
    borderRadius: 8,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
    borderBottomWidth: 5,
    borderBottomColor: PALETTE.arcadeOrangeDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitBtnMuted: {
    opacity: 0.65,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 18,
    letterSpacing: 0.8,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
