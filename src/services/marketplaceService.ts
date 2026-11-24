import type {
  DownloadPuzzleResult,
  FlagPuzzleResult,
  FlagReason,
  MarketplacePuzzle,
  PublishPuzzlePayload,
  PublishPuzzleResult,
} from '../types/marketplace';
import type { GridSize } from '../types/puzzle';
import {
  ensureAuthenticatedUser,
  getExistingSessionUserId,
  getSupabaseClient,
  isAnonymousSignInAvailable,
  isSupabaseConfigured,
} from './supabaseClient';
import { validatePuzzleTitleSafety } from '../utils/marketplaceUtils';

export type MarketplaceFeedStatus =
  | 'ready'
  | 'empty'
  | 'offline'
  | 'backend-error'
  | 'unconfigured';

export interface MarketplaceFetchResult {
  status: MarketplaceFeedStatus;
  puzzles: MarketplacePuzzle[];
  canPublish: boolean;
  publishDisabledReason?: string;
  errorMessage?: string;
}

interface PuzzleRow {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  category: MarketplacePuzzle['category'];
  image_url: string;
  storage_path: string;
  recommended_grid_size: number;
  coin_price: number;
  download_count: number;
  flag_count: number;
  moderation_status: MarketplacePuzzle['moderationStatus'];
  created_at: string;
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function mapPuzzleRow(
  row: PuzzleRow,
  ownedSet: Set<string>,
  currentUserId: string | null
): MarketplacePuzzle {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    storagePath: row.storage_path,
    recommendedGridSize: (row.recommended_grid_size as GridSize) || 4,
    coinPrice: row.coin_price,
    downloadCount: row.download_count,
    flagCount: row.flag_count,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
    isOwned:
      ownedSet.has(row.id) ||
      (currentUserId !== null && row.author_id === currentUserId),
  };
}

/**
 * Fetches approved UGC puzzles from Supabase with distinct offline, unconfigured,
 * backend-error, empty, and ready states. Never invents fake listings or fires
 * blind HTTP 422 anonymous signup calls.
 */
export async function fetchMarketplacePuzzles(): Promise<MarketplaceFetchResult> {
  if (isBrowserOffline()) {
    return {
      status: 'offline',
      puzzles: [],
      canPublish: false,
      publishDisabledReason:
        'You are offline. Reconnect to the internet to browse or publish community puzzles.',
      errorMessage:
        'You are currently offline. Classic mode and your saved photo puzzles still work without an internet connection.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: 'unconfigured',
      puzzles: [],
      canPublish: false,
      publishDisabledReason:
        'Community publishing is coming soon once the Marketplace backend is connected.',
      errorMessage:
        'Community Marketplace is in preview mode. You can play Classic puzzles and craft private photo puzzles on this device.',
    };
  }

  const supabase = getSupabaseClient()!;

  try {
    const [existingUserId, anonAllowed, puzzlesRes] = await Promise.all([
      getExistingSessionUserId(),
      isAnonymousSignInAvailable(),
      supabase
        .from('puzzles')
        .select('*')
        .eq('moderation_status', 'approved')
        .order('download_count', { ascending: false })
        .limit(60),
    ]);

    if (puzzlesRes.error) {
      const msg = puzzlesRes.error.message ?? '';
      const isPermissionDenied =
        puzzlesRes.error.code === '42501' ||
        msg.toLowerCase().includes('permission denied');

      return {
        status: 'backend-error',
        puzzles: [],
        canPublish: false,
        publishDisabledReason:
          'Marketplace publishing is temporarily unavailable while server access is being configured.',
        errorMessage: isPermissionDenied
          ? 'The community catalog is temporarily unavailable while backend permissions are being finalized. Classic mode and private photo puzzles work normally.'
          : `Could not reach the community catalog (${msg || 'network error'}). Please try again later.`,
      };
    }

    let ownedSet = new Set<string>();
    if (existingUserId) {
      const { data: downloadRows } = await supabase
        .from('puzzle_downloads')
        .select('puzzle_id')
        .eq('user_id', existingUserId);
      ownedSet = new Set(
        (downloadRows ?? []).map((r: { puzzle_id: string }) => r.puzzle_id)
      );
    }

    const mapped = (puzzlesRes.data ?? []).map((row) =>
      mapPuzzleRow(row as PuzzleRow, ownedSet, existingUserId)
    );

    const canPublish = Boolean(existingUserId) || anonAllowed;
    const publishDisabledReason = canPublish
      ? undefined
      : 'Public publishing requires player sign-in to be enabled on the backend. Private photo puzzles stay saved on your device.';

    return {
      status: mapped.length > 0 ? 'ready' : 'empty',
      puzzles: mapped,
      canPublish,
      publishDisabledReason,
    };
  } catch (err) {
    return {
      status: isBrowserOffline() ? 'offline' : 'backend-error',
      puzzles: [],
      canPublish: false,
      publishDisabledReason:
        'Could not connect to the Marketplace right now. Please try again later.',
      errorMessage:
        err instanceof Error
          ? err.message
          : 'Unable to load the community catalog right now.',
    };
  }
}

/**
 * Uploads a cropped 1:1 square image to Supabase Storage (`puzzle-images`),
 * inserts a `pending` metadata row into `puzzles`, and triggers the
 * `moderate-puzzle` Edge Function for automated NSFW scanning.
 */
