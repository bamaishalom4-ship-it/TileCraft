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
import { NightSkylineStrip } from '../components/NightSkylineStrip';
import { formatElapsedTime } from '../hooks/usePuzzleTimer';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

/**
 * Celebratory Win Screen in the Night Bus Stop palette:
 * deep navy, muted purple, warm amber glow, cream card stock photo frame,
 * and bold arcade orange Play Again action.
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
      <NightSkylineStrip />

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
                size={starIndex === 2 ? 46 : 34}
                color={earned ? PALETTE.amberWindow : COLORS.textMuted}
                style={starIndex === 2 ? styles.centerStar : undefined}
              />
            </View>
          );
        })}
      </View>

      <Text style={styles.heading} accessibilityRole="header">
        PUZZLE SOLVED!
      </Text>
      <Text style={styles.subheading}>
        {summary.puzzleTitle} · {summary.gridSize}×{summary.gridSize}
      </Text>

      {summary.imageUri ? (
        <View style={styles.imageCardStock}>
          <View style={styles.imageFrame}>
            <Image
              source={{ uri: summary.imageUri }}
              style={styles.completedImage}
              accessibilityLabel={`Completed ${summary.puzzleTitle} image`}
            />
          </View>
        </View>
      ) : (
        <View
          style={styles.trophyBox}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Ionicons name="trophy" size={50} color={PALETTE.amberWindow} />
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
          <Text style={[styles.metricValue, { color: PALETTE.arcadeOrange }]}>
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
            <Ionicons name="refresh" size={18} color={PALETTE.ink} />
          </View>
          <Text style={styles.primaryBtnText}>PLAY AGAIN</Text>
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
              <Ionicons
                name="cloud-upload-outline"
                size={18}
                color={PALETTE.sunsetPeach}
              />
            </View>
            <Text
              style={[styles.secondaryBtnText, { color: PALETTE.sunsetPeach }]}
            >
              SHARE TO MARKETPLACE
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
          <Text style={styles.secondaryBtnText}>BACK TO HOME</Text>
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
    paddingHorizontal: 18,
    gap: 11,
    backgroundColor: COLORS.nightBg,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  centerStar: {
    marginBottom: 8,
  },
  heading: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 30,
    letterSpacing: 1.4,
  },
  subheading: {
    color: PALETTE.sunsetPeach,
    fontSize: 13,
    fontWeight: '700',
  },
  imageCardStock: {
    padding: 8,
    backgroundColor: COLORS.cardStock,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: PALETTE.ink,
    marginVertical: 2,
  },
  imageFrame: {
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  completedImage: {
    width: 174,
    height: 174,
  },
  trophyBox: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2.5,
    borderColor: PALETTE.amberWindow,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  rewardCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.nightSurface,
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#3B3452',
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.ink,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  metricLabel: {
    fontFamily: FONTS.pixel,
    color: PALETTE.sunsetPeach,
    fontSize: 13,
    letterSpacing: 0.8,
  },
  metricValue: {
    color: PALETTE.cream,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1.5,
    height: 30,
    backgroundColor: '#3B3452',
  },
  balanceNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    gap: 9,
    marginTop: 2,
  },
  primaryBtn: {
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
  },
  primaryBtnText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 20,
    letterSpacing: 1,
  },
  secondaryBtn: {
    height: 45,
    borderRadius: 8,
    backgroundColor: COLORS.nightSurface,
    borderWidth: 2,
    borderColor: '#3B3452',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishBtn: {
    borderColor: PALETTE.dustyMauve,
    backgroundColor: COLORS.nightSurfacePurple,
  },
  secondaryBtnText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 16,
    letterSpacing: 0.8,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
