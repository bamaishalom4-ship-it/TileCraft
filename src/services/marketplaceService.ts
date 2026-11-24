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
  getSupabaseClient,
  isSupabaseConfigured,
} from './supabaseClient';
import {
  shouldAutoQuarantine,
  validatePuzzleTitleSafety,
} from '../utils/marketplaceUtils';

/**
 * Curated local sandbox puzzles shown only when `.env` is not yet linked to Supabase.
 * Uses clean remote square Unsplash images so you can test the Marketplace UI immediately.
 */
const SANDBOX_INITIAL_PUZZLES: MarketplacePuzzle[] = [
  {
    id: 'demo_retro_arcade',
    authorId: 'creator_1',
    authorName: 'PixelMancer',
    title: 'Neon Arcade Cabinet',
    category: 'Retro',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&h=800&q=80',
    storagePath: 'demo/retro.jpg',
    recommendedGridSize: 4,
    coinPrice: 25,
    downloadCount: 342,
    flagCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'demo_shiba_smile',
    authorId: 'creator_2',
    authorName: 'PawStudio',
    title: 'Golden Shiba Smile',
    category: 'Pets',
    imageUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&h=800&q=80',
    storagePath: 'demo/shiba.jpg',
    recommendedGridSize: 3,
    coinPrice: 0,
    downloadCount: 518,
    flagCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-11-21T14:30:00Z',
  },
  {
    id: 'demo_kyoto_sunset',
    authorId: 'creator_3',
    authorName: 'WanderLens',
    title: 'Kyoto Lantern Alley',
    category: 'Travel',
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&h=800&q=80',
    storagePath: 'demo/kyoto.jpg',
    recommendedGridSize: 4,
    coinPrice: 30,
    downloadCount: 215,
    flagCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-11-22T09:15:00Z',
  },
  {
    id: 'demo_alpine_peak',
    authorId: 'creator_4',
    authorName: 'AlpineCraft',
    title: 'Emerald Glacier Lake',
    category: 'Nature',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&h=800&q=80',
    storagePath: 'demo/alpine.jpg',
    recommendedGridSize: 5,
    coinPrice: 40,
    downloadCount: 164,
    flagCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-11-23T18:00:00Z',
  },
];

// In-memory sandbox state (only active when Supabase .env is not configured)
let sandboxPuzzles: MarketplacePuzzle[] = [...SANDBOX_INITIAL_PUZZLES];
const sandboxOwnedIds = new Set<string>(['demo_shiba_smile']);
const sandboxFlaggedByMe = new Set<string>();

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
 * Fetches approved UGC puzzles from Supabase (or Local Sandbox Mode when unconfigured).
 */
export async function fetchMarketplacePuzzles(): Promise<{
  puzzles: MarketplacePuzzle[];
  isLiveBackend: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      isLiveBackend: false,
      puzzles: sandboxPuzzles.map((p) => ({
        ...p,
        isOwned: sandboxOwnedIds.has(p.id) || p.authorId === 'local_me',
      })),
    };
  }

  const supabase = getSupabaseClient()!;
  const auth = await ensureAuthenticatedUser();

  const [{ data: puzzleRows, error: puzzlesErr }, { data: downloadRows }] =
    await Promise.all([
      supabase
        .from('puzzles')
        .select('*')
        .eq('moderation_status', 'approved')
        .order('download_count', { ascending: false })
        .limit(60),
      auth
        ? supabase
            .from('puzzle_downloads')
            .select('puzzle_id')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [] as Array<{ puzzle_id: string }> }),
    ]);

  if (puzzlesErr) {
    throw new Error(puzzlesErr.message);
  }

  const ownedSet = new Set(
    (downloadRows ?? []).map((r: { puzzle_id: string }) => r.puzzle_id)
  );

  return {
    isLiveBackend: true,
    puzzles: (puzzleRows ?? []).map((row) =>
      mapPuzzleRow(row as PuzzleRow, ownedSet, auth?.userId ?? null)
    ),
  };
}

/**
 * Uploads a cropped 1:1 square image to Supabase Storage (`puzzle-images`),
 * inserts a `pending` metadata row into `puzzles`, and triggers the
 * `moderate-puzzle` Edge Function for automated NSFW scanning.
 */
