import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PUZZLE_CATEGORIES,
  type FlagReason,
  type MarketplacePuzzle,
  type MarketplaceSort,
  type PuzzleCategory,
} from '../types/marketplace';
import {
  downloadMarketplacePuzzle,
  fetchMarketplacePuzzles,
  flagMarketplacePuzzle,
} from '../services/marketplaceService';
import { filterAndSortMarketplace } from '../utils/marketplaceUtils';
import { useAppStore } from '../store/useAppStore';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { CoinBadge } from '../components/CoinBadge';
import { PublishPuzzleModal } from '../components/PublishPuzzleModal';
import { MadeByKuboFooter } from '../components/MadeByKuboFooter';
import { pickImageFromGallery } from '../services/imageService';
import { COLORS } from '../theme/tokens';

const FLAG_OPTIONS: Array<{ reason: FlagReason; label: string }> = [
  { reason: 'nsfw', label: 'NSFW / Sexual Content' },
  { reason: 'violence', label: 'Violence or Gore' },
  { reason: 'hate', label: 'Hate Speech / Harassment' },
  { reason: 'copyright', label: 'Copyright Infringement' },
  { reason: 'spam', label: 'Spam / Low Quality' },
];

/**
 * TileCraft UGC Community Marketplace Screen:
 * - Search, Category filter chips, and Trending/Newest/Price sorting
 * - 2-column tactile puzzle cards with author, download count, and coin price
 * - Atomic Coin Download & Play flow (auto-respects unlocked grid sizes)
 * - Community NSFW/Abuse Flagging modal (3 flags trigger auto-quarantine)
 * - One-tap Publish flow for custom cropped puzzles
 */
