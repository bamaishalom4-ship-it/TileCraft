import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
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
  type MarketplaceFeedStatus,
} from '../services/marketplaceService';
import { filterAndSortMarketplace } from '../utils/marketplaceUtils';
import { useAppStore } from '../store/useAppStore';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { showAppDialog } from '../store/useDialogStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { CoinBadge } from '../components/CoinBadge';
import { PublishPuzzleModal } from '../components/PublishPuzzleModal';
import { MadeByKuboFooter } from '../components/MadeByKuboFooter';
import { NightSkylineStrip } from '../components/NightSkylineStrip';
import { pickImageFromGallery } from '../services/imageService';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

const FLAG_OPTIONS: Array<{ reason: FlagReason; label: string }> = [
  { reason: 'nsfw', label: 'NSFW / Sexual Content' },
  { reason: 'violence', label: 'Violence or Gore' },
  { reason: 'hate', label: 'Hate Speech / Harassment' },
  { reason: 'copyright', label: 'Copyright Infringement' },
  { reason: 'spam', label: 'Spam / Low Quality' },
];

/**
 * TileCraft Community Marketplace Screen — Night Bus Stop palette with
 * Collectible-Card cream stock visual treatment for existing puzzle cards.
 * Preserves all loading, offline, backend-error, preview, and moderation states.
 */
