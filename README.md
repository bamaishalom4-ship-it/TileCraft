# TileCraft

Cross-platform tactile sliding tile puzzle game (3×3, 4×4, 5×5) built with **React Native (Expo) + TypeScript + Zustand** and **Supabase** for its User-Generated Content (UGC) puzzle marketplace and coin economy.

## Features (Phased Roadmap)
- **Phase 1 — Core Engine & Tactile Grid:** Guaranteed-solvable puzzle generator using inversion & blank-row parity checks, single & multi-tile line pushes, A* / Weighted A* hint solver, live move counter & timer, retro molded plastic frame themes.
- **Phase 2 — UI Screens & Custom Image Cropper:** Main Menu, Game Screen, Win Screen, Shop, and Gallery Image Picker with 1:1 square pan/zoom cropper.
- **Phase 3 — Backend & UGC Marketplace:** Supabase Auth, Postgres + Storage schema, puzzle uploads, NSFW moderation workflow, community flagging, and browse/download marketplace.
- **Phase 4 — Economy, Ads & IAP:** Local + synced Coin ledger, daily login rewards, AdMob rewarded video ads, coin packs (IAP), and coin-gated hints/grid unlocks.

## Running Locally

```powershell
npm.cmd install
npm.cmd run test:engine
npx.cmd expo start
```
