export interface RewardedAdOutcome {
  earned: boolean;
  adSessionId: string;
  mode: 'admob-native' | 'expo-preview';
  error?: string;
}

/**
 * Web implementation of the rewarded ad service.
 * Keeps native-only `react-native-google-mobile-ads` out of Web Metro bundles
 * while allowing full testing of the ad-to-coin-credit flow in the browser.
 */
export async function showRewardedAd(): Promise<RewardedAdOutcome> {
  const adSessionId = `ad_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { earned: true, adSessionId, mode: 'expo-preview' };
}
