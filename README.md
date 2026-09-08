# Clean — Offline-First Laundry Shop Management

Clean is an offline-first mobile laundry management system for shop owners. The entire business — customers, services, orders, payments, reports, and sync — works without internet, then synchronizes when the server is available.

**Version:** 0.1.0 • **Expo SDK 54** • **React Native 0.81** • **TypeScript** • **SQLite**

## Project Areas

- `mobile/` — React Native + Expo + TypeScript (expo-sqlite WAL, SecureStore, expo-router, offline-first)
- `server/` — TypeScript Express REST API (Knex + SQLite, JWT auth, shop-scoped)
- `storage/` — `clean.sqlite` (server DB, never reset)
- `docs/` — `DEV_CHECKPOINT.md` (phases 1–10)

## Technology

- **Mobile:** Expo SDK 54 (`expo ~54.0.37`, `react 19.1.0`), `expo-sqlite 16.0.10`, `expo-secure-store`, `expo-router`, `expo-asset`, `react-native-safe-area-context`
- **Server:** Express 5.1, Node ≥20, Knex 3.1, sqlite3 5.1.7, JWT, bcryptjs, Zod

## Quick Start — Development

### Backend

```bash
cd C:/about-school/Clean/server
npm install
# .env already has PORT/HOST/DATABASE_PATH/JWT_SECRET (see .env.example)
npm run dev
# → http://0.0.0.0:3000  (LAN: http://192.168.1.15:3000/api/v1)
# Health: GET /api/v1/health
```

### Mobile (Expo Go)

```bash
cd C:/about-school/Clean/mobile
npm install
# Create mobile/.env from .env.example
# EXPO_PUBLIC_API_BASE_URL=http://PC_LOCAL_IP:3000/api/v1
# Example: http://192.168.1.15:3000/api/v1
npx expo start --lan --clear
# → Metro exp://192.168.1.15:8081
# Scan QR with Expo Go (iOS) or `npx expo start --android`
```

**Do not use `localhost`/`127.0.0.1` for Expo Go on physical phone** — use PC Wi-Fi IP. If IP changes, update only `mobile/.env`.

## Physical iPhone Testing (iPhone 13 / Expo Go)

- Backend: `http://192.168.1.15:3000/api/v1` (check `ipconfig`, update `.env` only)
- Metro: `exp://192.168.1.15:8081`
- Expo SDK 54 required (Expo Go App Store)

## Features (Phases 1–10)

- **Auth:** Register/Login, shop per owner, JWT 7d, offline cached session (SecureStore), shop-scoped.
- **Customers/Services:** Offline CRUD, `address/notes`, `description`, `per_kg/per_piece/fixed/per_load` with `₱160/8kg` package (configurable `weight_block_kg 1–50`).
- **Receive Laundry:** Snapshot pricing (preserves `₱70/kg`, `₱80/kg`, `₱160/8kg` etc.), weight `grams` + loads `ceil(weight/block)`, fees, `RECEIVED` `PENDING`.
- **Orders:** Filters `ALL/RECEIVED/PROCESSING/READY/COMPLETED`, search `order_number/customer/contact`, Ready aging (`Ready today` + `≥2 days` highlight).
- **Tracking:** `RECEIVED→PROCESSING→READY→COMPLETED` (valid forward only, `balance 0` for `COMPLETED`), `processing_at/ready_at/completed_at`, `status_history`.
- **Payments:** `Cash/GCash/Other` with `reference/notes`, `UNPAID→PARTIAL→PAID` via `SUM`, outstanding, daily collections (payments-based).
- **Reports:** `Today/7d/Month/All/Custom` (`DATE(...,'localtime')`), `Collections` vs `Order Value` vs `Outstanding`, avg, status distributions, top services/customers, payment methods, daily trends (simple bars, no chart lib).
- **Sync:** Offline ↔ Server `POST /sync/push` + `GET /sync/pull?since`, shop-scoped, idempotent UUIDs, dependency order `customers→services→orders→payments→history`, `PENDING→SYNCING→SYNCED/FAILED` with `2s/5s/15s` retry, `sync_state` cursor, `Sync Now` in Settings (foreground/login triggers, offline banner).

## Current Limitations (Intentional)

- No full background sync (iOS restricted; sync on foreground/login/Sync Now)
- No profit/expenses, refunds, push/SMS, receipt printing, QR
- No PDF/Excel export yet
- Still `PENDING` until future sync (reports use local data)
- No EAS production build submitted yet (config prepared, see `app.json`)

## Branding

- Name: **Clean** (all user-facing). Historical `LabaHub` only in preserved internal data where renaming would break.
- Icon/Splash: `mobile/assets/icon.png` (1024×1024), `splash.png` (1284×2778) — placeholders in `assets/README.md`, replace before production.

## Environment

- `mobile/.env` → `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:3000/api/v1` (centralized `src/config/api.ts`)
- `server/.env` → `PORT/HOST/DATABASE_PATH/JWT_SECRET/JWT_EXPIRES_IN` (see `.env.example`). `JWT_SECRET` fallback only in development; production throws if `<16`.
- Do not hardcode IP elsewhere.

## Sync Behavior

- Offline: all business works via `mobile clean.db` (WAL), `PENDING` queue, `Reports` local, `Pending Changes N` in Settings.
- Online: `Settings → Sync Now` or foreground/login auto-sync → `push` (idempotent, per-record `synced/failed`) → `pull` (incremental `since` cursor) → `All data synced`.

## Security

- `bcryptjs` hashing, JWT verification, shop scoping everywhere (`req.auth.shopId` derived, never trust client `shop_id`), payment/order/reports/sync all shop-scoped, `SecureStore` for token, no plaintext passwords, no hardcoded production secrets.

## Commands

```bash
# Server
cd server && npm run dev          # watch tsx
cd server && npm run build        # tsc
cd server && npm run db:migrate

# Mobile
cd mobile && npm run typecheck    # tsc --noEmit
cd mobile && npx expo-doctor      # 18 checks
cd mobile && npx expo export      # ~2.9 MB
```

## Database

- `server/storage/clean.sqlite` **200 KB**, `PRAGMA integrity_check: ok`, 7 migrations, never reset. `mobile clean.db` `user_version 5`.
- Historical pricing snapshots preserved: `₱70/kg`, `₱80/kg`, `₱160/8kg` via `weight_block_grams_snapshot` etc.
