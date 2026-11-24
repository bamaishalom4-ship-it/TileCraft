import { Platform } from 'react-native';
import type { CoinPack } from '../types/app';

export interface IapPurchaseOutcome {
  ok: boolean;
  transactionId?: string;
  sku?: string;
  mode: 'revenuecat-native' | 'sandbox-simulator';
  cancelled?: boolean;
  error?: string;
}

let rcConfigured = false;

function getRevenueCatApiKey(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
  }
  return '';
}

/**
 * Configures RevenueCat (`react-native-purchases`) when API keys & native bindings exist.
 */
export async function initializeIap(appUserId?: string): Promise<boolean> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey || Platform.OS === 'web') {
    return false;
  }

  try {
    const PurchasesModule = await import('react-native-purchases');
    const Purchases = PurchasesModule.default;

    if (!rcConfigured) {
      Purchases.configure({ apiKey, appUserID: appUserId });
      rcConfigured = true;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Initiates a real-money consumable coin pack purchase via RevenueCat / StoreKit / Play Billing.
 * Falls back cleanly to a sandbox receipt simulator when running in Expo Go / Web
 * or before App Store Connect / Play Console SKUs are configured.
 */
export async function purchaseCoinPackIap(
  pack: CoinPack,
  appUserId?: string
): Promise<IapPurchaseOutcome> {
  const ready = await initializeIap(appUserId);

  if (ready) {
    try {
      const PurchasesModule = await import('react-native-purchases');
      const Purchases = PurchasesModule.default;

      const products = await Purchases.getProducts([pack.sku]);
      if (products.length > 0) {
        const result = await Purchases.purchaseStoreProduct(products[0]);
        const txId =
          result.transaction?.transactionIdentifier ??
          `rc_${pack.sku}_${Date.now()}`;
        return {
          ok: true,
          transactionId: txId,
          sku: pack.sku,
          mode: 'revenuecat-native',
        };
      }
    } catch (err: unknown) {
      const e = err as { userCancelled?: boolean; message?: string };
      if (e?.userCancelled) {
        return { ok: false, cancelled: true, mode: 'revenuecat-native' };
      }
      return {
        ok: false,
        mode: 'revenuecat-native',
        error: e?.message ?? 'Store purchase failed',
      };
    }
  }

  // Sandbox fallback for Expo Go / Web testing
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    ok: true,
    transactionId: `sandbox_${pack.sku}_${Date.now()}`,
    sku: pack.sku,
    mode: 'sandbox-simulator',
  };
}

/**
 * Restores non-consumable entitlements via App Store / Google Play when available.
 */
export async function restoreStorePurchases(): Promise<{
  ok: boolean;
  message: string;
}> {
  const ready = await initializeIap();
  if (!ready) {
    return {
      ok: true,
      message: 'Your TileCraft unlocks and coin balance are synced automatically via your Supabase account.',
    };
  }

  try {
    const PurchasesModule = await import('react-native-purchases');
    await PurchasesModule.default.restorePurchases();
    return { ok: true, message: 'Store purchases restored successfully.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Restore failed.',
    };
  }
}