export const MarketplaceScreen: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [puzzles, setPuzzles] = useState<MarketplacePuzzle[]>([]);
  const [feedStatus, setFeedStatus] = useState<MarketplaceFeedStatus>('empty');
  const [feedError, setFeedError] = useState<string | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [publishDisabledReason, setPublishDisabledReason] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PuzzleCategory | 'All'>('All');
  const [sortBy, setSortBy] = useState<MarketplaceSort>('trending');

  const [inspectedPuzzle, setInspectedPuzzle] = useState<MarketplacePuzzle | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const modalOpenerRef = useRef<HTMLElement | null>(null);

  const economyHydrated = useAppStore((s) => s.economyHydrated);
  const coins = useAppStore((s) => s.coins);
  const unlockedGridSizes = useAppStore((s) => s.unlockedGridSizes);
  const customPuzzles = useAppStore((s) => s.customPuzzles);
  const navigate = useAppStore((s) => s.navigate);
  const setCoinsFromServer = useAppStore((s) => s.setCoinsFromServer);
  const setActivePuzzleMeta = useAppStore((s) => s.setActivePuzzleMeta);
  const openCropperWithAsset = useAppStore((s) => s.openCropperWithAsset);

  const startNewGame = usePuzzleStore((s) => s.startNewGame);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await fetchMarketplacePuzzles();
    setPuzzles(res.puzzles);
    setFeedStatus(res.status);
    setFeedError(res.errorMessage ?? null);
    setCanPublish(res.canPublish);
    setPublishDisabledReason(res.publishDisabledReason ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed, isOnline]);

  // Escape dismissal & focus restoration for Detail & Flag modals
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const anyModal = inspectedPuzzle !== null || flagModalOpen;
    if (anyModal) {
      if (!modalOpenerRef.current) {
        modalOpenerRef.current = document.activeElement as HTMLElement | null;
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (flagModalOpen) setFlagModalOpen(false);
          else setInspectedPuzzle(null);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    } else if (modalOpenerRef.current) {
      const el = modalOpenerRef.current;
      modalOpenerRef.current = null;
      if (typeof el.focus === 'function' && document.contains(el)) {
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [inspectedPuzzle, flagModalOpen]);

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
    startNewGame({
      gridSize: chosenSize,
      mode: 'marketplace',
      title: puzzle.title,
      imageUri: puzzle.imageUrl,
    });
    setActivePuzzleMeta(puzzle.title, false);
    setInspectedPuzzle(null);
    navigate('game');
  };

  const handleDownloadAndPlay = async (puzzle: MarketplacePuzzle) => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await downloadMarketplacePuzzle(puzzle, coins);
      if (!res.ok) {
        if (res.error?.toLowerCase().includes('coin')) {
          showAppDialog({
            title: 'Not Enough Coins',
            message: `This puzzle costs ${puzzle.coinPrice} coins. Claim your daily reward or visit the Shop!`,
            actions: [
              { label: 'Cancel', style: 'cancel' },
              {
                label: 'Open Shop',
                style: 'primary',
                onPress: () => {
                  setInspectedPuzzle(null);
                  navigate('shop');
                },
              },
            ],
          });
        } else {
          showAppDialog({
            title: 'Download Unavailable',
            message: res.error ?? 'Could not download this puzzle right now.',
          });
        }
        return;
      }

      if (typeof res.newBalance === 'number') {
        setCoinsFromServer(res.newBalance);
      }

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
    showAppDialog({
      title: res.ok ? 'Report Received' : 'Report Notice',
      message: res.message,
    });

    if (res.ok && res.quarantined) {
      setInspectedPuzzle(null);
      setPuzzles((prev) => prev.filter((p) => p.id !== targetId));
    }
  };

  const handleOpenPublish = () => {
    if (!isOnline || feedStatus === 'offline') {
      showAppDialog({
        title: 'Internet Connection Needed',
        message:
          'You are currently offline. Connect to the internet to publish a puzzle publicly. Private photo puzzles still work offline on your device!',
      });
      return;
    }

    if (!canPublish) {
      showAppDialog({
        title: 'Publishing Unavailable',
        message:
          publishDisabledReason ??
          'Public publishing is currently unavailable on this server. You can still create private photo puzzles saved on your device.',
        actions: [
          { label: 'Close', style: 'cancel' },
          {
            label: 'Make Private Photo',
            style: 'primary',
            onPress: async () => {
              const picked = await pickImageFromGallery();
              if (picked.status === 'picked' && picked.asset) {
                openCropperWithAsset(picked.asset);
              }
            },
          },
        ],
      });
      return;
    }

    if (customPuzzles.length > 0) {
      setPublishModalOpen(true);
      return;
    }

    showAppDialog({
      title: 'Craft a Photo Puzzle First',
      message:
        'Pick and crop a photo into a square puzzle before publishing it. Your photos stay private on your device until you explicitly choose to publish.',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Pick Photo',
          style: 'primary',
          onPress: async () => {
            const picked = await pickImageFromGallery();
            if (picked.status === 'picked' && picked.asset) {
              openCropperWithAsset(picked.asset);
            }
          },
        },
      ],
    });
  };

  const statusBadgeText =
    feedStatus === 'offline'
      ? '○ Offline'
      : feedStatus === 'backend-error'
      ? '▲ Backend Unavailable'
      : feedStatus === 'unconfigured'
      ? '○ Preview Mode'
      : '● Community Catalog';

  const latestLocalPuzzle = customPuzzles[0];
  const isFeedBrowseable = feedStatus === 'ready' || feedStatus === 'empty';

  return (
    <View style={styles.wrapper}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigate('menu')}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={20} color={PALETTE.cream} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            MARKETPLACE
          </Text>
          <Text style={styles.modeTag}>{statusBadgeText}</Text>
        </View>
        <CoinBadge
          coins={coins}
          loading={!economyHydrated}
          onPress={() => navigate('shop')}
        />
      </View>

      <View style={styles.stripPad}>
        <NightSkylineStrip />
      </View>

      {/* Search + Publish Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={isFeedBrowseable}
            placeholder="Search puzzles or creators..."
            placeholderTextColor={COLORS.textMuted}
            accessibilityLabel="Search community puzzles"
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={handleOpenPublish}
          accessibilityRole="button"
          accessibilityLabel={
            canPublish
              ? 'Publish a crafted photo puzzle'
              : 'Publishing currently unavailable — tap for details'
          }
          style={[
            styles.uploadBtn,
            !canPublish && styles.uploadBtnMuted,
          ]}
        >
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons
              name={canPublish ? 'cloud-upload-outline' : 'information-circle-outline'}
              size={17}
              color={canPublish ? PALETTE.ink : PALETTE.cream}
            />
          </View>
          <Text
            style={[
              styles.uploadBtnText,
              !canPublish && styles.uploadBtnTextMuted,
            ]}
          >
            PUBLISH
          </Text>
        </Pressable>
      </View>

      {/* Category & Sort controls only when catalog is actually reachable */}
      {isFeedBrowseable ? (
        <>
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
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${cat}`}
                    accessibilityState={{ selected: active }}
                    style={[styles.catChip, active && styles.catChipActive]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        active && styles.catChipTextActive,
                      ]}
                    >
                      {cat.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>

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
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${s.label}`}
                accessibilityState={{ selected: sortBy === s.id }}
                style={[styles.sortPill, sortBy === s.id && styles.sortPillActive]}
              >
                <Text
                  style={[
                    styles.sortPillText,
                    sortBy === s.id && styles.sortPillTextActive,
                  ]}
                >
                  {s.label.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* Distinct Loading / Offline / Error / Preview / Empty / Ready States */}
      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={PALETTE.arcadeOrange} />
          <Text style={styles.stateTitle}>LOADING MARKETPLACE...</Text>
          <Text style={styles.stateSub}>Checking the community puzzle catalog.</Text>
        </View>
      ) : feedStatus === 'offline' ? (
        <View style={styles.stateBox}>
          <Ionicons name="cloud-offline-outline" size={44} color={PALETTE.sunsetPeach} />
          <Text style={styles.stateTitle}>YOU’RE OFFLINE</Text>
          <Text style={styles.stateSub}>
            {feedError ??
              'Community Marketplace needs an internet connection. Classic puzzles and your saved photo puzzles work offline right now.'}
          </Text>
          <View style={styles.stateActions}>
            <Pressable
              onPress={() => navigate('menu')}
              accessibilityRole="button"
              accessibilityLabel="Return home to play offline puzzles"
              style={styles.statePrimaryBtn}
            >
              <Text style={styles.statePrimaryText}>PLAY OFFLINE</Text>
            </Pressable>
            <Pressable
              onPress={() => loadFeed(true)}
              accessibilityRole="button"
              accessibilityLabel="Retry loading Marketplace"
              style={styles.stateSecondaryBtn}
            >
              <Text style={styles.stateSecondaryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
          <MadeByKuboFooter variant="compact" />
        </View>
      ) : feedStatus === 'backend-error' || feedStatus === 'unconfigured' ? (
        <View style={styles.stateBox}>
          <Ionicons
            name={
              feedStatus === 'unconfigured'
                ? 'sparkles-outline'
                : 'alert-circle-outline'
            }
            size={44}
            color={PALETTE.amberWindow}
          />
          <Text style={styles.stateTitle}>
            {feedStatus === 'unconfigured'
              ? 'MARKETPLACE PREVIEW — COMING SOON'
              : 'MARKETPLACE TEMPORARILY UNAVAILABLE'}
          </Text>
          <Text style={styles.stateSub}>{feedError}</Text>
          {publishDisabledReason ? (
            <View style={styles.infoNoteBox}>
              <Text style={styles.infoNoteText}>{publishDisabledReason}</Text>
            </View>
          ) : null}
          <View style={styles.stateActions}>
            <Pressable
              onPress={() => loadFeed(true)}
              accessibilityRole="button"
              accessibilityLabel="Retry connecting to Marketplace"
              style={styles.stateSecondaryBtn}
            >
              <Text style={styles.stateSecondaryText}>RETRY</Text>
            </Pressable>
            <Pressable
              onPress={() => navigate('menu')}
              accessibilityRole="button"
              accessibilityLabel="Back to Classic and Photo Puzzles"
              style={styles.statePrimaryBtn}
            >
              <Text style={styles.statePrimaryText}>PLAY LOCAL PUZZLES</Text>
            </Pressable>
          </View>
          <MadeByKuboFooter variant="compact" />
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
              tintColor={PALETTE.arcadeOrange}
            />
          }
          ListHeaderComponent={
            !canPublish && publishDisabledReason ? (
              <View style={styles.publishNoticeBar}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={PALETTE.amberWindow}
                />
                <Text style={styles.publishNoticeText}>
                  {publishDisabledReason}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.stateBox}>
              <Ionicons name="images-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.stateTitle}>NO COMMUNITY PUZZLES YET</Text>
              <Text style={styles.stateSub}>
                {searchQuery.trim() || selectedCategory !== 'All'
                  ? 'No puzzles matched your current filter. Try clearing your search.'
                  : canPublish
                  ? 'The live catalog is open! Craft a photo puzzle and be the first to publish.'
                  : 'Check back soon as community puzzles are approved.'}
              </Text>
            </View>
          }
          ListFooterComponent={<MadeByKuboFooter variant="compact" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setInspectedPuzzle(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} by ${item.authorName}, ${item.recommendedGridSize} by ${item.recommendedGridSize}, ${item.isOwned ? 'owned' : item.coinPrice === 0 ? 'free' : `${item.coinPrice} coins`}`}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title.toUpperCase()}
                </Text>
              </View>

              <View style={styles.cardImageWrap}>
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
                <View style={styles.gridBadge}>
                  <Text style={styles.gridBadgeText}>
                    {item.recommendedGridSize}×{item.recommendedGridSize}
                  </Text>
                </View>
                <View
                  style={[styles.priceBadge, item.isOwned && styles.ownedBadge]}
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

              <View style={styles.cardMetaRow}>
                <Text style={styles.cardAuthor} numberOfLines={1}>
                  by {item.authorName}
                </Text>
                <View style={styles.dlWrap}>
                  <Ionicons
                    name="download-outline"
                    size={11}
                    color="#4F4B45"
                  />
                  <Text style={styles.dlText}>{item.downloadCount}</Text>
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
          <View style={styles.modalBackdrop} accessibilityViewIsModal>
            <View style={styles.detailCard}>
              <View style={styles.detailImageFrame}>
                <Image
                  source={{ uri: inspectedPuzzle.imageUrl }}
                  style={styles.detailImage}
                />
              </View>

              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailTitle}>
                    {inspectedPuzzle.title.toUpperCase()}
                  </Text>
                  <Text style={styles.detailAuthor}>
                    Crafted by {inspectedPuzzle.authorName} ·{' '}
                    {inspectedPuzzle.category}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setFlagModalOpen(true)}
                  style={styles.flagIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Report inappropriate content"
                >
                  <Ionicons name="flag-outline" size={18} color={PALETTE.brickRed} />
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
                accessibilityRole="button"
                style={styles.downloadCta}
              >
                {downloading ? (
                  <ActivityIndicator color={PALETTE.ink} />
                ) : (
                  <>
                    <Ionicons
                      name={inspectedPuzzle.isOwned ? 'play' : 'download'}
                      size={18}
                      color={PALETTE.ink}
                    />
                    <Text style={styles.downloadCtaText}>
                      {inspectedPuzzle.isOwned
                        ? 'PLAY PUZZLE'
                        : inspectedPuzzle.coinPrice === 0
                        ? 'DOWNLOAD FREE & PLAY'
                        : `UNLOCK & PLAY (${inspectedPuzzle.coinPrice} ¢)`}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => setInspectedPuzzle(null)}
                accessibilityRole="button"
                accessibilityLabel="Close puzzle details"
                style={styles.cancelLink}
              >
                <Text style={styles.cancelLinkText}>CLOSE</Text>
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
        <View style={styles.modalBackdrop} accessibilityViewIsModal>
          <View style={styles.flagCard}>
            <Text style={styles.flagTitle}>REPORT PUZZLE</Text>
            <Text style={styles.flagSubtitle}>
              Flagged puzzles reaching 3 community reports are automatically hidden for moderator review.
            </Text>
            {FLAG_OPTIONS.map((opt) => (
              <Pressable
                key={opt.reason}
                onPress={() => handleFlagReason(opt.reason)}
                accessibilityRole="button"
                accessibilityLabel={`Report for ${opt.label}`}
                style={styles.flagOptionBtn}
              >
                <Text style={styles.flagOptionText}>{opt.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
            ))}
            <Pressable
              onPress={() => setFlagModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
              style={styles.cancelLink}
            >
              <Text style={styles.cancelLinkText}>CANCEL</Text>
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
            setFeedStatus('ready');
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
    backgroundColor: COLORS.nightBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stripPad: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.nightSurface,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 21,
    letterSpacing: 1,
  },
  modeTag: {
    color: PALETTE.amberWindow,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.nightSurface,
    borderRadius: 8,
    paddingHorizontal: 11,
    height: 42,
    gap: 8,
    borderWidth: 2,
    borderColor: '#3B3452',
  },
  searchInput: {
    flex: 1,
    color: PALETTE.cream,
    fontSize: 13,
    fontWeight: '600',
  },
  uploadBtn: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadBtnMuted: {
    backgroundColor: COLORS.nightSurfacePurple,
    borderColor: PALETTE.dustyMauve,
  },
  uploadBtnText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  uploadBtnTextMuted: {
    color: PALETTE.cream,
  },
  categoriesScroll: {
    maxHeight: 38,
  },
  categoriesContent: {
    paddingHorizontal: 14,
    gap: 7,
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.nightSurface,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  catChipActive: {
    backgroundColor: PALETTE.cream,
    borderColor: PALETTE.ink,
  },
  catChipText: {
    fontFamily: FONTS.pixel,
    color: COLORS.textSecondary,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  catChipTextActive: {
    color: PALETTE.ink,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sortPillActive: {
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 1.5,
    borderColor: PALETTE.dustyMauve,
  },
  sortPillText: {
    fontFamily: FONTS.pixel,
    color: COLORS.textMuted,
    fontSize: 13,
  },
  sortPillTextActive: {
    color: PALETTE.amberWindow,
  },
  publishNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.nightSurface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: PALETTE.dustyMauve,
    marginBottom: 8,
  },
  publishNoticeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 10,
  },
  stateTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 20,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  stateSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  infoNoteBox: {
    backgroundColor: COLORS.nightSurface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#3B3452',
    width: '100%',
  },
  infoNoteText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  stateActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  statePrimaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  statePrimaryText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  stateSecondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  stateSecondaryText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },

  /* Collectible Cards Visual Treatment for Marketplace Grid Items */
  card: {
    flex: 1,
    backgroundColor: COLORS.cardStock,
    borderRadius: 8,
    padding: 7,
    gap: 6,
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
    borderBottomWidth: 5,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  cardHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: PALETTE.ink,
    paddingBottom: 3,
  },
  cardTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.ink,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  gridBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: PALETTE.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridBadgeText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 12,
  },
  priceBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: PALETTE.arcadeOrange,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
  },
  ownedBadge: {
    backgroundColor: COLORS.success,
  },
  priceBadgeText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 13,
  },
  ownedBadgeText: {
    color: PALETTE.ink,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  cardAuthor: {
    flex: 1,
    color: '#4F4B45',
    fontSize: 11,
    fontWeight: '700',
  },
  dlWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dlText: {
    color: '#4F4B45',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Detail & Report Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 15, 22, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.cardStock,
    borderRadius: 10,
    padding: 15,
    gap: 10,
    borderWidth: 3,
    borderColor: PALETTE.ink,
  },
  detailImageFrame: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 20,
    letterSpacing: 0.6,
  },
  detailAuthor: {
    color: '#4F4B45',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  flagIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 7,
    backgroundColor: '#F3DFD6',
    borderWidth: 2,
    borderColor: PALETTE.brickRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardStockMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
  },
  detailStatText: {
    color: PALETTE.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  downloadCta: {
    height: 48,
    borderRadius: 8,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.arcadeOrangeDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadCtaText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 17,
    letterSpacing: 0.6,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelLinkText: {
    fontFamily: FONTS.pixel,
    color: '#5B5650',
    fontSize: 15,
    letterSpacing: 0.6,
  },
  flagCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.nightSurface,
    borderRadius: 10,
    padding: 18,
    gap: 10,
    borderWidth: 2.5,
    borderColor: PALETTE.dustyMauve,
  },
  flagTitle: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 20,
    letterSpacing: 0.8,
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
    backgroundColor: COLORS.nightSurfacePurple,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  flagOptionText: {
    color: PALETTE.cream,
    fontSize: 13,
    fontWeight: '700',
  },
});
