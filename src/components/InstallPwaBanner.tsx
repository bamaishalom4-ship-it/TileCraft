import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribePwaInstallState,
  triggerPwaInstallPrompt,
  type PwaInstallState,
} from '../utils/pwa';
import { COLORS } from '../theme/tokens';

/**
 * Dismissible in-app PWA Install banner shown only on Web when TileCraft is
 * running in a browser tab (hides automatically once installed as standalone app
 * or on native iOS/Android builds).
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
          <Ionicons name="download-outline" size={18} color="#38BDF8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Install TileCraft App</Text>
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
            <Text style={styles.installBtnText}>Install</Text>
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
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
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
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
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
    backgroundColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  installBtnText: {
    color: '#082F49',
    fontSize: 12,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 4,
  },
});
