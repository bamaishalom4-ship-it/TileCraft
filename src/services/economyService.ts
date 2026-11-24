import type { CoinPack, ShopUpgrade } from '../types/app';
import type {
  CoinTransaction,
  CoinTxType,
  LocalWalletSnapshot,
} from '../types/economy';
import type { GridSize } from '../types/puzzle';
import {
  appendLocalTransaction,
  loadLocalTransactions,
  loadLocalWallet,
  saveLocalWallet,
} from './localWalletDb';
import {
  ensureAuthenticatedUser,
  getExistingSessionUserId,
  getSupabaseClient,
  isSupabaseConfigured,
} from './supabaseClient';
import {
  evaluateDailyStreak,
  getUtcDateKey,
  MAX_REWARDED_ADS_PER_DAY,
  REWARDED_AD_COINS,
} from '../utils/economyUtils';
import { showRewardedAd } from './adMobService';
import { purchaseCoinPackIap } from './iapService';

export interface HydratedEconomy {
  wallet: LocalWalletSnapshot;
  transactions: CoinTransaction[];
  syncedWithCloud: boolean;
}

/**
 * Hydrates wallet instantly from local SQLite/AsyncStorage, then reconciles
 * authoritative balance, unlocks, streak, and recent ledger from Supabase when online.
 */
export async function hydrateAndSyncEconomy(): Promise<HydratedEconomy> {
  let wallet = await loadLocalWallet();
  let transactions = await loadLocalTransactions(30);
  let syncedWithCloud = false;

  if (!isSupabaseConfigured()) {
    return { wallet, transactions, syncedWithCloud };
  }

  try {
    const supabase = getSupabaseClient()!;
    // Only sync with cloud on boot if a session already exists (avoids background 422 signup spam)
    const existingUserId = await getExistingSessionUserId();
    if (!existingUserId) {
      return { wallet, transactions, syncedWithCloud };
    }

    const [{ data: profile }, { data: remoteTxs }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'coins, unlocked_grid_sizes, unlocked_all_frames, daily_streak, last_daily_claim_at'
        )
        .eq('id', existingUserId)
        .single(),
      supabase
        .from('coin_transactions')
        .select('id, delta, balance_after, tx_type, reference_id, created_at')
        .eq('user_id', existingUserId)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (profile) {
      const todayKey = getUtcDateKey();
      const cloudLastClaimDate = profile.last_daily_claim_at
        ? getUtcDateKey(new Date(profile.last_daily_claim_at))
        : null;

      wallet = {
        coins: profile.coins,
        unlockedGridSizes: (profile.unlocked_grid_sizes as GridSize[]) ?? [3, 4],
        unlockedAllFrames: Boolean(profile.unlocked_all_frames),
        dailyStreak: profile.daily_streak ?? 0,
        lastDailyClaimDate: cloudLastClaimDate,
        rewardedAdsWatchedToday:
          wallet.rewardedAdsDate === todayKey ? wallet.rewardedAdsWatchedToday : 0,
        rewardedAdsDate: todayKey,
        updatedAt: new Date().toISOString(),
      };
      await saveLocalWallet(wallet);
      syncedWithCloud = true;
    }

    if (remoteTxs && remoteTxs.length > 0) {
      transactions = remoteTxs.map((tx) => ({
        id: tx.id,
        delta: tx.delta,
        balanceAfter: tx.balance_after,
        txType: tx.tx_type as CoinTxType,
        referenceId: tx.reference_id,
        createdAt: tx.created_at,
        synced: true,
      }));
      for (const tx of transactions.slice(0, 15)) {
        await appendLocalTransaction(tx);
      }
    }
  } catch {
    // Offline or migration 002 not yet applied — local SQLite wallet remains active
  }

  return { wallet, transactions, syncedWithCloud };
}

