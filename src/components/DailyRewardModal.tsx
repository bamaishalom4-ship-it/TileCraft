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
import { COLORS, FONTS, PALETTE } from '../theme/tokens';

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
                <Ionicons name="flame" size={20} color={PALETTE.arcadeOrange} />
              </View>
              <Text style={styles.title}>DAILY LOGIN STREAK</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close daily rewards"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color={PALETTE.cream} />
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
                  <Text
                    style={[
                      styles.dayLabel,
                      isTodayTarget && styles.dayLabelActive,
                    ]}
                  >
                    DAY {dayNum}
                  </Text>
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
              <ActivityIndicator color={PALETTE.ink} />
            ) : (
              <Text
                style={[
                  styles.claimBtnText,
                  !status.canClaimToday && styles.claimBtnTextDisabled,
                ]}
              >
                {status.canClaimToday
                  ? `CLAIM DAY ${status.nextClaimDay} (+${status.nextRewardCoins} ¢)`
                  : 'CLAIMED TODAY — SEE YOU TOMORROW'}
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
    backgroundColor: 'rgba(14, 15, 22, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.nightSurface,
    borderRadius: 10,
    padding: 18,
    gap: 12,
    borderWidth: 2.5,
    borderColor: PALETTE.dustyMauve,
    borderBottomWidth: 5,
    borderBottomColor: PALETTE.ink,
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
    fontFamily: FONTS.pixel,
    color: PALETTE.cream,
    fontSize: 20,
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: COLORS.nightSurfacePurple,
    borderWidth: 2,
    borderColor: PALETTE.ink,
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
    backgroundColor: COLORS.nightSurfacePurple,
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
    borderWidth: 2,
    borderColor: PALETTE.ink,
  },
  dayBoxWide: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dayBoxDone: {
    borderColor: COLORS.success,
    backgroundColor: '#1B3635',
  },
  dayBoxActive: {
    borderColor: PALETTE.arcadeOrange,
    backgroundColor: PALETTE.cream,
  },
  dayLabel: {
    fontFamily: FONTS.pixel,
    color: PALETTE.sunsetPeach,
    fontSize: 12,
  },
  dayLabelActive: {
    color: PALETTE.brickRed,
  },
  dayCoins: {
    color: PALETTE.cream,
    fontSize: 14,
    fontWeight: '900',
  },
  dayCoinsActive: {
    color: PALETTE.ink,
  },
  todayTag: {
    fontFamily: FONTS.pixel,
    color: PALETTE.arcadeOrangeDeep,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  claimBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: PALETTE.arcadeOrange,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.arcadeOrangeDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnDisabled: {
    backgroundColor: COLORS.nightSurfacePurple,
    borderBottomColor: PALETTE.ink,
  },
  claimBtnText: {
    fontFamily: FONTS.pixel,
    color: PALETTE.ink,
    fontSize: 16,
    letterSpacing: 0.6,
  },
  claimBtnTextDisabled: {
    color: COLORS.textSecondary,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
