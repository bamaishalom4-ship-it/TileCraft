# TileCraft

Cross-platform tactile sliding tile puzzle game (`3×3`, `4×4`, `5×5`) with a moderated User-Generated Content (UGC) marketplace, synced Coin economy, AdMob rewarded ads, and In-App Purchases. Built with **React Native (Expo) + TypeScript + Zustand + SQLite** and **Supabase**.

## Completed Phases

- **Phase 1 — Core Engine & Tactile Grid:** Guaranteed-solvable board generator using inversion & blank-row parity checks, single & multi-tile line pushes, Manhattan + Linear Conflict A* hint solver, move counter, timer, and retro molded plastic frame themes.
- **Phase 2 — UI Screens & 1:1 Image Cropper:** Main Menu, Game Screen (with target image peek & number overlay toggle), Win Screen (1–3 stars + coin rewards), Shop, and Gallery Image Picker with pan/zoom/rotate 1:1 square cropper & live tile cut lines.
- **Phase 3 — Supabase Backend & UGC Marketplace:** Postgres schema (`profiles`, `puzzles`, `puzzle_downloads`, `puzzle_flags`), Storage bucket (`puzzle-images`), atomic coin purchase + 20% creator royalty RPC, automated NSFW moderation Edge Function (`moderate-puzzle`), and 3-flag community auto-quarantine trigger.
- **Phase 4 — Economy, Ads & IAP:** Local SQLite wallet (`expo-sqlite` + AsyncStorage fallback) synced with Supabase `coin_transactions` ledger, 7-day escalating daily login streaks, Google AdMob rewarded video ads (with Expo Go preview fallback), and RevenueCat IAP coin packs + Restore Purchases.

## Supabase Setup

1. Open your Supabase project's **SQL Editor** and run in order:
   - `supabase/migrations/001_tilecraft_schema.sql`
   - `supabase/migrations/002_tilecraft_economy.sql`
2. Enable **Anonymous Sign-Ins** under **Authentication → Providers**.
3. Copy `.env.example` to `.env` and populate `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. *(Optional)* Deploy `supabase/functions/moderate-puzzle/index.ts` and configure `OPENAI_API_KEY` or `SIGHTENGINE_USER`/`SIGHTENGINE_SECRET` (or `MODERATION_DEV_AUTO_APPROVE=true` during development).

## Running Locally & Deploying as a PWA

```powershell
npm.cmd install
npm.cmd run test:engine
npx.cmd expo start
```

### Building & Hosting the Installable PWA (Vercel / Netlify)

```powershell
npm.cmd run build:pwa
```

This outputs a complete, offline-capable PWA inside `dist/` (including `manifest.json`, `sw.js`, maskable/Apple PNG icons, and injected PWA `<head>` tags). Both `vercel.json` and `netlify.toml` are preconfigured — connect your GitHub repo to **Vercel** or **Netlify** and it will auto-build and deploy as an installable PWA on HTTPS!

> Note: AdMob (`react-native-google-mobile-ads`) and RevenueCat (`react-native-purchases`) run in safe preview/sandbox mode inside Web/PWA and Expo Go, and switch automatically to native SDKs when built with `eas build` / `npx expo run:android` / `npx expo run:ios`.