export async function publishPuzzleToMarketplace(
  payload: PublishPuzzlePayload
): Promise<PublishPuzzleResult> {
  const titleCheck = validatePuzzleTitleSafety(payload.title);
  if (!titleCheck.valid) {
    return {
      ok: false,
      moderationStatus: 'rejected',
      message: titleCheck.reason ?? 'Invalid puzzle title.',
    };
  }

  // Local Sandbox Preview fallback
  if (!isSupabaseConfigured()) {
    const created: MarketplacePuzzle = {
      id: `local_ugc_${Date.now()}`,
      authorId: 'local_me',
      authorName: 'You (Sandbox)',
      title: payload.title.trim(),
      category: payload.category,
      imageUrl: payload.localImageUri,
      storagePath: `local/${Date.now()}.jpg`,
      recommendedGridSize: payload.recommendedGridSize,
      coinPrice: payload.coinPrice,
      downloadCount: 0,
      flagCount: 0,
      moderationStatus: 'approved',
      createdAt: new Date().toISOString(),
      isOwned: true,
    };
    sandboxPuzzles = [created, ...sandboxPuzzles];
    sandboxOwnedIds.add(created.id);
    return {
      ok: true,
      puzzle: created,
      moderationStatus: 'approved',
      message: 'Published to Local Sandbox Marketplace! Add your Supabase .env keys to publish globally.',
    };
  }

  const supabase = getSupabaseClient()!;
  const auth = await ensureAuthenticatedUser();
  if (!auth) {
    return { ok: false, message: 'Sign-in failed. Please try again.' };
  }

  // 1. Read local cropped JPEG as ArrayBuffer for React Native-safe Storage upload
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
    // Clean up orphaned storage file if DB insert failed
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
        'This image did not pass automated NSFW safety screening and was removed.',
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
 * Unlocks/downloads a marketplace puzzle using an atomic PostgreSQL RPC
 * (deducts coins, credits creator royalty, records ownership, increments downloads).
 */
export async function downloadMarketplacePuzzle(
  puzzle: MarketplacePuzzle,
  localSpendCoins: (amount: number) => boolean,
  currentLocalBalance: number
): Promise<DownloadPuzzleResult> {
  // Local Sandbox Preview fallback
  if (!isSupabaseConfigured()) {
    if (sandboxOwnedIds.has(puzzle.id) || puzzle.authorId === 'local_me') {
      return {
        ok: true,
        alreadyOwned: true,
        coinsCharged: 0,
        newBalance: currentLocalBalance,
      };
    }

    if (puzzle.coinPrice > 0 && !localSpendCoins(puzzle.coinPrice)) {
      return { ok: false, error: 'Not enough coins' };
    }

    sandboxOwnedIds.add(puzzle.id);
    sandboxPuzzles = sandboxPuzzles.map((p) =>
      p.id === puzzle.id ? { ...p, downloadCount: p.downloadCount + 1 } : p
    );

    return {
      ok: true,
      alreadyOwned: false,
      coinsCharged: puzzle.coinPrice,
      newBalance: currentLocalBalance - puzzle.coinPrice,
    };
  }

  const supabase = getSupabaseClient()!;
  await ensureAuthenticatedUser();

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
  if (!isSupabaseConfigured()) {
    if (sandboxFlaggedByMe.has(puzzleId)) {
      return { ok: false, message: 'You have already reported this puzzle.' };
    }
    sandboxFlaggedByMe.add(puzzleId);
    let quarantined = false;
    sandboxPuzzles = sandboxPuzzles.map((p) => {
      if (p.id !== puzzleId) return p;
      const nextCount = p.flagCount + 1;
      quarantined = shouldAutoQuarantine(nextCount);
      return {
        ...p,
        flagCount: nextCount,
        moderationStatus: quarantined ? 'flagged' : p.moderationStatus,
      };
    });
    return {
      ok: true,
      quarantined,
      message: quarantined
        ? 'Puzzle quarantined and hidden pending review.'
        : 'Report submitted. Thank you for keeping TileCraft safe!',
    };
  }

  const supabase = getSupabaseClient()!;
  const auth = await ensureAuthenticatedUser();
  if (!auth) {
    return { ok: false, message: 'Sign-in required to report puzzles.' };
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