async function recordLocalAndPersist(
  wallet: LocalWalletSnapshot,
  tx: Omit<CoinTransaction, 'id' | 'createdAt'>
): Promise<{ wallet: LocalWalletSnapshot; tx: CoinTransaction }> {
  const fullTx: CoinTransaction = {
    ...tx,
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([saveLocalWallet(wallet), appendLocalTransaction(fullTx)]);
  return { wallet, tx: fullTx };
}

/**
 * Claims the player's 7-day escalating daily login reward (Supabase RPC + SQLite cache).
 */
export async function claimDailyLoginReward(
  currentWallet: LocalWalletSnapshot
): Promise<{
  ok: boolean;
  coinsAwarded: number;
  wallet: LocalWalletSnapshot;
  tx?: CoinTransaction;
  error?: string;
}> {
  const localEval = evaluateDailyStreak(
    currentWallet.lastDailyClaimDate,
    currentWallet.dailyStreak
  );

  if (!localEval.canClaimToday) {
    return {
      ok: false,
      coinsAwarded: 0,
      wallet: currentWallet,
      error: 'You already claimed today’s daily streak reward. Come back tomorrow!',
    };
  }

  const today = getUtcDateKey();

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const auth = await ensureAuthenticatedUser();
      if (auth.ok) {
        const { data, error } = await supabase.rpc('claim_daily_login_reward');

        if (!error && data) {
          if (!data.ok) {
            return {
              ok: false,
              coinsAwarded: 0,
              wallet: {
                ...currentWallet,
                coins: Number(data.newBalance ?? currentWallet.coins),
                dailyStreak: Number(data.streak ?? currentWallet.dailyStreak),
                lastDailyClaimDate: today,
              },
              error: data.error ?? 'Already claimed today.',
            };
          }

          const nextWallet: LocalWalletSnapshot = {
            ...currentWallet,
            coins: Number(data.newBalance),
            dailyStreak: Number(data.streak),
            lastDailyClaimDate: today,
            updatedAt: new Date().toISOString(),
          };

          const { tx } = await recordLocalAndPersist(nextWallet, {
            delta: Number(data.coinsAwarded),
            balanceAfter: nextWallet.coins,
            txType: 'daily_reward',
            referenceId: today,
            synced: true,
          });

          return { ok: true, coinsAwarded: Number(data.coinsAwarded), wallet: nextWallet, tx };
        }
      }
    } catch {
      // Fallback to local grant if offline
    }
  }

  const nextWallet: LocalWalletSnapshot = {
    ...currentWallet,
    coins: currentWallet.coins + localEval.nextRewardCoins,
    dailyStreak: localEval.nextClaimDay,
    lastDailyClaimDate: today,
    updatedAt: new Date().toISOString(),
  };

  const { tx } = await recordLocalAndPersist(nextWallet, {
    delta: localEval.nextRewardCoins,
    balanceAfter: nextWallet.coins,
    txType: 'daily_reward',
    referenceId: today,
    synced: false,
  });

  return { ok: true, coinsAwarded: localEval.nextRewardCoins, wallet: nextWallet, tx };
}

/**
 * Plays a Rewarded Video Ad (AdMob or Expo preview) and credits coins atomically.
 */
export async function watchRewardedAdForCoins(
  currentWallet: LocalWalletSnapshot
): Promise<{
  ok: boolean;
  coinsAwarded: number;
  wallet: LocalWalletSnapshot;
  tx?: CoinTransaction;
  adMode?: 'admob-native' | 'expo-preview';
  error?: string;
}> {
  const today = getUtcDateKey();
  const watchedToday =
    currentWallet.rewardedAdsDate === today ? currentWallet.rewardedAdsWatchedToday : 0;

  if (watchedToday >= MAX_REWARDED_ADS_PER_DAY) {
    return {
      ok: false,
      coinsAwarded: 0,
      wallet: currentWallet,
      error: `Daily rewarded ad limit reached (${MAX_REWARDED_ADS_PER_DAY}/day).`,
    };
  }

  const adOutcome = await showRewardedAd();
  if (!adOutcome.earned) {
    return {
      ok: false,
      coinsAwarded: 0,
      wallet: currentWallet,
      adMode: adOutcome.mode,
      error: adOutcome.error ?? 'Watch the full video to earn your coins.',
    };
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const auth = await ensureAuthenticatedUser();
      if (auth.ok) {
        const { data, error } = await supabase.rpc('grant_rewarded_ad_coins', {
          p_ad_session_id: adOutcome.adSessionId,
        });

        if (!error && data) {
          if (!data.ok) {
            return {
              ok: false,
              coinsAwarded: 0,
              wallet: currentWallet,
              adMode: adOutcome.mode,
              error: data.error,
            };
          }

          const awarded = Number(data.coinsAwarded ?? REWARDED_AD_COINS);
          const nextWallet: LocalWalletSnapshot = {
            ...currentWallet,
            coins: Number(data.newBalance),
            rewardedAdsWatchedToday: watchedToday + 1,
            rewardedAdsDate: today,
            updatedAt: new Date().toISOString(),
          };

          const { tx } = await recordLocalAndPersist(nextWallet, {
            delta: awarded,
            balanceAfter: nextWallet.coins,
            txType: 'rewarded_ad',
            referenceId: adOutcome.adSessionId,
            synced: true,
          });

          return {
            ok: true,
            coinsAwarded: awarded,
            wallet: nextWallet,
            tx,
            adMode: adOutcome.mode,
          };
        }
      }
    } catch {
      // Fallback to local storage
    }
  }

  const nextWallet: LocalWalletSnapshot = {
    ...currentWallet,
    coins: currentWallet.coins + REWARDED_AD_COINS,
    rewardedAdsWatchedToday: watchedToday + 1,
    rewardedAdsDate: today,
    updatedAt: new Date().toISOString(),
  };

  const { tx } = await recordLocalAndPersist(nextWallet, {
    delta: REWARDED_AD_COINS,
    balanceAfter: nextWallet.coins,
    txType: 'rewarded_ad',
    referenceId: adOutcome.adSessionId,
    synced: false,
  });

  return {
    ok: true,
    coinsAwarded: REWARDED_AD_COINS,
    wallet: nextWallet,
    tx,
    adMode: adOutcome.mode,
  };
}

