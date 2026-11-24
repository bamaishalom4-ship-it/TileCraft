import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoinTransaction, LocalWalletSnapshot } from '../types/economy';
import type { GridSize } from '../types/puzzle';

const WEB_WALLET_KEY = 'tilecraft_wallet_v1';
const WEB_LEDGER_KEY = 'tilecraft_ledger_v1';

export const DEFAULT_WALLET_SNAPSHOT: LocalWalletSnapshot = {
  coins: 200,
  unlockedGridSizes: [3, 4],
  unlockedAllFrames: false,
  dailyStreak: 0,
  lastDailyClaimDate: null,
  rewardedAdsWatchedToday: 0,
  rewardedAdsDate: null,
  updatedAt: new Date(0).toISOString(),
};

interface SQLiteDbLike {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
}

let sqliteDbPromise: Promise<SQLiteDbLike | null> | null = null;

/**
 * Lazily opens the local SQLite database (`tilecraft_wallet.db`) on iOS/Android
 * and creates `wallet_state` + `coin_ledger` tables. Falls back cleanly to
 * AsyncStorage on Web or environments where expo-sqlite native bindings aren't loaded.
 */
async function getNativeSqliteDb(): Promise<SQLiteDbLike | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!sqliteDbPromise) {
    sqliteDbPromise = (async () => {
      try {
        const SQLite = await import('expo-sqlite');
        const db = (await SQLite.openDatabaseAsync('tilecraft_wallet.db')) as unknown as SQLiteDbLike;

        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS wallet_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            coins INTEGER NOT NULL,
            unlocked_grids TEXT NOT NULL,
            unlocked_frames INTEGER NOT NULL,
            daily_streak INTEGER NOT NULL,
            last_daily_claim_date TEXT,
            rewarded_ads_today INTEGER NOT NULL,
            rewarded_ads_date TEXT,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS coin_ledger (
            id TEXT PRIMARY KEY,
            delta INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            tx_type TEXT NOT NULL,
            reference_id TEXT,
            created_at TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0
          );
        `);

        return db;
      } catch {
        return null;
      }
    })();
  }

  return sqliteDbPromise;
}

export async function loadLocalWallet(): Promise<LocalWalletSnapshot> {
  const db = await getNativeSqliteDb();

  if (db) {
    const row = await db.getFirstAsync<{
      coins: number;
      unlocked_grids: string;
      unlocked_frames: number;
      daily_streak: number;
      last_daily_claim_date: string | null;
      rewarded_ads_today: number;
      rewarded_ads_date: string | null;
      updated_at: string;
    }>('SELECT * FROM wallet_state WHERE id = 1');

    if (!row) {
      return { ...DEFAULT_WALLET_SNAPSHOT };
    }

    let parsedGrids: GridSize[] = [3, 4];
    try {
      parsedGrids = JSON.parse(row.unlocked_grids) as GridSize[];
    } catch {
      parsedGrids = [3, 4];
    }

    return {
      coins: row.coins,
      unlockedGridSizes: parsedGrids,
      unlockedAllFrames: row.unlocked_frames === 1,
      dailyStreak: row.daily_streak,
      lastDailyClaimDate: row.last_daily_claim_date,
      rewardedAdsWatchedToday: row.rewarded_ads_today,
      rewardedAdsDate: row.rewarded_ads_date,
      updatedAt: row.updated_at,
    };
  }

  // AsyncStorage fallback (Web / Expo Go fallback)
  try {
    const raw = await AsyncStorage.getItem(WEB_WALLET_KEY);
    if (!raw) return { ...DEFAULT_WALLET_SNAPSHOT };
    return { ...DEFAULT_WALLET_SNAPSHOT, ...(JSON.parse(raw) as Partial<LocalWalletSnapshot>) };
  } catch {
    return { ...DEFAULT_WALLET_SNAPSHOT };
  }
}

export async function saveLocalWallet(snapshot: LocalWalletSnapshot): Promise<void> {
  const db = await getNativeSqliteDb();

  if (db) {
    await db.runAsync(
      `INSERT OR REPLACE INTO wallet_state (
        id, coins, unlocked_grids, unlocked_frames, daily_streak,
        last_daily_claim_date, rewarded_ads_today, rewarded_ads_date, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshot.coins,
        JSON.stringify(snapshot.unlockedGridSizes),
        snapshot.unlockedAllFrames ? 1 : 0,
        snapshot.dailyStreak,
        snapshot.lastDailyClaimDate,
        snapshot.rewardedAdsWatchedToday,
        snapshot.rewardedAdsDate,
        snapshot.updatedAt,
      ]
    );
    return;
  }

  try {
    await AsyncStorage.setItem(WEB_WALLET_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal storage error
  }
}

export async function loadLocalTransactions(limit = 30): Promise<CoinTransaction[]> {
  const db = await getNativeSqliteDb();

  if (db) {
    const rows = await db.getAllAsync<{
      id: string;
      delta: number;
      balance_after: number;
      tx_type: CoinTransaction['txType'];
      reference_id: string | null;
      created_at: string;
      synced: number;
    }>('SELECT * FROM coin_ledger ORDER BY created_at DESC LIMIT ?', [limit]);

    return rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      txType: r.tx_type,
      referenceId: r.reference_id,
      createdAt: r.created_at,
      synced: r.synced === 1,
    }));
  }

  try {
    const raw = await AsyncStorage.getItem(WEB_LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CoinTransaction[];
    return parsed.slice(0, limit);
  } catch {
    return [];
  }
}

export async function appendLocalTransaction(tx: CoinTransaction): Promise<void> {
  const db = await getNativeSqliteDb();

  if (db) {
    await db.runAsync(
      `INSERT OR REPLACE INTO coin_ledger (
        id, delta, balance_after, tx_type, reference_id, created_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.delta,
        tx.balanceAfter,
        tx.txType,
        tx.referenceId,
        tx.createdAt,
        tx.synced ? 1 : 0,
      ]
    );
    return;
  }

  try {
    const existing = await loadLocalTransactions(50);
    const updated = [tx, ...existing.filter((item) => item.id !== tx.id)].slice(0, 50);
    await AsyncStorage.setItem(WEB_LEDGER_KEY, JSON.stringify(updated));
  } catch {
    // Non-fatal storage error
  }
}
