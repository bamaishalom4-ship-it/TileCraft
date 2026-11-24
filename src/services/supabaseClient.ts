import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Returns true when real Supabase project credentials are configured in `.env`.
 * When false, the Marketplace seamlessly runs in Local Sandbox Preview Mode so
 * developers can test all screens & flows before connecting a live project.
 */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

let clientInstance: SupabaseClient | null = null;

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
 * Ensures the player has an active Supabase session (using Anonymous Sign-In
 * for zero-friction onboarding) and bootstraps their `profiles` row.
 */
export async function ensureAuthenticatedUser(): Promise<{
  userId: string;
  username: string;
  coins: number;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(
        error?.message ??
          'Enable Anonymous Sign-Ins in Supabase Dashboard -> Auth -> Providers.'
      );
    }
    session = data.session;
  }

  const { data: profile, error: profileErr } = await supabase.rpc(
    'ensure_user_profile'
  );

  if (profileErr || !profile) {
    throw new Error(profileErr?.message ?? 'Failed to initialize player profile.');
  }

  return {
    userId: session.user.id,
    username: profile.username,
    coins: profile.coins,
  };
}
