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
import { COLORS } from '../theme/tokens';

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
          <Text style={styles.title}>{current.title}</Text>
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
                    {action.label}
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
    backgroundColor: 'rgba(5, 7, 12, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
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
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 84,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  destructiveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  actionText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryText: {
    color: '#111827',
    fontWeight: '900',
  },
  destructiveText: {
    color: '#FCA5A5',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
