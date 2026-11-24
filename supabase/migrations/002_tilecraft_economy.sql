-- =============================================================================
-- TileCraft Phase 4: Economy Ledger, Daily Login Streaks, Rewarded Ads & IAP
-- Run this SQL in your Supabase Project -> SQL Editor AFTER 001_tilecraft_schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. COIN TRANSACTIONS LEDGER (Immutable Audit Log)
-- -----------------------------------------------------------------------------
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  tx_type text not null check (
    tx_type in (
      'daily_reward',
      'rewarded_ad',
      'puzzle_win',
      'hint',
      'upgrade_unlock',
      'iap_pack',
      'marketplace_buy',
      'creator_royalty'
    )
  ),
  reference_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_tx_user_created
  on public.coin_transactions (user_id, created_at desc);

-- Prevent duplicate credits for the same ad session, puzzle run, or IAP receipt
create unique index if not exists uq_coin_tx_idempotency
  on public.coin_transactions (user_id, tx_type, reference_id)
  where reference_id is not null;

alter table public.coin_transactions enable row level security;

create policy "Users can view their own coin transaction history"
  on public.coin_transactions for select
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. ATOMIC SPEND COINS RPC (Hints, etc.)
-- -----------------------------------------------------------------------------
create or replace function public.spend_coins(
  p_amount integer,
  p_tx_type text,
  p_reference_id text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Amount must be positive');
  end if;

  perform public.ensure_user_profile();

  select coins into v_balance
    from public.profiles
   where id = v_uid
   for update;

  if v_balance < p_amount then
    return jsonb_build_object('ok', false, 'error', 'Not enough coins', 'balance', v_balance);
  end if;

  update public.profiles
     set coins = coins - p_amount,
         updated_at = now()
   where id = v_uid
  returning coins into v_balance;

  insert into public.coin_transactions (user_id, delta, balance_after, tx_type, reference_id)
  values (v_uid, -p_amount, v_balance, p_tx_type, p_reference_id);

  return jsonb_build_object('ok', true, 'newBalance', v_balance);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. DAILY LOGIN STREAK REWARD RPC (7-Day Escalating Cycle)
--    Day 1: 40 | Day 2: 50 | Day 3: 65 | Day 4: 80 | Day 5: 100 | Day 6: 125 | Day 7: 200
-- -----------------------------------------------------------------------------
create or replace function public.claim_daily_login_reward()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_last_date date;
  v_next_streak integer;
  v_reward integer;
  v_new_balance integer;
  v_rewards integer[] := array[40, 50, 65, 80, 100, 125, 200];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_profile();

  select * into v_profile
    from public.profiles
   where id = v_uid
   for update;

  if v_profile.last_daily_claim_at is not null then
    v_last_date := (v_profile.last_daily_claim_at at time zone 'utc')::date;
    if v_last_date = v_today then
      return jsonb_build_object(
        'ok', false,
        'error', 'Daily reward already claimed today',
        'streak', v_profile.daily_streak,
        'newBalance', v_profile.coins
      );
    end if;

    if v_last_date = v_today - 1 then
      v_next_streak := (v_profile.daily_streak % 7) + 1;
    else
      v_next_streak := 1;
    end if;
  else
    v_next_streak := 1;
  end if;

  v_reward := v_rewards[v_next_streak];

  update public.profiles
     set coins = coins + v_reward,
         daily_streak = v_next_streak,
         last_daily_claim_at = now(),
         updated_at = now()
   where id = v_uid
  returning coins into v_new_balance;

  insert into public.coin_transactions (user_id, delta, balance_after, tx_type, reference_id)
  values (v_uid, v_reward, v_new_balance, 'daily_reward', v_today::text);

  return jsonb_build_object(
    'ok', true,
    'coinsAwarded', v_reward,
    'streak', v_next_streak,
    'newBalance', v_new_balance
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. REWARDED AD GRANT RPC (Rate-Limited: Max 10 Ads / UTC Day)
-- -----------------------------------------------------------------------------
create or replace function public.grant_rewarded_ad_coins(p_ad_session_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_today_count integer;
  v_reward integer := 35;
  v_new_balance integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_profile();

  -- Idempotency check
  if exists (
    select 1 from public.coin_transactions
     where user_id = v_uid
       and tx_type = 'rewarded_ad'
       and reference_id = p_ad_session_id
  ) then
    select coins into v_new_balance from public.profiles where id = v_uid;
    return jsonb_build_object('ok', true, 'coinsAwarded', 0, 'newBalance', v_new_balance);
  end if;

  select count(*) into v_today_count
    from public.coin_transactions
   where user_id = v_uid
     and tx_type = 'rewarded_ad'
     and created_at >= date_trunc('day', now() at time zone 'utc');

  if v_today_count >= 10 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Daily rewarded ad limit reached (10/day). Come back tomorrow!'
    );
  end if;

  update public.profiles
     set coins = coins + v_reward,
         updated_at = now()
   where id = v_uid
  returning coins into v_new_balance;

  insert into public.coin_transactions (user_id, delta, balance_after, tx_type, reference_id)
  values (v_uid, v_reward, v_new_balance, 'rewarded_ad', p_ad_session_id);

  return jsonb_build_object(
    'ok', true,
    'coinsAwarded', v_reward,
    'remainingToday', 9 - v_today_count,
    'newBalance', v_new_balance
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. PUZZLE WIN REWARD RPC
-- -----------------------------------------------------------------------------
create or replace function public.grant_puzzle_win_reward(
  p_grid_size integer,
  p_stars integer,
  p_run_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_base integer;
  v_bonus integer;
  v_total integer;
  v_new_balance integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_profile();

  v_base := case p_grid_size when 3 then 15 when 4 then 30 when 5 then 60 else 15 end;
  v_bonus := case when p_stars >= 3 then 20 when p_stars = 2 then 10 else 0 end;
  v_total := v_base + v_bonus;

  if exists (
    select 1 from public.coin_transactions
     where user_id = v_uid and tx_type = 'puzzle_win' and reference_id = p_run_id
  ) then
    select coins into v_new_balance from public.profiles where id = v_uid;
    return jsonb_build_object('ok', true, 'coinsAwarded', 0, 'newBalance', v_new_balance);
  end if;

  update public.profiles
     set coins = coins + v_total,
         updated_at = now()
   where id = v_uid
  returning coins into v_new_balance;

  insert into public.coin_transactions (user_id, delta, balance_after, tx_type, reference_id)
  values (v_uid, v_total, v_new_balance, 'puzzle_win', p_run_id);

  return jsonb_build_object('ok', true, 'coinsAwarded', v_total, 'newBalance', v_new_balance);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. SHOP UPGRADE UNLOCK RPC (5x5 Grid / Retro Frame Pack)
-- -----------------------------------------------------------------------------
create or replace function public.unlock_shop_upgrade(p_upgrade_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_cost integer;
  v_new_balance integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_profile();

  select * into v_profile from public.profiles where id = v_uid for update;

  if p_upgrade_id = 'unlock_5x5' then
    v_cost := 150;
    if 5 = any(v_profile.unlocked_grid_sizes) then
      return jsonb_build_object('ok', true, 'alreadyOwned', true, 'newBalance', v_profile.coins);
    end if;
  elsif p_upgrade_id = 'frame_pack' then
    v_cost := 100;
    if v_profile.unlocked_all_frames then
      return jsonb_build_object('ok', true, 'alreadyOwned', true, 'newBalance', v_profile.coins);
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'Unknown upgrade');
  end if;

  if v_profile.coins < v_cost then
    return jsonb_build_object('ok', false, 'error', 'Not enough coins', 'balance', v_profile.coins);
  end if;

  if p_upgrade_id = 'unlock_5x5' then
    update public.profiles
       set coins = coins - v_cost,
           unlocked_grid_sizes = array_append(unlocked_grid_sizes, 5),
           updated_at = now()
     where id = v_uid
    returning coins into v_new_balance;
  else
    update public.profiles
       set coins = coins - v_cost,
           unlocked_all_frames = true,
           updated_at = now()
     where id = v_uid
    returning coins into v_new_balance;
  end if;

  insert into public.coin_transactions (user_id, delta, balance_after, tx_type, reference_id)
  values (v_uid, -v_cost, v_new_balance, 'upgrade_unlock', p_upgrade_id);

  return jsonb_build_object('ok', true, 'alreadyOwned', false, 'newBalance', v_new_balance);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. IAP COIN PACK CREDIT RPC (Idempotent by Transaction / Receipt ID)
--    In production, pair with RevenueCat Webhook -> Edge Function using service_role
-- -----------------------------------------------------------------------------
create or replace function public.credit_iap_coin_pack(
  p_sku text,
  p_transaction_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_coins integer;
  v_new_balance integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_profile();

  v_coins := case p_sku
    when 'com.tilecraft.coins.250' then 250
    when 'com.tilecraft.coins.800' then 950   -- 800 + 150 bonus
    when 'com.tilecraft.coins.2500' then 3100 -- 2500 + 600 bonus
    else 0
  end;

  if v_coins = 0 then
    return jsonb_build_object('ok', false, 'error', 'Invalid product SKU');
  end if;

  if exists (
    select 1 from public.coin_transactions
     where user_id = v_uid and tx_type = 'iap_pack' and reference_id = p_transaction_id
  ) then
    select coins into v_new_balance from public.profiles where id = v_uid;
    return jsonb_build_object('ok', true, 'duplicate', true, 'newBalance', v_new_balance);
  end if;

  update public.profiles
     set coins = coins + v_coins,
         updated_at = now()
   where id = v_uid
  returning coins into v_new_balance;

  insert into public.coin_transactions (user_id, delta, balance_after, tx_type, reference_id)
  values (v_uid, v_coins, v_new_balance, 'iap_pack', p_transaction_id);

  return jsonb_build_object('ok', true, 'coinsAwarded', v_coins, 'newBalance', v_new_balance);
end;
$$;
