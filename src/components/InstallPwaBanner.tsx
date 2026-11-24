import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribePwaInstallState,
  triggerPwaInstallPrompt,
  type PwaInstallState,
} from '../utils/pwa';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

/**
 * Dismissible in-app PWA Install banner shown only on Web when TileCraft is
 * running in a browser tab.
 */
export const InstallPwaBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [pwaState, setPwaState] = useState<PwaInstallState>({
    canPromptNativeInstall: false,
    isIosSafariInstallable: false,
    isStandalone: true,
    isOfflineReady: false,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return subscribePwaInstallState(setPwaState);
  }, []);

  if (
    Platform.OS !== 'web' ||
    dismissed ||
    pwaState.isStandalone ||
    (!pwaState.canPromptNativeInstall && !pwaState.isIosSafariInstallable)
  ) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Ionicons name="download-outline" size={18} color={PALETTE.cream} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>INSTALL TILECRAFT</Text>
          <Text style={styles.subtitle}>
            {pwaState.canPromptNativeInstall
              ? 'Play full-screen & offline right from your home screen.'
              : 'Tap Share → "Add to Home Screen" for full-screen offline play.'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {pwaState.canPromptNativeInstall ? (
          <Pressable
            onPress={() => {
              triggerPwaInstallPrompt().catch(() => {});
            }}
            style={styles.installBtn}
          >
            <Text style={styles.installBtnText}>INSTALL</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityLabel="Dismiss install banner"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E343D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 2,
    borderColor: PALETTE.cityTeal,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: PALETTE.cityTeal,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  installBtn: {
    backgroundColor: PALETTE.arcadeOrange,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  installBtnText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 14,
  },
  closeBtn: {
    padding: 4,
  },
});