export async function publishPuzzleToMarketplace(
  payload: PublishPuzzlePayload
): Promise<PublishPuzzleResult> {
  if (isBrowserOffline()) {
    return {
      ok: false,
      message:
        'You are offline. Connect to the internet to publish to the Marketplace.',
    };
  }

  const titleCheck = validatePuzzleTitleSafety(payload.title);
  if (!titleCheck.valid) {
    return {
      ok: false,
      moderationStatus: 'rejected',
      message: titleCheck.reason ?? 'Invalid puzzle title.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message:
        'Marketplace publishing is not enabled in this build yet. Your photo remains saved privately on this device.',
    };
  }

  const supabase = getSupabaseClient()!;
  const auth = await ensureAuthenticatedUser();
  if (!auth.ok || !auth.userId || !auth.username) {
    return {
      ok: false,
      message:
        auth.message ??
        'A valid cloud session is required to publish puzzles publicly.',
    };
  }

  // 1. Read local cropped JPEG as ArrayBuffer for cross-platform Storage upload
  const fileResponse = await fetch(payload.localImageUri);
  const arrayBuffer = await fileResponse.arrayBuffer();
  const storagePath = `${auth.userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('puzzle-images')
    .upload(storagePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: `Image upload failed: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('puzzle-images').getPublicUrl(storagePath);

  // 2. Create metadata row (RLS enforces moderation_status = 'pending')
  const { data: inserted, error: insertError } = await supabase
    .from('puzzles')
    .insert({
      author_id: auth.userId,
      author_name: auth.username,
      title: payload.title.trim(),
      category: payload.category,
      storage_path: storagePath,
      image_url: publicUrl,
      recommended_grid_size: payload.recommendedGridSize,
      coin_price: payload.coinPrice,
      moderation_status: 'pending',
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from('puzzle-images').remove([storagePath]);
    return {
      ok: false,
      message: `Could not save puzzle metadata: ${insertError?.message ?? 'Unknown error'}`,
    };
  }

  // 3. Trigger automated NSFW moderation Edge Function
  const { data: modResult, error: modError } = await supabase.functions.invoke(
    'moderate-puzzle',
    {
      body: { puzzleId: inserted.id },
    }
  );

  const finalStatus: MarketplacePuzzle['moderationStatus'] = modError
    ? 'pending'
    : (modResult?.status ?? 'pending');

  const mapped = mapPuzzleRow(
    { ...(inserted as PuzzleRow), moderation_status: finalStatus },
    new Set([inserted.id]),
    auth.userId
  );

  if (finalStatus === 'rejected') {
    return {
      ok: false,
      moderationStatus: 'rejected',
      message:
        modResult?.reason ??
        'This image did not pass automated safety screening and was removed.',
    };
  }

  if (finalStatus === 'approved') {
    return {
      ok: true,
      puzzle: mapped,
      moderationStatus: 'approved',
      message: 'Approved by safety check and live on the TileCraft Marketplace!',
    };
  }

  return {
    ok: true,
    puzzle: mapped,
    moderationStatus: 'pending',
    message:
      'Uploaded successfully! Your puzzle is queued for moderation review before appearing publicly.',
  };
}

/**
 * Unlocks/downloads a marketplace puzzle using an atomic PostgreSQL RPC.
 */
export async function downloadMarketplacePuzzle(
  puzzle: MarketplacePuzzle,
  currentLocalBalance: number
): Promise<DownloadPuzzleResult> {
  if (isBrowserOffline()) {
    return {
      ok: false,
      error: 'Connect to the internet to download Marketplace puzzles.',
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: 'Marketplace backend is not configured.',
    };
  }

  const supabase = getSupabaseClient()!;
  const auth = await ensureAuthenticatedUser();
  if (!auth.ok) {
    return {
      ok: false,
      error:
        auth.message ??
        'Sign-in is required to download puzzles from the Marketplace.',
    };
  }

  const { data, error } = await supabase.rpc('purchase_marketplace_puzzle', {
    p_puzzle_id: puzzle.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data?.ok) {
    return { ok: false, error: data?.error ?? 'Purchase failed' };
  }

  return {
    ok: true,
    alreadyOwned: Boolean(data.alreadyOwned),
    coinsCharged: Number(data.coinsCharged ?? 0),
    newBalance: Number(data.newBalance ?? currentLocalBalance),
  };
}

/**
 * Reports an inappropriate or NSFW puzzle. Reaching 3 unique flags automatically
 * quarantines the puzzle via the Postgres trigger `trg_puzzle_flag_insert`.
 */
export async function flagMarketplacePuzzle(
  puzzleId: string,
  reason: FlagReason,
  details?: string
): Promise<FlagPuzzleResult> {
  if (isBrowserOffline()) {
    return {
      ok: false,
      message: 'Connect to the internet to submit a report.',
    };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Marketplace backend is not configured.' };
  }

  const supabase = getSupabaseClient()!;
  const auth = await ensureAuthenticatedUser();
  if (!auth.ok || !auth.userId) {
    return {
      ok: false,
      message: auth.message ?? 'Sign-in is required to report puzzles.',
    };
  }

  const { error } = await supabase.from('puzzle_flags').insert({
    puzzle_id: puzzleId,
    reporter_id: auth.userId,
    reason,
    details: details?.trim() || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'You have already reported this puzzle.' };
    }
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message:
      'Report submitted. Puzzles reaching 3 community flags are automatically quarantined.',
  };
}
