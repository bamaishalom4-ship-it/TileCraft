import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { COLORS } from '../theme/tokens';

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
 * Modal for publishing a cropped 1:1 custom image to the Supabase UGC Marketplace.
 * Enforces SFW pledge, validates title safety, uploads to Storage, and invokes the
 * automated NSFW moderation Edge Function.
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
  const [agreedSfw, setAgreedSfw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!localImageUri) return null;

  const royalty = calculateCreatorRoyalty(coinPrice);

  const handlePublish = async () => {
    if (!agreedSfw) {
      Alert.alert(
        'Community Guidelines Required',
        'Please confirm that your puzzle image is SFW and safe for all players.'
      );
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
        Alert.alert('Upload Blocked', result.message);
        return;
      }

      if (result.puzzle && onPublished) {
        onPublished(result.puzzle);
      }

      Alert.alert(
        result.moderationStatus === 'approved'
          ? 'Published Live!'
          : 'Submitted for Review',
        result.message,
        [{ text: 'Awesome', onPress: onClose }]
      );
    } catch (err) {
      Alert.alert(
        'Upload Error',
        err instanceof Error ? err.message : 'Unable to upload puzzle right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Publish to Marketplace</Text>
            <Pressable onPress={onClose} disabled={submitting} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Preview + Title */}
            <View style={styles.topPreview}>
              <Image source={{ uri: localImageUri }} style={styles.thumb} />
              <View style={styles.titleInputWrap}>
                <Text style={styles.label}>PUZZLE TITLE</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter a catchy title..."
                  placeholderTextColor={COLORS.textMuted}
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

            {/* Category Selector */}
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipWrap}>
              {PUZZLE_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Recommended Grid Size */}
            <Text style={styles.label}>RECOMMENDED GRID</Text>
            <View style={styles.row}>
              {([3, 4, 5] as GridSize[]).map((size) => {
                const active = gridSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setGridSize(size)}
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

            {/* Coin Price */}
            <Text style={styles.label}>DOWNLOAD PRICE</Text>
            <View style={styles.row}>
              {PRICE_PRESETS.map((price) => {
                const active = coinPrice === price;
                return (
                  <Pressable
                    key={price}
                    onPress={() => setCoinPrice(price)}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        active && styles.optionPillTextActive,
                      ]}
                    >
                      {price === 0 ? 'Free' : `${price} ¢`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* SFW Safety Pledge */}
            <Pressable
              onPress={() => setAgreedSfw((prev) => !prev)}
              style={styles.pledgeRow}
            >
              <Ionicons
                name={agreedSfw ? 'checkbox' : 'square-outline'}
                size={22}
                color={agreedSfw ? COLORS.gold : COLORS.textMuted}
              />
              <Text style={styles.pledgeText}>
                I confirm this image contains no NSFW, violent, or offensive content. All uploads are scanned by automated moderation.
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePublish}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                !agreedSfw && styles.submitBtnMuted,
                pressed && styles.pressed,
              ]}
            >
              {submitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#111827" size="small" />
                  <Text style={styles.submitText}>Uploading & Scanning...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#111827" />
                  <Text style={styles.submitText}>Upload & Run Safety Scan</Text>
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
    backgroundColor: 'rgba(5, 7, 12, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 18,
    gap: 12,
  },
  topPreview: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  titleInputWrap: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  royaltyHint: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: COLORS.gold,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  optionPill: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: COLORS.gold,
  },
  optionPillText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  optionPillTextActive: {
    color: COLORS.gold,
  },
  pledgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  pledgeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
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
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