/**
 * Spends coins for an in-game Hint (atomic Supabase RPC + SQLite cache).
 */
export async function spendCoinsForHint(
  currentWallet: LocalWalletSnapshot,
  hintCost: number
): Promise<{
  ok: boolean;
  wallet: LocalWalletSnapshot;
  tx?: CoinTransaction;
  error?: string;
}> {
  if (currentWallet.coins < hintCost) {
    return { ok: false, wallet: currentWallet, error: 'Not enough coins' };
  }

  const refId = `hint_${Date.now()}`;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const auth = await ensureAuthenticatedUser();
      if (auth.ok) {
        const { data, error } = await supabase.rpc('spend_coins', {
          p_amount: hintCost,
          p_tx_type: 'hint',
          p_reference_id: refId,
        });

        if (!error && data) {
          if (!data.ok) {
            return { ok: false, wallet: currentWallet, error: data.error };
          }
          const nextWallet: LocalWalletSnapshot = {
            ...currentWallet,
            coins: Number(data.newBalance),
            updatedAt: new Date().toISOString(),
          };
          const { tx } = await recordLocalAndPersist(nextWallet, {
            delta: -hintCost,
            balanceAfter: nextWallet.coins,
            txType: 'hint',
            referenceId: refId,
            synced: true,
          });
          return { ok: true, wallet: nextWallet, tx };
        }
      }
    } catch {
      // Offline local deduction fallback
    }
  }

  const nextWallet: LocalWalletSnapshot = {
    ...currentWallet,
    coins: currentWallet.coins - hintCost,
    updatedAt: new Date().toISOString(),
  };

  const { tx } = await recordLocalAndPersist(nextWallet, {
    delta: -hintCost,
    balanceAfter: nextWallet.coins,
    txType: 'hint',
    referenceId: refId,
    synced: false,
  });

  return { ok: true, wallet: nextWallet, tx };
}

/**
 * Unlocks a Shop upgrade (`unlock_5x5` or `frame_pack`) atomically on backend + local SQLite.
 */
export async function unlockUpgradeSynced(
  currentWallet: LocalWalletSnapshot,
  upgrade: ShopUpgrade
): Promise<{
  ok: boolean;
  wallet: LocalWalletSnapshot;
  tx?: CoinTransaction;
  error?: string;
}> {
  if (
    (upgrade.id === 'unlock_5x5' && currentWallet.unlockedGridSizes.includes(5)) ||
    (upgrade.id === 'frame_pack' && currentWallet.unlockedAllFrames)
  ) {
    return { ok: false, wallet: currentWallet, error: 'Already owned' };
  }

  if (currentWallet.coins < upgrade.coinCost) {
    return { ok: false, wallet: currentWallet, error: 'Not enough coins' };
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const auth = await ensureAuthenticatedUser();
      if (auth.ok) {
        const { data, error } = await supabase.rpc('unlock_shop_upgrade', {
          p_upgrade_id: upgrade.id,
        });

        if (!error && data) {
          if (!data.ok) {
            return { ok: false, wallet: currentWallet, error: data.error };
          }
          const nextWallet: LocalWalletSnapshot = {
            ...currentWallet,
            coins: Number(data.newBalance),
            unlockedGridSizes:
              upgrade.id === 'unlock_5x5'
                ? Array.from(new Set([...currentWallet.unlockedGridSizes, 5])) as GridSize[]
                : currentWallet.unlockedGridSizes,
            unlockedAllFrames:
              upgrade.id === 'frame_pack' ? true : currentWallet.unlockedAllFrames,
            updatedAt: new Date().toISOString(),
          };
          const { tx } = await recordLocalAndPersist(nextWallet, {
            delta: -upgrade.coinCost,
            balanceAfter: nextWallet.coins,
            txType: 'upgrade_unlock',
            referenceId: upgrade.id,
            synced: true,
          });
          return { ok: true, wallet: nextWallet, tx };
        }
      }
    } catch {
      // Offline fallback
    }
  }

  const nextWallet: LocalWalletSnapshot = {
    ...currentWallet,
    coins: currentWallet.coins - upgrade.coinCost,
    unlockedGridSizes:
      upgrade.id === 'unlock_5x5'
        ? Array.from(new Set([...currentWallet.unlockedGridSizes, 5])) as GridSize[]
        : currentWallet.unlockedGridSizes,
    unlockedAllFrames:
      upgrade.id === 'frame_pack' ? true : currentWallet.unlockedAllFrames,
    updatedAt: new Date().toISOString(),
  };

  const { tx } = await recordLocalAndPersist(nextWallet, {
    delta: -upgrade.coinCost,
    balanceAfter: nextWallet.coins,
    txType: 'upgrade_unlock',
    referenceId: upgrade.id,
    synced: false,
  });

  return { ok: true, wallet: nextWallet, tx };
}

