# RELEASE_CHECKLIST — Clean 0.1.0

> All blockers must be resolved before production submission. Do NOT auto-check manual items.

## App Assets

- [ ] **FINAL ICON REQUIRED** — Replace `mobile/assets/icon.png` placeholder (68 bytes 1×1) with final 1024×1024 PNG (Clean laundry icon, readable at small size, padding, #172554). See `mobile/assets/README.md`.
- [ ] **FINAL ADAPTIVE ICON REQUIRED** — Replace `mobile/assets/adaptive-icon.png` placeholder with final 1024×1024 Android adaptive (foreground + `app.json` `backgroundColor #f4f6fb`).
- [ ] **FINAL SPLASH REQUIRED** — Replace `mobile/assets/splash.png` placeholder with final 1284×2778 (`Clean` + `Laundry Management` on #f4f6fb, simple).
- [ ] `favicon.png` 48×48 optional (web) — currently placeholder, replace if web target.
- [ ] Verify `npx expo-doctor` 18/18 after asset replacement (currently passes with placeholders, but final assets must be 1024×1024 not 1×1).

## Build Configuration

- [ ] `app.json` verified: `name Clean`, `slug clean`, `version 0.1.0`, `orientation portrait`, `icon`/`splash`/`adaptiveIcon`, `ios.bundleIdentifier com.clean.laundry`, `android.package com.clean.laundry`, `plugins` (expo-router, sqlite, secure-store, etc.), `expo SDK 54` not upgraded.
- [ ] `eas.json` exists with `development`/`preview`/`production` profiles (`cli >=5.9.3`, `appVersionSource local`). Verify `production` `env.EXPO_PUBLIC_API_BASE_URL` placeholder `https://api.example.com/api/v1` is replaced with real HTTPS before build.
- [ ] `mobile/package.json` `version 0.1.0` matches `app.json`.

## Environment & Secrets

- [ ] **PRODUCTION API REQUIRED** — Backend reachable over internet via **HTTPS** (not `192.168.1.15` LAN). Document real URL in `eas.json` `production.env` and `mobile/.env.production`. Do not put LAN IP in production builds.
- [ ] `server/.env` production has strong `JWT_SECRET` ≥32 random chars (from `.env.example` `change-me...`). `NODE_ENV=production` must throw if missing/`<16` (verified in `src/config/env.ts`).
- [ ] `mobile/.env` LAN `192.168.1.15` kept for dev, `mobile/.env.example` documents `PC_LOCAL_IP:3000`.
- [ ] No secrets in `EXPO_PUBLIC` (only `EXPO_PUBLIC_API_BASE_URL`), no `JWT_SECRET`/`DB` in client, no `console.log` of tokens (verified via grep).
- [ ] `server/storage/clean.sqlite` **NOT** uploaded as production DB (dev test data). Production DB starts clean; document how production `DATABASE_PATH` differs (e.g., `./storage/prod.sqlite` or managed DB).

## Permissions

- [ ] Audit: only `expo-router`, `expo-sqlite`, `expo-asset`, `expo-secure-store`, `expo-font` (no camera/contacts/microphone). Verify `app.json` has no extra `android.permissions`/`ios.infoPlist` permissions.

## Privacy & Store Metadata

- [ ] **PRIVACY CONTACT DETAILS REQUIRED** — Fill `[OWNER INFORMATION REQUIRED]` in `PRIVACY_POLICY_DRAFT.md` (legal name, address, email, phone, effective date) and host at stable URL (e.g., `https://example.com/privacy`).
- [ ] **OWNER URL REQUIRED** — Fill `Support URL` / `Privacy Policy URL` in `STORE_METADATA.md` (App Store) and `Contact Details` (Play).
- [ ] Privacy policy hosted and URL set in `app.json`? Actually `app.json` doesn't need URL, but store forms need it.
- [ ] Store metadata ready: `STORE_METADATA.md` drafts `App Name/Subtitles/Descriptions/Keywords/Category` (not exaggerated, no QR/claim).
- [ ] **SCREENSHOTS** — Capture 10 demo-data screenshots from iPhone 13 (no real PII, no passwords/JWTs) as per `STORE_METADATA.md` `Screenshot Plan` (Login, Home, Receive, Orders, Order Details, Customers, Services, Payments, Reports, Sync/Settings). Do not auto-publish.
- [ ] TestFlight tester account strategy documented (no hardcoded credentials, see `PRIVACY_POLICY_DRAFT.md` `Test Account`).

## Manual iPhone Tests (Do NOT auto-pass)

- [ ] **APP STARTUP** — launch `Clean` via `exp://192.168.1.15:8081` (or TestFlight after build), verify `Restoring session...` → `Home`, no flash `Login`, no indefinite loading.
- [ ] **CUSTOMERS** — create, edit, search (name/phone), long name wraps.
- [ ] **SERVICES** — create/edit `Wash & Dry ₱160/8kg`, `Comforter per-piece`, `Pickup Fee fixed`, `Active/Inactive` badge.
- [ ] **RECEIVE LAUNDRY** — customer→service→weight `5.5kg 1 Load ₱160` → `12kg 2 Loads ₱320` (no floating error), fees, `RECEIVED` `PENDING`.
- [ ] **ORDERS** — filters `All|Received|Processing|Ready|Completed`, search `091700`, `READY` `Ready today` orange highlight.
- [ ] **ORDER DETAILS** — sections `Order Info`, `Customer`, `Service` `Pricing` `Payment` `Status History`, `StatusBadge`, `Sync` hint.
- [ ] **PAYMENTS** — `Cash` `₱100`, `GCash` `₱130` + `Ref`, history append-only, `Outstanding` `Balance`, overpay rejected.
- [ ] **REPORTS** — `Today/7d/Month/All` `Collections` vs `Order Value` vs `Outstanding` (never confused), `Daily Trend` bars, offline reports still local via `DATE(*,'localtime')`.
- [ ] **SYNC** — offline create `Pending` → `Sync Now` → `Synced`, retry no duplicate, pull server `ServerPullCust` → locally, interrupted sync resume, restart persistence (close Expo Go, reopen, data still).
- [ ] **UX** — keyboard `email/phone/decimal-pad` not behind `Save`, `SafeArea` notch/home indicator, `Loading` `Empty` `Error` not blank, `Toast` `Customer saved` etc., `ErrorBoundary` catch.
- [ ] **RESTART PERSISTENCE** — after `Sync Now` `SYNCED`, kill app, reopen, verify `Customers/Services/Orders/Payments/Reports` identical, `Pending 0`.
- [ ] **LOGOUT SAFETY** — logout clears `SecureStore` but preserves `customers/services/orders/payments` (verify after login `Pending` still if offline before logout).

## Final Verification (Automated)

- [ ] `mobile npm run typecheck` → `0`
- [ ] `server npm run build` → `0`
- [ ] `npx expo-doctor` → `18/18`
- [ ] `npx expo export` → `0` `ios 2.92 MB` `android 2.92 MB`
- [ ] `expo config --type public` (or `npx expo-doctor --verbose`) validates `app.json`
- [ ] `GET /api/v1/health` → `200 connected`
- [ ] `PRAGMA integrity_check` → `ok`, `storage/clean.sqlite` **~200 KB** not recreated, 7 migrations
- [ ] Auth regression: `register` `login` `session restore` `logout` (via `phase10-regression.mjs`)
- [ ] Customer regression: create/edit/search
- [ ] Service regression: `PER_LOAD`/`PER_PIECE`/`FIXED`
- [ ] Receive regression: `₱160/8kg` `5.5kg→1 Load` `12kg→2 Loads`
- [ ] Order regression: `RECEIVED→PROCESSING→READY→COMPLETED` `ready_at` `status history` `paid-before-completed`
- [ ] Payment regression: `Cash/GCash/Other` `history` `overpay` `outstanding`
- [ ] Reports regression: `collections/order value/outstanding` `trends`
- [ ] Sync regression: `push` `pull` `idempotency` `duplicate prevention` `pending persistence`
- [ ] Shop-scoping: `mariaToken` 404 on `testShopId` order/payment/reports/sync
- [ ] Historical snapshots: `₱70/kg 7000`, `₱80/kg`, `₱160/8kg 16000 8000` preserved

## Build & Submission (DO NOT AUTO-EXECUTE)

- [ ] Install EAS CLI: `npm install -g eas-cli` (requires Expo account)
- [ ] Login: `eas login` (requires [OWNER APPLE/GOOGLE ACCOUNT])
- [ ] Configure credentials: `eas credentials` (requires Apple Developer / Play Console decisions)
- [ ] Preview build (internal, no store): `eas build --platform ios --profile preview` / `eas build --platform android --profile preview` (uses `eas.json` `preview` with LAN or preview API)
- [ ] Production build (store): `eas build --platform ios --profile production` (requires real `https://api.example.com` in `eas.json` + final icons) / `eas build --platform android --profile production`
- [ ] **DO NOT** `eas submit` without explicit owner instruction (Phase 11 is preparation only).

## Remaining Blockers (if any of the above unchecked, not production-ready)

List currently:
- FINAL ICON REQUIRED (placeholder 68 bytes)
- FINAL SPLASH REQUIRED (placeholder)
- FINAL ADAPTIVE ICON REQUIRED (placeholder)
- PRODUCTION API REQUIRED (LAN `192.168.1.15` not HTTPS)
- HTTPS REQUIRED (production API must be TLS)
- APPLE DEVELOPER ACCOUNT REQUIRED (for TestFlight)
- GOOGLE PLAY ACCOUNT REQUIRED (for internal testing)
- PRIVACY CONTACT DETAILS REQUIRED (legal name/address/email)
- MANUAL IPHONE TEST REQUIRED (see above)
- SCREENSHOTS REQUIRED (demo data, no PII)

Do not call Clean production-ready while any real blocker remains.

## Test Data Cleanup Strategy

Do NOT delete `storage/clean.sqlite` dev data (`customers 6`, `services 4`, `orders 51`, etc.). For production, start clean:

- Development DB: `server/storage/clean.sqlite` (current, never reset, for testing)
- Production DB: separate file or managed DB (e.g., `server/storage/prod.sqlite` or `DATABASE_PATH=/data/prod.sqlite` on server), `npm run db:migrate` creates fresh schema, no dev test records copied. Document in `server/.env.example` `DATABASE_PATH` distinction.

## Documentation

- [ ] `README.md` Release Preparation section added (Node version, install, env, Expo/EAS, manual iPhone, store metadata location, privacy location, limitations)
- [ ] `STORE_METADATA.md` drafted
- [ ] `PRIVACY_POLICY_DRAFT.md` drafted with `[OWNER INFORMATION REQUIRED]` markers
- [ ] `DEV_CHECKPOINT.md` Phase 11 complete

## Recommended Phase 12

- **Phase 12 — Store Submission & Post-Launch Ops** — Final `eas build` production with real assets + HTTPS API, TestFlight internal/beta, Play internal testing, store submission (requires explicit owner `eas submit`), crash reporting (e.g., Sentry Expo), analytics (no tracking), update workflow `eas update` for OTA, support flow, no new business logic.
