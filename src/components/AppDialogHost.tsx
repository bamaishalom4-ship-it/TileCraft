import React, { useEffect, useRef } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDialogStore } from '../store/useDialogStore';
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

/**
 * Keyboard-accessible modal dialog host supporting Escape dismissal
 * and restoring focus to the triggering element on web.
 */
export const AppDialogHost: React.FC = () => {
  const current = useDialogStore((s) => s.current);
  const closeDialog = useDialogStore((s) => s.closeDialog);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    if (current) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeDialog();
        }
      };

      window.addEventListener('keydown', onKeyDown, true);
      return () => {
        window.removeEventListener('keydown', onKeyDown, true);
      };
    } else if (previousFocusRef.current) {
      const el = previousFocusRef.current;
      previousFocusRef.current = null;
      if (typeof el.focus === 'function' && document.contains(el)) {
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [current, closeDialog]);

  if (!current) return null;

  const actions =
    current.actions && current.actions.length > 0
      ? current.actions
      : [{ label: 'OK', style: 'primary' as const }];

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={closeDialog}
    >
      <View
        style={styles.backdrop}
        accessibilityViewIsModal
        accessibilityRole="alert"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{current.title.toUpperCase()}</Text>
          <Text style={styles.message}>{current.message}</Text>

          <View style={styles.actionsRow}>
            {actions.map((action, idx) => {
              const isPrimary = action.style === 'primary';
              const isDestructive = action.style === 'destructive';
              return (
                <Pressable
                  key={`${action.label}-${idx}`}
                  onPress={() => {
                    const cb = action.onPress;
                    closeDialog();
                    if (cb) cb();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    isPrimary && styles.primaryBtn,
                    isDestructive && styles.destructiveBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionText,
                      isPrimary && styles.primaryText,
                      isDestructive && styles.destructiveText,
                    ]}
                  >
                    {action.label.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 15, 22, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.nightSurface,
    borderRadius: 10,
    padding: 18,
    gap: 10,
    borderWidth: 2.5,
    borderColor: PALETTE.dustyMauve,
    borderBottomWidth: 5,
    borderBottomColor: PALETTE.ink,
  },
  title: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 20,
    letterSpacing: 0.6,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    minWidth: 80,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: PALETTE.arcadeOrange,
    borderColor: PALETTE.ink,
  },
  destructiveBtn: {
    backgroundColor: PALETTE.brickRed,
    borderColor: PALETTE.ink,
  },
  actionText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  primaryText: {
    color: PALETTE.ink,
  },
  destructiveText: {
    color: PALETTE.cream,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
