import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

let clientInstance: SupabaseClient | null = null;
/** Cached result of whether the backend allows anonymous sign-in so we never spam HTTP 422s. */
let cachedAnonymousAuthAllowed: boolean | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return clientInstance;
}

/**
 * Checks whether the player already has an existing local Supabase session
 * without making any failing signup network calls.
 */
export async function getExistingSessionUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Queries Supabase's public `/auth/v1/settings` endpoint once per app session
 * to determine if Anonymous Sign-Ins are enabled — preventing avoidable HTTP 422
 * errors on `/auth/v1/signup`.
 */
export async function isAnonymousSignInAvailable(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (cachedAnonymousAuthAllowed !== null) {
    return cachedAnonymousAuthAllowed;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) {
      cachedAnonymousAuthAllowed = false;
      return false;
    }
    const json = (await res.json()) as {
      external?: { anonymous_users?: boolean };
    };
    cachedAnonymousAuthAllowed = Boolean(json?.external?.anonymous_users);
    return cachedAnonymousAuthAllowed;
  } catch {
    return false;
  }
}

export interface AuthBootstrapResult {
  ok: boolean;
  userId?: string;
  username?: string;
  coins?: number;
  reason?: 'unconfigured' | 'anonymous_disabled' | 'network_or_rpc_error';
  message?: string;
}

/**
 * Ensures an authenticated Supabase session ONLY when either a session already
 * exists or Anonymous Sign-Ins are enabled on the backend.
 * Never triggers blind HTTP 422 signup failures.
 */
export async function ensureAuthenticatedUser(): Promise<AuthBootstrapResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      reason: 'unconfigured',
      message: 'Cloud backend is not configured.',
    };
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const anonAllowed = await isAnonymousSignInAvailable();
    if (!anonAllowed) {
      return {
        ok: false,
        reason: 'anonymous_disabled',
        message:
          'Cloud player sign-in is not enabled on this server yet (Anonymous Sign-Ins are disabled).',
      };
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      if (
        error?.message?.toLowerCase().includes('anonymous') ||
        error?.status === 422
      ) {
        cachedAnonymousAuthAllowed = false;
        return {
          ok: false,
          reason: 'anonymous_disabled',
          message:
            'Cloud player sign-in is currently disabled on this server.',
        };
      }
      return {
        ok: false,
        reason: 'network_or_rpc_error',
        message: error?.message ?? 'Could not sign in to TileCraft Cloud.',
      };
    }
    session = data.session;
  }

  const { data: profile, error: profileErr } = await supabase.rpc(
    'ensure_user_profile'
  );

  if (profileErr || !profile) {
    return {
      ok: false,
      reason: 'network_or_rpc_error',
      message: profileErr?.message ?? 'Failed to initialize player profile.',
    };
  }

  return {
    ok: true,
    userId: session.user.id,
    username: profile.username,
    coins: profile.coins,
  };
}
