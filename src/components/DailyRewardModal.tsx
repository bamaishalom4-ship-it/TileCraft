import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DAILY_REWARD_SCHEDULE,
  evaluateDailyStreak,
} from '../utils/economyUtils';
import { useAppStore } from '../store/useAppStore';
import { showAppDialog } from '../store/useDialogStore';
import { COLORS } from '../theme/tokens';

interface DailyRewardModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 7-Day Escalating Daily Login Streak Modal with Escape dismissal and focus restoration.
 */
export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({
  visible,
  onClose,
}) => {
  const [claiming, setClaiming] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const dailyStreak = useAppStore((s) => s.dailyStreak);
  const lastDailyClaimDate = useAppStore((s) => s.lastDailyClaimDate);
  const claimDailyReward = useAppStore((s) => s.claimDailyReward);

  const status = evaluateDailyStreak(lastDailyClaimDate, dailyStreak);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (visible) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    } else if (previousFocusRef.current) {
      const el = previousFocusRef.current;
      previousFocusRef.current = null;
      if (typeof el.focus === 'function' && document.contains(el)) {
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [visible, onClose]);

  const handleClaim = async () => {
    if (claiming || !status.canClaimToday) return;
    setClaiming(true);
    try {
      const res = await claimDailyReward();
      if (res.ok) {
        onClose();
        showAppDialog({
          title: `Day ${status.nextClaimDay} Claimed!`,
          message: `+${res.coinsAwarded} coins added to your TileCraft wallet.`,
          actions: [{ label: 'Nice!', style: 'primary' }],
        });
      } else {
        showAppDialog({
          title: 'Already Claimed',
          message: res.error ?? 'Come back tomorrow!',
        });
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Ionicons name="flame" size={22} color={COLORS.gold} />
              </View>
              <Text style={styles.title}>Daily Login Streak</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close daily rewards"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Log in every day to climb the 7-day coin ladder. Day 7 awards a 200 ¢ chest!
          </Text>

          <View style={styles.daysGrid}>
            {DAILY_REWARD_SCHEDULE.map((coins, idx) => {
              const dayNum = idx + 1;
              const isCompleted = dayNum <= status.currentStreak;
              const isTodayTarget =
                status.canClaimToday && dayNum === status.nextClaimDay;

              return (
                <View
                  key={dayNum}
                  style={[
                    styles.dayBox,
                    dayNum === 7 && styles.dayBoxWide,
                    isCompleted && styles.dayBoxDone,
                    isTodayTarget && styles.dayBoxActive,
                  ]}
                >
                  <Text style={styles.dayLabel}>DAY {dayNum}</Text>
                  <Text
                    style={[
                      styles.dayCoins,
                      isTodayTarget && styles.dayCoinsActive,
                    ]}
                  >
                    +{coins} ¢
                  </Text>
                  {isCompleted ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={COLORS.success}
                    />
                  ) : isTodayTarget ? (
                    <Text style={styles.todayTag}>TODAY</Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={handleClaim}
            disabled={!status.canClaimToday || claiming}
            accessibilityRole="button"
            accessibilityLabel={
              status.canClaimToday
                ? `Claim Day ${status.nextClaimDay} reward of ${status.nextRewardCoins} coins`
                : 'Daily reward already claimed today'
            }
            accessibilityState={{ disabled: !status.canClaimToday || claiming }}
            style={({ pressed }) => [
              styles.claimBtn,
              !status.canClaimToday && styles.claimBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            {claiming ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text
                style={[
                  styles.claimBtnText,
                  !status.canClaimToday && styles.claimBtnTextDisabled,
                ]}
              >
                {status.canClaimToday
                  ? `Claim Day ${status.nextClaimDay} (+${status.nextRewardCoins} ¢)`
                  : 'Claimed Today — See You Tomorrow!'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayBox: {
    width: '31%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayBoxWide: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dayBoxDone: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  dayBoxActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  dayLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  dayCoins: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  dayCoinsActive: {
    color: COLORS.gold,
  },
  todayTag: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  claimBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnDisabled: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  claimBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  claimBtnTextDisabled: {
    color: COLORS.textSecondary,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
