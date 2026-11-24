import { Platform } from 'react-native';

export interface RewardedAdOutcome {
  earned: boolean;
  adSessionId: string;
  mode: 'admob-native' | 'expo-preview';
  error?: string;
}

const IOS_TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/1712485313';
const ANDROID_TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/5224354917';

function getRewardedAdUnitId(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS || IOS_TEST_REWARDED_UNIT;
  }
  return process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || ANDROID_TEST_REWARDED_UNIT;
}

/**
 * Loads and presents a Google AdMob Rewarded Video Ad on native dev/production builds.
 *
 * When running inside Expo Go or Web (where the native AdMob binary isn't linked),
 * falls back cleanly to a short simulated ad playback so the entire coin reward
 * pipeline can be verified end-to-end without crashing.
 */
export async function showRewardedAd(): Promise<RewardedAdOutcome> {
  const adSessionId = `ad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (Platform.OS === 'web') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { earned: true, adSessionId, mode: 'expo-preview' };
  }

  try {
    // Dynamic import prevents crashes when running inside Expo Go without native AdMob linking
    const adsModule = await import('react-native-google-mobile-ads');
    const { RewardedAd, RewardedAdEventType, AdEventType } = adsModule;

    const unitId = getRewardedAdUnitId();
    const rewarded = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return await new Promise<RewardedAdOutcome>((resolve) => {
      let earned = false;
      let settled = false;

      const finish = (outcome: RewardedAdOutcome) => {
        if (settled) return;
        settled = true;
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        resolve(outcome);
      };

      const unsubLoaded = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          rewarded.show().catch((err: unknown) => {
            finish({
              earned: false,
              adSessionId,
              mode: 'admob-native',
              error: err instanceof Error ? err.message : 'Failed to display ad',
            });
          });
        }
      );

      const unsubEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          earned = true;
        }
      );

      const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        finish({ earned, adSessionId, mode: 'admob-native' });
      });

      const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, (err: Error) => {
        finish({
          earned: false,
          adSessionId,
          mode: 'admob-native',
          error: err.message,
        });
      });

      rewarded.load();
    });
  } catch {
    // Graceful fallback inside Expo Go (no native AdMob binary linked yet)
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { earned: true, adSessionId, mode: 'expo-preview' };
  }
}
