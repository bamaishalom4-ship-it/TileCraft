import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { usePuzzleStore } from '../store/usePuzzleStore';
import { showAppDialog } from '../store/useDialogStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { isAnonymousSignInAvailable, getExistingSessionUserId } from '../services/supabaseClient';
import { PublishPuzzleModal } from '../components/PublishPuzzleModal';
import { MadeByKuboFooter } from '../components/MadeByKuboFooter';
import { formatElapsedTime } from '../hooks/usePuzzleTimer';
import { COLORS } from '../theme/tokens';

/**
 * Celebratory Win Screen displaying completion stats, idempotent coin reward,
 * Play Again, and optional explicit public upload for private photo puzzles.
 */
export const WinScreen: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [publishOpen, setPublishOpen] = useState(false);
  const summary = useAppStore((s) => s.lastWinSummary);
  const coins = useAppStore((s) => s.coins);
  const navigate = useAppStore((s) => s.navigate);
  const shuffle = usePuzzleStore((s) => s.shuffle);

  if (!summary) {
    return null;
  }

  const handlePlayAgain = () => {
    shuffle();
    navigate('game');
  };

  const handlePublishTap = async () => {
    if (!isOnline) {
      showAppDialog({
        title: 'Offline',
        message:
          'Connect to the internet to publish this photo publicly. It remains saved privately on your device.',
      });
      return;
    }

    const [sessionUid, anonAllowed] = await Promise.all([
      getExistingSessionUserId(),
      isAnonymousSignInAvailable(),
    ]);

    if (!sessionUid && !anonAllowed) {
      showAppDialog({
        title: 'Publishing Unavailable',
        message:
          'Public publishing requires player sign-in to be enabled on the backend. Your photo stays saved privately on your device.',
      });
      return;
    }

    setPublishOpen(true);
  };

  return (
    <View style={styles.screen}>
      <View
        style={styles.starsRow}
        accessibilityLabel={`${summary.stars} out of 3 stars`}
      >
        {[1, 2, 3].map((starIndex) => {
          const earned = starIndex <= summary.stars;
          return (
            <View
              key={starIndex}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons
                name={earned ? 'star' : 'star-outline'}
                size={starIndex === 2 ? 48 : 36}
                color={earned ? COLORS.gold : COLORS.textMuted}
                style={starIndex === 2 ? styles.centerStar : undefined}
              />
            </View>
          );
        })}
      </View>

      <Text style={styles.heading} accessibilityRole="header">
        Puzzle Solved!
      </Text>
      <Text style={styles.subheading}>
        {summary.puzzleTitle} · {summary.gridSize}×{summary.gridSize}
      </Text>

      {summary.imageUri ? (
        <View style={styles.imageFrame}>
          <Image
            source={{ uri: summary.imageUri }}
            style={styles.completedImage}
            accessibilityLabel={`Completed ${summary.puzzleTitle} image`}
          />
        </View>
      ) : (
        <View
          style={styles.trophyCircle}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Ionicons name="trophy" size={56} color={COLORS.gold} />
        </View>
      )}

      <View style={styles.rewardCard}>
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>MOVES</Text>
          <Text style={styles.metricValue}>{summary.moves}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>TIME</Text>
          <Text style={styles.metricValue}>
            {formatElapsedTime(summary.elapsedSeconds)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricCol}>
          <Text style={styles.metricLabel}>REWARD</Text>
          <Text style={[styles.metricValue, { color: COLORS.gold }]}>
            +{summary.coinsEarned} ¢
          </Text>
        </View>
      </View>

      <Text style={styles.balanceNote}>
        New Balance: {coins.toLocaleString()} coins
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={handlePlayAgain}
          accessibilityRole="button"
          accessibilityLabel="Play again"
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="refresh" size={18} color="#111827" />
          </View>
          <Text style={styles.primaryBtnText}>Play Again</Text>
        </Pressable>

        {summary.isCustomPuzzle && summary.imageUri ? (
          <Pressable
            onPress={handlePublishTap}
            accessibilityRole="button"
            accessibilityLabel="Publish this private photo puzzle to Marketplace"
            style={({ pressed }) => [
              styles.secondaryBtn,
              styles.publishBtn,
              pressed && styles.pressed,
            ]}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#38BDF8" />
            </View>
            <Text style={[styles.secondaryBtnText, { color: '#38BDF8' }]}>
              Share to Marketplace
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => navigate('menu')}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </Pressable>
      </View>

      <MadeByKuboFooter variant="compact" />

      <PublishPuzzleModal
        visible={publishOpen}
        localImageUri={summary.imageUri}
        initialTitle={summary.puzzleTitle}
        initialGridSize={summary.gridSize}
        onClose={() => setPublishOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 12,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  centerStar: {
    marginBottom: 8,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subheading: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  imageFrame: {
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.success,
    marginVertical: 4,
  },
  completedImage: {
    width: 184,
    height: 184,
    borderRadius: 14,
  },
  trophyCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  rewardCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  balanceNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishBtn: {
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