export const MarketplaceScreen: React.FC = () => {
  const [puzzles, setPuzzles] = useState<MarketplacePuzzle[]>([]);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PuzzleCategory | 'All'>('All');
  const [sortBy, setSortBy] = useState<MarketplaceSort>('trending');

  const [inspectedPuzzle, setInspectedPuzzle] = useState<MarketplacePuzzle | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const coins = useAppStore((s) => s.coins);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const customPuzzles = useAppStore((s) => s.customPuzzles);
  const navigate = useAppStore((s) => s.navigate);
  const spendCoins = useAppStore((s) => s.spendCoins);
  const setCoinsFromServer = useAppStore((s) => s.setCoinsFromServer);
  const setActivePuzzleMeta = useAppStore((s) => s.setActivePuzzleMeta);
  const openCropperWithAsset = useAppStore((s) => s.openCropperWithAsset);

  const setGridSize = usePuzzleStore((s) => s.setGridSize);
  const setImageUri = usePuzzleStore((s) => s.setImageUri);
  const shuffle = usePuzzleStore((s) => s.shuffle);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetchMarketplacePuzzles();
      setPuzzles(res.puzzles);
      setIsLiveBackend(res.isLiveBackend);
    } catch (err) {
      Alert.alert(
        'Marketplace Unavailable',
        err instanceof Error ? err.message : 'Could not load community puzzles.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const visiblePuzzles = useMemo(
    () =>
      filterAndSortMarketplace(puzzles, {
        category: selectedCategory,
        searchQuery,
        sort: sortBy,
      }),
    [puzzles, selectedCategory, searchQuery, sortBy]
  );

  const launchPuzzle = (puzzle: MarketplacePuzzle) => {
    const chosenSize = unlockedGridSizes.includes(puzzle.recommendedGridSize)
      ? puzzle.recommendedGridSize
      : 4;
    setGridSize(chosenSize);
    setImageUri(puzzle.imageUrl);
    shuffle();
    setActivePuzzleMeta(puzzle.title, false);
    setInspectedPuzzle(null);
    navigate('game');
  };

  const handleDownloadAndPlay = async (puzzle: MarketplacePuzzle) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await downloadMarketplacePuzzle(puzzle, spendCoins, coins);
      if (!res.ok) {
        if (res.error?.toLowerCase().includes('coin')) {
          Alert.alert(
            'Not Enough Coins',
            `This puzzle costs ${puzzle.coinPrice} coins. Claim your daily reward or visit the Shop!`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Shop',
                onPress: () => {
                  setInspectedPuzzle(null);
                  navigate('shop');
                },
              },
            ]
          );
        } else {
          Alert.alert('Download Failed', res.error ?? 'Please try again.');
        }
        return;
      }

      if (typeof res.newBalance === 'number') {
        setCoinsFromServer(res.newBalance);
      }

      // Optimistically mark owned & increment download count in current list
      setPuzzles((prev) =>
        prev.map((item) =>
          item.id === puzzle.id
            ? {
                ...item,
                isOwned: true,
                downloadCount: res.alreadyOwned
                  ? item.downloadCount
                  : item.downloadCount + 1,
              }
            : item
        )
      );

      launchPuzzle(puzzle);
    } finally {
      setDownloading(false);
    }
  };

  const handleFlagReason = async (reason: FlagReason) => {
    if (!inspectedPuzzle) return;
    const targetId = inspectedPuzzle.id;
    setFlagModalOpen(false);

    const res = await flagMarketplacePuzzle(targetId, reason);
    Alert.alert(res.ok ? 'Report Received' : 'Notice', res.message);

    if (res.ok && res.quarantined) {
      setInspectedPuzzle(null);
      setPuzzles((prev) => prev.filter((p) => p.id !== targetId));
    }
  };

  const handleOpenPublish = async () => {
    if (customPuzzles.length > 0) {
      setPublishModalOpen(true);
      return;
    }

    Alert.alert(
      'Craft an Image First',
      'Pick a photo from your gallery and crop it into a 1:1 square before publishing to the Marketplace.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pick Photo',
          onPress: async () => {
            const picked = await pickImageFromGallery();
            if (picked.status === 'picked' && picked.asset) {
              openCropperWithAsset(picked.asset);
            }
          },
        },
      ]
    );
  };

  const latestLocalPuzzle = customPuzzles[0];

  return (
    <View style={styles.wrapper}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigate('menu')} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Marketplace</Text>
          <Text style={styles.modeTag}>
            {isLiveBackend ? '● Supabase Live' : '○ Local Sandbox Preview'}
          </Text>
        </View>
        <CoinBadge coins={coins} onPress={() => navigate('shop')} />
      </View>

      {/* Search + Upload Action */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search puzzles or creators..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>
        <Pressable onPress={handleOpenPublish} style={styles.uploadBtn}>
          <Ionicons name="cloud-upload-outline" size={18} color="#111827" />
          <Text style={styles.uploadBtnText}>Publish</Text>
        </Pressable>
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        {(['All', ...PUZZLE_CATEGORIES] as Array<PuzzleCategory | 'All'>).map(
          (cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.catChip, active && styles.catChipActive]}
              >
                <Text
                  style={[styles.catChipText, active && styles.catChipTextActive]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          }
        )}
      </ScrollView>

      {/* Sort Bar */}
      <View style={styles.sortRow}>
        {(
          [
            { id: 'trending', label: 'Trending' },
            { id: 'newest', label: 'Newest' },
            { id: 'lowest-price', label: 'Free & Low' },
          ] as Array<{ id: MarketplaceSort; label: string }>
        ).map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setSortBy(s.id)}
            style={[styles.sortPill, sortBy === s.id && styles.sortPillActive]}
          >
            <Text
              style={[
                styles.sortPillText,
                sortBy === s.id && styles.sortPillTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Marketplace 2-Column Feed */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Loading community puzzles...</Text>
        </View>
      ) : (
        <FlatList
          data={visiblePuzzles}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFeed(true)}
              tintColor={COLORS.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="images-outline" size={38} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No matching puzzles yet</Text>
              <Text style={styles.emptySub}>
                Be the first to publish one in this category!
              </Text>
            </View>
          }
          ListFooterComponent={<MadeByKuboFooter variant="compact" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setInspectedPuzzle(item)}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardImageWrap}>
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
                <View style={styles.gridBadge}>
                  <Text style={styles.gridBadgeText}>
                    {item.recommendedGridSize}×{item.recommendedGridSize}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priceBadge,
                    item.isOwned && styles.ownedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.priceBadgeText,
                      item.isOwned && styles.ownedBadgeText,
                    ]}
                  >
                    {item.isOwned
                      ? 'PLAY'
                      : item.coinPrice === 0
                      ? 'FREE'
                      : `${item.coinPrice} ¢`}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardAuthor} numberOfLines={1}>
                    by {item.authorName}
                  </Text>
                  <View style={styles.dlWrap}>
                    <Ionicons
                      name="download-outline"
                      size={11}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.dlText}>{item.downloadCount}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Puzzle Detail & Download Modal */}
      <Modal
        visible={inspectedPuzzle !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectedPuzzle(null)}
      >
        {inspectedPuzzle ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.detailCard}>
              <Image
                source={{ uri: inspectedPuzzle.imageUrl }}
                style={styles.detailImage}
              />

              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailTitle}>{inspectedPuzzle.title}</Text>
                  <Text style={styles.detailAuthor}>
                    Crafted by {inspectedPuzzle.authorName} · {inspectedPuzzle.category}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setFlagModalOpen(true)}
                  style={styles.flagIconBtn}
                  accessibilityLabel="Report inappropriate content"
                >
                  <Ionicons name="flag-outline" size={18} color="#F87171" />
                </Pressable>
              </View>

              <View style={styles.detailStats}>
                <Text style={styles.detailStatText}>
                  Grid: {inspectedPuzzle.recommendedGridSize}×
                  {inspectedPuzzle.recommendedGridSize}
                </Text>
                <Text style={styles.detailStatText}>
                  Downloads: {inspectedPuzzle.downloadCount}
                </Text>
              </View>

              <Pressable
                onPress={() => handleDownloadAndPlay(inspectedPuzzle)}
                disabled={downloading}
                style={styles.downloadCta}
              >
                {downloading ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <>
                    <Ionicons
                      name={inspectedPuzzle.isOwned ? 'play' : 'download'}
                      size={18}
                      color="#111827"
                    />
                    <Text style={styles.downloadCtaText}>
                      {inspectedPuzzle.isOwned
                        ? 'Play Puzzle'
                        : inspectedPuzzle.coinPrice === 0
                        ? 'Download Free & Play'
                        : `Unlock & Play (${inspectedPuzzle.coinPrice} ¢)`}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => setInspectedPuzzle(null)}
                style={styles.cancelLink}
              >
                <Text style={styles.cancelLinkText}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* NSFW / Abuse Flagging Reason Modal */}
      <Modal
        visible={flagModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFlagModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.flagCard}>
            <Text style={styles.flagTitle}>Report Puzzle</Text>
            <Text style={styles.flagSubtitle}>
              Flagged puzzles reaching 3 community reports are automatically hidden for moderator review.
            </Text>
            {FLAG_OPTIONS.map((opt) => (
              <Pressable
                key={opt.reason}
                onPress={() => handleFlagReason(opt.reason)}
                style={styles.flagOptionBtn}
              >
                <Text style={styles.flagOptionText}>{opt.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
            ))}
            <Pressable
              onPress={() => setFlagModalOpen(false)}
              style={styles.cancelLink}
            >
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Publish Custom Puzzle Modal */}
      <PublishPuzzleModal
        visible={publishModalOpen}
        localImageUri={latestLocalPuzzle?.imageUri ?? null}
        initialTitle={latestLocalPuzzle?.title}
        initialGridSize={latestLocalPuzzle?.preferredGridSize}
        onClose={() => setPublishModalOpen(false)}
        onPublished={(newPuzzle) => {
          if (newPuzzle.moderationStatus === 'approved') {
            setPuzzles((prev) => [newPuzzle, ...prev]);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  modeTag: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadBtnText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  categoriesScroll: {
    maxHeight: 40,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: COLORS.gold,
  },
  catChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  catChipTextActive: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  sortPillActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  sortPillText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sortPillTextActive: {
    color: COLORS.textPrimary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  gridBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 19, 29, 0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  gridBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ownedBadge: {
    backgroundColor: COLORS.success,
  },
  priceBadgeText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '900',
  },
  ownedBadgeText: {
    color: '#064E3B',
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  cardAuthor: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  dlWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dlText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 8,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  detailAuthor: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  flagIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  detailStatText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  downloadCta: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadCtaText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelLinkText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  flagCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flagTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  flagSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  flagOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flagOptionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
