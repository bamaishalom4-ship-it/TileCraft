-- =============================================================================
-- TileCraft Phase 3: Supabase Database Schema, RLS, Storage & Atomic RPCs
-- Run this SQL in your Supabase Project -> SQL Editor
-- =============================================================================

-- Enable UUID generation
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. PROFILES (User profiles, coin balance, unlocks & daily streak)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 24),
  avatar_url text,
  coins integer not null default 200 check (coins >= 0),
  unlocked_grid_sizes integer[] not null default '{3,4}',
  unlocked_all_frames boolean not null default false,
  last_daily_claim_at timestamptz,
  daily_streak integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public read for creator usernames/avatars; users never mutate coins directly
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own non-economy profile fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 2. PUZZLES (UGC Marketplace Catalog)
-- -----------------------------------------------------------------------------
create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  title text not null check (char_length(title) between 2 and 40),
  category text not null default 'Art'
    check (category in ('Art', 'Nature', 'Pets', 'Retro', 'Travel', 'Abstract', 'Other')),
  storage_path text not null,
  image_url text not null,
  recommended_grid_size integer not null default 4
    check (recommended_grid_size in (3, 4, 5)),
  coin_price integer not null default 25
    check (coin_price >= 0 and coin_price <= 250),
  download_count integer not null default 0 check (download_count >= 0),
  flag_count integer not null default 0 check (flag_count >= 0),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'flagged', 'rejected')),
  moderation_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_puzzles_marketplace_feed
  on public.puzzles (moderation_status, download_count desc, created_at desc);

create index if not exists idx_puzzles_category
  on public.puzzles (category, moderation_status);

alter table public.puzzles enable row level security;

create policy "Approved puzzles are public; authors see their own"
  on public.puzzles for select
  using (moderation_status = 'approved' or author_id = auth.uid());

create policy "Authenticated users can submit puzzles as pending"
  on public.puzzles for insert
  with check (
    auth.uid() = author_id
    and moderation_status = 'pending'
  );

create policy "Authors can delete their own puzzles"
  on public.puzzles for delete
  using (auth.uid() = author_id);

-- -----------------------------------------------------------------------------
-- 3. PUZZLE DOWNLOADS (Ownership Receipts)
-- -----------------------------------------------------------------------------
create table if not exists public.puzzle_downloads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  coins_paid integer not null default 0,
  downloaded_at timestamptz not null default now(),
  primary key (user_id, puzzle_id)
);

alter table public.puzzle_downloads enable row level security;

create policy "Users can view their own puzzle downloads"
  on public.puzzle_downloads for select
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. PUZZLE FLAGS (Community NSFW / Abuse Moderation Queue)
-- -----------------------------------------------------------------------------
create table if not exists public.puzzle_flags (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('nsfw', 'violence', 'hate', 'copyright', 'spam')),
  details text,
  created_at timestamptz not null default now(),
  unique (puzzle_id, reporter_id)
);

alter table public.puzzle_flags enable row level security;

create policy "Authenticated users can submit a flag"
  on public.puzzle_flags for insert
  with check (auth.uid() = reporter_id);

create policy "Users can view their own submitted flags"
  on public.puzzle_flags for select
  using (auth.uid() = reporter_id);

-- Auto-quarantine trigger: hide puzzle from feed once 3 unique users flag it
create or replace function public.handle_puzzle_flag_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  new_flag_count integer;
begin
  update public.puzzles
     set flag_count = flag_count + 1
   where id = new.puzzle_id
  returning flag_count into new_flag_count;

  if new_flag_count >= 3 then
    update public.puzzles
       set moderation_status = 'flagged',
           moderation_reason = coalesce(moderation_reason, 'Auto-quarantined after reaching 3 community flags')
     where id = new.puzzle_id
       and moderation_status = 'approved';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_puzzle_flag_insert on public.puzzle_flags;
create trigger trg_puzzle_flag_insert
  after insert on public.puzzle_flags
  for each row execute function public.handle_puzzle_flag_insert();

-- -----------------------------------------------------------------------------
-- 5. ATOMIC RPC FUNCTIONS (Anti-Cheat Coin Ledger & Profile Bootstrapping)
-- -----------------------------------------------------------------------------

-- Ensure a profile exists for the signed-in (or anonymous) user
create or replace function public.ensure_user_profile(p_username text default null)
returns public.profiles
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_default_name text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if found then
    return v_profile;
  end if;

  v_default_name := coalesce(
    nullif(trim(p_username), ''),
    'Crafter_' || substr(replace(v_uid::text, '-', ''), 1, 6)
  );

  insert into public.profiles (id, username)
  values (v_uid, v_default_name)
  on conflict (id) do nothing;

  select * into v_profile from public.profiles where id = v_uid;
  return v_profile;
end;
$$;

-- Atomic marketplace puzzle purchase + creator royalty (20%, min 5 coins for paid items)
create or replace function public.purchase_marketplace_puzzle(p_puzzle_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_puzzle public.puzzles;
  v_buyer_coins integer;
  v_royalty integer;
  v_already_owned boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_profile();

  select * into v_puzzle
    from public.puzzles
   where id = p_puzzle_id
     and (moderation_status = 'approved' or author_id = v_uid);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Puzzle is unavailable or under moderation review.');
  end if;

  select exists(
    select 1 from public.puzzle_downloads
     where user_id = v_uid and puzzle_id = p_puzzle_id
  ) into v_already_owned;

  -- Free for author or already-owned puzzle
  if v_already_owned or v_puzzle.author_id = v_uid then
    select coins into v_buyer_coins from public.profiles where id = v_uid;
    return jsonb_build_object(
      'ok', true,
      'alreadyOwned', true,
      'coinsCharged', 0,
      'newBalance', v_buyer_coins
    );
  end if;

  -- Lock buyer profile row for atomic deduction
  select coins into v_buyer_coins
    from public.profiles
   where id = v_uid
   for update;

  if v_buyer_coins < v_puzzle.coin_price then
    return jsonb_build_object(
      'ok', false,
      'error', 'Not enough coins',
      'required', v_puzzle.coin_price,
      'balance', v_buyer_coins
    );
  end if;

  -- Deduct coins from buyer
  update public.profiles
     set coins = coins - v_puzzle.coin_price,
         updated_at = now()
   where id = v_uid
  returning coins into v_buyer_coins;

  -- Credit creator royalty (20%, min 5 coins when price > 0)
  if v_puzzle.coin_price > 0 then
    v_royalty := greatest(5, ceil(v_puzzle.coin_price * 0.20)::integer);
    update public.profiles
       set coins = coins + v_royalty,
           updated_at = now()
     where id = v_puzzle.author_id;
  end if;

  -- Record ownership receipt & increment download counter
  insert into public.puzzle_downloads (user_id, puzzle_id, coins_paid)
  values (v_uid, p_puzzle_id, v_puzzle.coin_price);

  update public.puzzles
     set download_count = download_count + 1
   where id = p_puzzle_id;

  return jsonb_build_object(
    'ok', true,
    'alreadyOwned', false,
    'coinsCharged', v_puzzle.coin_price,
    'newBalance', v_buyer_coins
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKET (`puzzle-images`) & POLICIES
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'puzzle-images',
  'puzzle-images',
  true,
  5242880, -- 5 MB max
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Public read access for puzzle images"
  on storage.objects for select
  using (bucket_id = 'puzzle-images');

create policy "Authenticated users upload into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'puzzle-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own uploaded images"
  on storage.objects for delete
  using (
    bucket_id = 'puzzle-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
