import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/tokens';

const YOUTUBE_URL = 'https://youtube.com/@madebykubo';
const INSTAGRAM_URL = 'https://www.instagram.com/madebykubo';

interface MadeByKuboFooterProps {
  /**
   * - `full`: Credit line + `[ YOUTUBE ]` and `[ INSTAGRAM ]` links (Menu / Shop)
   * - `compact`: Minimal single-line credit bar (Gameplay / Win / Marketplace)
   */
  variant?: 'full' | 'compact';
}

/**
 * Creator footer modeled after BrainSweep's signature MadeByKubo credit bar.
 */
export const MadeByKuboFooter: React.FC<MadeByKuboFooterProps> = ({
  variant = 'full',
}) => {
  const year = new Date().getFullYear();

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (variant === 'compact') {
    return (
      <View style={styles.compactContainer}>
        <Pressable
          onPress={() => openExternal(INSTAGRAM_URL)}
          accessibilityRole="link"
          accessibilityLabel="TileCraft by MadeByKubo"
        >
          <Text style={styles.creditText}>
            TileCraft © {year} <Text style={styles.brandHighlight}>MadeByKubo</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <Text style={styles.creditText}>
        TileCraft © {year} <Text style={styles.brandHighlight}>MadeByKubo</Text>
      </Text>
      <View style={styles.linksRow}>
        <Pressable
          onPress={() => openExternal(YOUTUBE_URL)}
          accessibilityRole="link"
          accessibilityLabel="MadeByKubo on YouTube"
          style={({ pressed }) => [styles.linkBtn, pressed && styles.linkPressed]}
        >
          <Text style={styles.linkText}>[ YOUTUBE ]</Text>
        </Pressable>

        <Pressable
          onPress={() => openExternal(INSTAGRAM_URL)}
          accessibilityRole="link"
          accessibilityLabel="MadeByKubo on Instagram"
          style={({ pressed }) => [styles.linkBtn, pressed && styles.linkPressed]}
        >
          <Text style={styles.linkText}>[ INSTAGRAM ]</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 55, 82, 0.55)',
    gap: 8,
  },
  compactContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  creditText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  brandHighlight: {
    color: COLORS.textSecondary,
    fontWeight: '800',
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  linkBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
