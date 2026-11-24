-- =============================================================================
-- TileCraft Phase 3/4 Follow-up: Role Grants for Public Catalog & RPCs
-- Run in Supabase SQL Editor ONLY when you are ready to enable live Marketplace.
-- Also enable "Anonymous Sign-Ins" under Authentication -> Providers to allow
-- one-tap player profiles and public puzzle publishing.
-- =============================================================================

grant usage on schema public to anon, authenticated;

grant select on public.puzzles to anon, authenticated;
grant insert, delete on public.puzzles to authenticated;

grant select on public.profiles to anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

grant select on public.puzzle_downloads to authenticated;
grant select, insert on public.puzzle_flags to authenticated;
grant select on public.coin_transactions to authenticated;

grant execute on function public.ensure_user_profile(text) to authenticated;
grant execute on function public.purchase_marketplace_puzzle(uuid) to authenticated;
grant execute on function public.spend_coins(integer, text, text) to authenticated;
grant execute on function public.claim_daily_login_reward() to authenticated;
grant execute on function public.grant_rewarded_ad_coins(text) to authenticated;
grant execute on function public.grant_puzzle_win_reward(integer, integer, text) to authenticated;
grant execute on function public.unlock_shop_upgrade(text) to authenticated;
grant execute on function public.credit_iap_coin_pack(text, text) to authenticated;
