import type { CoinPack } from '../types/app';

export interface IapPurchaseOutcome {
  ok: boolean;
  transactionId?: string;
  sku?: string;
  mode: 'revenuecat-native' | 'sandbox-simulator';
  cancelled?: boolean;
  error?: string;
}

/**
 * Web implementation of the IAP service.
 * Keeps native-only `react-native-purchases` out of Web Metro bundles while
 * supporting sandbox checkout testing in the browser.
 */
export async function initializeIap(_appUserId?: string): Promise<boolean> {
  return false;
}

export async function purchaseCoinPackIap(
  pack: CoinPack,
  _appUserId?: string
): Promise<IapPurchaseOutcome> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    ok: true,
    transactionId: `sandbox_web_${pack.sku}_${Date.now()}`,
    sku: pack.sku,
    mode: 'sandbox-simulator',
  };
}

export async function restoreStorePurchases(): Promise<{
  ok: boolean;
  message: string;
}> {
  return {
    ok: true,
    message:
      'Your TileCraft unlocks and coin balance are synced automatically via your Supabase account.',
  };
}