/**
 * Credits a Puzzle Win reward to Supabase + local SQLite.
 */
export async function creditPuzzleWinSynced(
  currentWallet: LocalWalletSnapshot,
  gridSize: GridSize,
  stars: 1 | 2 | 3,
  fallbackCoins: number,
  runId: string
): Promise<{ wallet: LocalWalletSnapshot; tx: CoinTransaction }> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const auth = await ensureAuthenticatedUser();
      if (auth.ok) {
        const { data, error } = await supabase.rpc('grant_puzzle_win_reward', {
          p_grid_size: gridSize,
          p_stars: stars,
          p_run_id: runId,
        });

        if (!error && data?.ok) {
          const awarded = Number(data.coinsAwarded ?? fallbackCoins);
          const nextWallet: LocalWalletSnapshot = {
            ...currentWallet,
            coins: Number(data.newBalance),
            updatedAt: new Date().toISOString(),
          };
          return await recordLocalAndPersist(nextWallet, {
            delta: awarded,
            balanceAfter: nextWallet.coins,
            txType: 'puzzle_win',
            referenceId: runId,
            synced: true,
          });
        }
      }
    } catch {
      // Offline fallback
    }
  }

  const nextWallet: LocalWalletSnapshot = {
    ...currentWallet,
    coins: currentWallet.coins + fallbackCoins,
    updatedAt: new Date().toISOString(),
  };

  return await recordLocalAndPersist(nextWallet, {
    delta: fallbackCoins,
    balanceAfter: nextWallet.coins,
    txType: 'puzzle_win',
    referenceId: runId,
    synced: false,
  });
}

/**
 * Executes a real-money IAP coin pack purchase (RevenueCat / Sandbox) and credits
 * coins idempotently via Supabase RPC + local SQLite ledger.
 */
export async function buyCoinPackSynced(
  currentWallet: LocalWalletSnapshot,
  pack: CoinPack
): Promise<{
  ok: boolean;
  coinsAwarded: number;
  wallet: LocalWalletSnapshot;
  tx?: CoinTransaction;
  mode?: 'revenuecat-native' | 'sandbox-simulator';
  cancelled?: boolean;
  error?: string;
}> {
  const iapOutcome = await purchaseCoinPackIap(pack);
  if (!iapOutcome.ok) {
    return {
      ok: false,
      coinsAwarded: 0,
      wallet: currentWallet,
      mode: iapOutcome.mode,
      cancelled: iapOutcome.cancelled,
      error: iapOutcome.error,
    };
  }

  const totalCoins = pack.coins + pack.bonusCoins;
  const txId = iapOutcome.transactionId ?? `iap_${Date.now()}`;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const auth = await ensureAuthenticatedUser();
      if (auth.ok) {
        const { data, error } = await supabase.rpc('credit_iap_coin_pack', {
          p_sku: pack.sku,
          p_transaction_id: txId,
        });

        if (!error && data?.ok) {
          const awarded = Number(data.coinsAwarded ?? totalCoins);
          const nextWallet: LocalWalletSnapshot = {
            ...currentWallet,
            coins: Number(data.newBalance),
            updatedAt: new Date().toISOString(),
          };
          const { tx } = await recordLocalAndPersist(nextWallet, {
            delta: awarded,
            balanceAfter: nextWallet.coins,
            txType: 'iap_pack',
            referenceId: txId,
            synced: true,
          });
          return {
            ok: true,
            coinsAwarded: awarded,
            wallet: nextWallet,
            tx,
            mode: iapOutcome.mode,
          };
        }
      }
    } catch {
      // Offline fallback
    }
  }

  const nextWallet: LocalWalletSnapshot = {
    ...currentWallet,
    coins: currentWallet.coins + totalCoins,
    updatedAt: new Date().toISOString(),
  };

  const { tx } = await recordLocalAndPersist(nextWallet, {
    delta: totalCoins,
    balanceAfter: nextWallet.coins,
    txType: 'iap_pack',
    referenceId: txId,
    synced: false,
  });

  return {
    ok: true,
    coinsAwarded: totalCoins,
    wallet: nextWallet,
    tx,
    mode: iapOutcome.mode,
  };
}
