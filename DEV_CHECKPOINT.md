# DEV_CHECKPOINT — Clean Phase 12

**Date:** 2026-08-29
**Phase:** 12 — Production Deployment, Build Readiness & Final Release Preparation (NOT PUBLISHED)
**Status:** ✅ Complete (verified, no DB reset, all preparation TODOs done, blockers documented, NOT PUBLISHED, awaiting user adjustments)

## Completed Phases
- Phase 1: Project Foundation — preserved
- Phase 2: Offline Local Database Foundation — preserved
- Phase 3: Owner/Shop & Auth — preserved
- Phase 4: Customers & Services — preserved
- Phase 5: Receive Laundry & Pricing (PER_LOAD ₱160/8kg, snapshots) — preserved
- Phase 6: Order Tracking & Status Workflow — preserved
- Phase 7: Payments & Financial Management — preserved
- Phase 8: Reports & Analytics — preserved
- Phase 9: Full Offline ↔ Server Synchronization — preserved
- Phase 10: UX Polish & Release Preparation (theme, Toast, branding) — preserved
- Phase 11: Production Build & Store Metadata — preserved
- Phase 12: Production Deployment, Build Readiness & Final Release Preparation — **this checkpoint — NOT PUBLISHED**

## Project State — Final Pre-Production
- **Mobile:** Clean 0.1.0, **Expo SDK 54** (`expo ~54.0.37`, `react 19.1.0`, `react-native 0.81.5`), TypeScript strict, Expo Go compatible, `expo-sqlite 16.0.10`, `expo-secure-store 15.0.8`, `user_version 5`, `ToastProvider`+`ErrorBoundary`+`SyncWrapper` in `_layout`, `theme.ts` tokens, `StatusBadge`/`OfflineBanner`/`Feedback` components
- **Backend:** Express 5.1, Node ≥20, SQLite, Knex, JWT, `storage/clean.sqlite` **204 KB** (not recreated, 7 migrations Batch 7: `..._payments_method:7`), `labahub.sqlite` retained, `HOST=0.0.0.0:3000`, `JWT_SECRET` env with prod throw (`requireJwtSecret` checks `NODE_ENV===production` + `<16` → throw)
- **Local DB:** `mobile clean.db` `user_version 5` `sync_state` + `sync_logs`; all tables `sync_status`, snapshots preserved (`weight_block_grams_snapshot` etc.)
- **Server DB:** `clean.sqlite` 7 migrations — shops 3 / users 3 / customers 8 / services 7 / orders 55 / payments 41 / history ~70 (after Phase 12 regression, not reset, `outstanding 694500` before Phase 12 tests → now similar)
- **LAN (Dev):** `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:3000/api/v1` centralized `mobile/src/config/api.ts`, `mobile/.env` + `.env.example` LAN IP only, `HOST=0.0.0.0:3000`, Metro `exp://192.168.1.15:8081` — IP verified 192.168.1.15 (via `ipconfig`)
- **Expo Config:** `app.json` `name Clean` `slug clean` `version 0.1.0` `orientation portrait` `userInterfaceStyle light` `newArchEnabled true` `scheme clean` `description` `primaryColor #172554` `icon ./assets/icon.png` `splash ./assets/splash.png` `adaptiveIcon ./assets/adaptive-icon.png` `favicon ./assets/favicon.png` `ios bundleIdentifier com.clean.laundry` `android package com.clean.laundry` `plugins expo-router, sqlite, asset, secure-store, font` `experiments typedRoutes` — SDK 54 locked, no upgrade
- **EAS:** `mobile/eas.json` `cli >=5.9.3` `appVersionSource local` profiles `development` (`developmentClient true`, `distribution internal`), `preview` (`distribution internal`, `simulator false`, `buildType apk`, `env LAN`), `production` (`distribution store`, `autoIncrement true`, `env https://api.example.com/api/v1` **placeholder**), `submit.production {}` — **NOT executed** (requires `eas login` + Apple/Google credentials)
- **Assets:** `mobile/assets/` `icon.png` `adaptive-icon.png` `splash.png` `favicon.png` placeholder 1×1 transparent 68 bytes `assets/README.md` documents required final `1024×1024` icon / `1284×2778` splash `Clean Laundry Management` #f4f6fb — **FINAL ASSET REQUIRED** before production `eas build`
- **Expo Export:** ✅ 2.92 MB ios `107294...hbc` / 2.92 MB android `452660...hbc` (`babel-preset-expo 54.0.10`), `expo-doctor 18/18` (after placeholder PNGs)

## Phase 12 — Release Blocker Audit (Strict)

| Blocker | Status | Evidence | Action Required |
|---|---|---|---|
| FINAL ICON REQUIRED | **BLOCKED** | `mobile/assets/icon.png` 1×1 68 bytes, `file` → `PNG 1×1`, need 1024×1024 | USER ACTION: replace with final branded `Clean` icon per `assets/README.md` |
| FINAL SPLASH REQUIRED | **BLOCKED** | `splash.png` 1×1 68 bytes, need 1284×2778 | USER ACTION: replace with final `Clean` splash |
| FINAL ADAPTIVE ICON REQUIRED | **BLOCKED** | `adaptive-icon.png` 1×1 68 bytes, need 1024×1024 | USER ACTION: replace |
| PRODUCTION HTTPS API REQUIRED | **BLOCKED** | `eas.json production.env` placeholder `https://api.example.com/api/v1`, dev `http://192.168.1.15` LAN only | USER ACTION: deploy backend to real HTTPS host, update `eas.json production.env` + `mobile/.env.production` to `https://api.yourdomain.com/api/v1` |
| PRODUCTION BACKEND REQUIRED | **BLOCKED** | No prod deployment yet, `storage/clean.sqlite` is dev DB (55 orders) not prod, `server/.env` missing (dev fallback) | USER ACTION: provision Node ≥20 host with `NODE_ENV=production`, persistent `DATABASE_PATH`, `JWT_SECRET` ≥32, `PORT/HOST`, `npm run db:migrate`, `pm2`/`systemd`, TLS reverse proxy |
| APPLE DEVELOPER ACCOUNT REQUIRED | **BLOCKED** | No `eas whoami`, no Apple credentials | USER ACTION: Apple Developer account, `eas login`, `eas credentials`, decide bundle identifier already `com.clean.laundry` (valid, preserve) |
| GOOGLE PLAY ACCOUNT REQUIRED | **BLOCKED** | No Play Console | USER ACTION: Google Play Console account, `eas credentials` |
| HOSTED PRIVACY POLICY REQUIRED | **BLOCKED** | `PRIVACY_POLICY_DRAFT.md` has `[OWNER INFORMATION REQUIRED]` placeholders, not hosted | USER ACTION: fill legal name/address/email/phone, host at `https://example.com/privacy`, set `Support URL`/`Privacy URL` in `STORE_METADATA.md` |
| PRIVACY CONTACT DETAILS REQUIRED | **BLOCKED** | Same placeholders | USER ACTION: fill owner legal entity |
| STORE SCREENSHOTS REQUIRED | **BLOCKED** | No store screenshots captured yet | USER ACTION: capture 10 demo-data screenshots iPhone 13 per `STORE_METADATA.md` plan, no real PII |
| MANUAL IPHONE TEST REQUIRED | **MANUAL TEST REQUIRED** | All 30 final tests not auto-passed (see below) | USER ACTION: physical iPhone 13 testing via `exp://192.168.1.15:8081` |
| MANUAL TESTFLIGHT TEST REQUIRED | **NOT STARTED** | No `eas build --profile production` yet | USER ACTION: after assets+API, `eas build --platform ios --profile production` then TestFlight internal |
| MANUAL ANDROID TEST REQUIRED | **NOT STARTED** | No Android build yet | USER ACTION: `eas build --platform android --profile production` |
| EAS LOGIN REQUIRED | **BLOCKED** | `npx eas whoami` → `could not determine executable` (not installed/logged) | USER ACTION: `npm install -g eas-cli` then `eas login` |

**Overall Classification:** **NOT READY — BUILD READY (for preview) but NOT STORE SUBMISSION READY** (placeholder assets + no prod HTTPS API + no Apple/Google accounts + no hosted privacy + no screenshots + no manual iPhone final). Do NOT call production-ready while any real blocker remains. `RELEASE_CHECKLIST.md` categorizes same: `COMPLETE` for code/config, `BLOCKED` for assets/API/accounts, `USER ACTION REQUIRED` for owner decisions, `MANUAL TEST REQUIRED` for iPhone.

## App Identity Final (Verified)

- **Name:** Clean (user-facing, `app.json` `name Clean`, `README # Clean`, `mobile/README # Clean Mobile` fixed from `# LabaHub Mobile` — only LabaHub found via `grep` user-facing)
- **Slug:** clean
- **Version:** 0.1.0 (marketing, `app.json` + `mobile/package.json 0.1.0` + `server/package.json 0.1.0` + `Settings About`)
- **iOS Bundle Identifier:** `com.clean.laundry` (`app.json` `ios.bundleIdentifier`)
- **Android Package:** `com.clean.laundry` (`app.json` `android.package`)
- **iOS Build Number / Android versionCode:** `autoIncrement true` in `eas.json` `production` (increments per `eas build --profile production`, marketing `0.1.0` stays)
- **Scheme:** `clean`
- **Primary Color:** `#172554`

No casual identifier change after this.

## Build Number Strategy

Keep marketing `0.1.0` until store. `eas.json` `production.autoIncrement true` → iOS `CFBundleVersion` and Android `versionCode` increment per uploaded binary (`0.1.0 build 1`, `build 2`, etc.), no marketing version bump per internal build. Documented in `STORE_METADATA.md` and `app.json` version constant.

## Final Icon / Splash / Adaptive Icon

**Current:** All four `mobile/assets/` files exist but are **placeholder 1×1 transparent 68 bytes** (`file` → `PNG 1×1`, `ls -lh` 68 bytes) to satisfy `expo-doctor`/`app.json` validation. **No arbitrary branding generated** per instruction (leave configuration ready). `assets/README.md` documents required final: `icon.png 1024×1024` Clean laundry icon readable no tiny text with padding #172554, `adaptive-icon.png 1024×1024` safe padding, `splash.png 1284×2778` centered `Clean` + `Laundry Management` on #f4f6fb simple, `favicon.png 48×48`. Expo Go shows default icon until replaced — still runs, not breaking dev. **Status: FINAL ASSET REQUIRED / USER ACTION REQUIRED** in `RELEASE_CHECKLIST.md`.

## Brand Consistency

User-facing consistently `Clean` (`app.json` `name Clean`, `README # Clean`, `mobile/README # Clean Mobile`, `app.json description`). No remaining visible `LabaHub/LabaDaLokal/Lavora` in user UI (verified `grep -r LabaHub` only old `mobile/README.md` fixed). Historical/internal DB records preserved where rename would break (e.g., old `shops` name if was `LabaHub` shop name — not changed; no historical transaction data renamed just for branding).

## Expo Production Configuration

**app.json Audit:** `name`, `slug`, `version`, `orientation portrait`, `userInterfaceStyle light` (not `automatic` for consistency), `newArchEnabled true`, `scheme clean`, `description`, `primaryColor`, `icon`/`splash`/`adaptiveIcon`/`favicon`, `assetBundlePatterns ["**/*"]`, `ios.supportsTablet true` `bundleIdentifier com.clean.laundry` `infoPlist ITSAppUsesNonExemptEncryption false`, `android adaptiveIcon backgroundColor #f4f6fb` `package com.clean.laundry` `edgeToEdgeEnabled true`, `web favicon` `bundler metro`, `plugins` 5, `experiments typedRoutes` — all valid SDK 54, not upgraded.

**EAS Audit:** `mobile/eas.json` verified `cli >=5.9.3` (SDK 54 compatible), `build.development` (`developmentClient true`), `build.preview` (`distribution internal`, `simulator false`, `buildType apk`, `env LAN`), `build.production` (`distribution store`, `autoIncrement true`, `env EXPO_PUBLIC_API_BASE_URL https://api.example.com/api/v1` placeholder), `submit.production {}`. Not executed (requires credentials).

**SDK Locked:** `mobile/package.json` `expo ~54.0.37`, `react 19.1.0`, `react-native 0.81.5`, `expo-sqlite 16.0.10`, `expo-secure-store 15.0.8` — not upgraded, `npm audit` `fix --force` not run (would break SDK 54).

## EAS Configuration (Detailed)

- **Development:** `developmentClient true`, `distribution internal` — for `expo-dev-client` with LAN API.
- **Preview:** `distribution internal`, `ios simulator false`, `android buildType apk`, `env LAN` — for `eas build --profile preview` internal testing with `192.168.1.15` (no store).
- **Production:** `distribution store`, `autoIncrement true`, `env https://api.example.com/api/v1` **placeholder** — for `eas build --profile production` store submission, must be real HTTPS before external TestFlight. `submit.production {}` empty.

## Production Environment

**Separation:** Development `http://192.168.1.15:3000/api/v1` (`mobile/.env` LAN, `eas.json preview.env`), Production placeholder `https://api.example.com/api/v1` (`eas.json production.env` — **must be replaced** with real `https://api.yourdomain.com/api/v1` before external build, never LAN IP in production). Architecture supports `Development http://192.168.x.x` vs `Production https://example.com` via centralized `src/config/api.ts` (`EXPO_PUBLIC_API_BASE_URL` with `replace(/\/$/, '')`).

**Env Safety:** `mobile/.env` + `.env.example` only `EXPO_PUBLIC_API_BASE_URL` (client-visible safe, no secret), `server/.env.example` documents `PORT=3000` `HOST=0.0.0.0` `NODE_ENV=development` `DATABASE_PATH=./storage/clean.sqlite` `JWT_SECRET=change-me...` `JWT_EXPIRES_IN=7d`, no `server/.env` committed (dev fallback only). No `JWT_SECRET`/`DB` in `EXPO_PUBLIC`, no `console.log` of tokens (verified `grep JWT/password` not logged, only `[config]` warning).

**JWT Production Safety:** `server/src/config/env.ts` `requireJwtSecret` → if `NODE_ENV===production` and `<16` → throw `must be at least 16`, else dev fallback `dev-clean-jwt-secret-change-me-32chars!!` with `console.warn`. Production must set `JWT_SECRET=≥32` random chars.

**Production Backend Readiness (Documented, Not Deployed):** Needs `NODE_ENV=production`, `JWT_SECRET ≥32`, `HOST/PORT`, persistent `DATABASE_PATH` (not dev `clean.sqlite` with 55 orders test data), `npm run db:migrate`, `pm2`/`systemd`, `health` endpoint `/api/v1/health`, logging, backups, HTTPS reverse proxy (nginx). **NOT deployed** in Phase 12 (requires hosting target, **USER ACTION**).

**Production Database Strategy:** `storage/clean.sqlite` **204 KB** dev **NOT** uploaded as prod, preserved for dev/testing. Production: separate file or managed DB (e.g., `DATABASE_PATH=/data/prod.sqlite` on server, `npm run db:migrate` fresh schema, no dev test records copied) — documented in `RELEASE_CHECKLIST.md` `Test Data Cleanup Strategy`.

**HTTPS Requirement:** Production API must be `https://` TLS, not plain `http://192.168.1.15`. Dev LAN `http://` acceptable locally via `preview` profile (`eas.json preview.env` LAN). Mark **HTTPS REQUIRED** until real `https://api.yourdomain.com` exists.

**iOS Network Config:** No global `NSAllowsArbitraryLoads` exception; Expo Go development uses LAN `http://` via `preview` only, production `https://` preserves ATS.

## Permissions Audit

**iOS:** No `infoPlist` camera/microphone/contacts/location beyond `ITSAppUsesNonExemptEncryption false`; plugins `expo-router`, `expo-sqlite`, `expo-asset`, `expo-secure-store`, `expo-font` only.

**Android:** No `permissions` array in `app.json`; verified `package.json` deps `expo`, `react-native` etc., no `expo-camera`, `expo-contacts`, `expo-media-library`. Permission footprint minimal (internet via `expo` for sync/fetch, not declared).

## Security Regression (Phase 12 Final)

- `bcryptjs` hashing (`server/src/modules/auth/auth.routes.ts` `bcrypt.hash`) ✅
- No plaintext passwords (verified) ✅
- `JWT` `jsonwebtoken` sign/verify `authMiddleware` (`Authorization: Bearer`) ✅
- `SecureStore` token (`store/authStorage.ts` `expo-secure-store` `setItemAsync` encrypted) ✅
- Shop scoping `req.auth.shopId` derived never trust client `shop_id` for `customers/services/orders/payments/reports/sync` (verified `mariaToken` 404 on `testShopId`) ✅
- No `JWT` printed (`grep JWT` not logged except config warning) ✅
- No credentials in source ✅
- No hardcoded production `JWT_SECRET` ✅
- No `SQL`/`stack` exposure (`ErrorState` generic `Your local data is safe.`) ✅
- Production `JWT` enforcement (`NODE_ENV=production` throw) ✅

## Privacy Audit (Actual Data)

**Collected:** Owner account/shop (name/email/shop contact, hashed password), customer names/contacts/address/notes (manual entry, shop-scoped), orders (number, snapshots `₱70/kg` etc., weight, totals, status), payments (`Cash/GCash/Other` + optional `reference/notes`, append-only), services (`per_kg/per_piece/fixed/per_load 160/8kg`), sync metadata (`sync_status`, `last_synced_at`, `cursor`). Tokens in `SecureStore`.

**Not Collected:** Precise location, camera/photos, microphone, contacts address book (only manual contact), advertising ID, tracking, analytics SDK (verified `package.json` only `expo` + `sqlite` etc., no AdMob/Firebase).

**Privacy Policy:** `PRIVACY_POLICY_DRAFT.md` 11 sections + Appendix, `[OWNER INFORMATION REQUIRED]` placeholders (legal name, address, email, phone, effective date, Support URL), covers data collected (2.1–2.7), not collected, storage (local `clean.db` WAL + server `clean.sqlite` soft-delete + TLS), sync, retention, security `bcrypt` `JWT`, rights, etc. **DRAFT — NOT LEGAL ADVICE**, must be hosted before store.

**Hosted Privacy Policy:** No hosted URL yet — **BLOCKED** (`USER ACTION REQUIRED` to host at `https://example.com/privacy` and set `Support URL`/`Privacy URL` in `STORE_METADATA.md`).

## App Store / Play Store Metadata

**Status:** `STORE_METADATA.md` drafted final `App Name Clean — Laundry Manager`, `Slug clean`, `Version 0.1.0`, `iOS bundleIdentifier`/`Android package` `com.clean.laundry`, App Store `Promotional Text`, `Description` (Receive with snapshot `₱160/8kg`, Customers/Services, Tracking `RECEIVED→COMPLETED`, Payments `Cash/GCash/Other`, Reports `Today/7d/Month/All`, Sync offline-first, no QR), `Keywords`, `Category Business/Productivity`, Play `Short/Full Description` (same plus `Permissions: none beyond internet`), `Release Notes` `Clean 0.1.0 Initial internal/beta` (Auth, Customers, Services, Receive, Tracking, Payments, Reports, Offline, Sync — no QR), not submitted (`DO NOT eas submit`).

## Screenshot Plan / Privacy / Test Account

**Screenshot Plan:** 10 screens with demo `Test Customer 09170...` no PII/passwords/JWTs: 1 Login/Welcome, 2 Home `Today's Laundry` + `Collected/Outstanding`, 3 Receive `5.5kg 1 Load ₱160`, 4 Orders list filters, 5 Order Details `Pricing` + `Status History`, 6 Customers `09171234567`, 7 Services `Wash & Dry Per load ₱160/8kg`, 8 Payments `Transactions` + `Outstanding`, 9 Reports `Today Collections` + `Top Services`, 10 Sync/Settings `Synchronization Synced`. **Status:** Not captured yet — **BLOCKED** (`SCREENSHOTS REQUIRED` `USER ACTION REQUIRED`).

**Test Account Strategy:** No hardcoded credentials in app; `README` `PRIVATE` not committed; store review credentials if needed later must be provided securely via App Store Connect `Test Account` notes (documented in `PRIVACY_POLICY_DRAFT.md` `Test Account` placeholder). No real passwords in README.

## EAS / Apple / Google Account Status

**EAS Login:** `npx eas whoami` → `could not determine executable to run` (not installed globally, not logged in) — **EAS LOGIN REQUIRED** (`npm install -g eas-cli` then `eas login` requires [OWNER APPLE/GOOGLE ACCOUNT]).

**Apple Developer:** No `eas credentials`, no Apple Developer account verified — **APPLE DEVELOPER ACCOUNT REQUIRED** `USER ACTION REQUIRED` (do not paste password into OpenCode).

**Google Play:** No Play Console — **GOOGLE PLAY ACCOUNT REQUIRED** `USER ACTION REQUIRED`.

## Build Readiness

**iOS Preview Build:** Only ready if `final assets` + `preview API` `http://192.168.1.15` (currently preview LAN) + `eas.json` + credentials — **BLOCKED** until `APPLE DEVELOPER ACCOUNT` + `eas login`.

**Android Preview Build:** Similarly `adaptive-icon` placeholder **BLOCKED**, `preview` LAN ready but needs `GOOGLE PLAY ACCOUNT` for internal testing.

**Production Build:** `production` needs `final assets` (1024×1024 etc.) + real `https://api.example.com` replaced + `HTTPS` + `Apple/Google` accounts — all **BLOCKED** (documented in `RELEASE_CHECKLIST.md`).

**Build Commands (verified `eas.json`):**
- `npm install -g eas-cli`
- `eas login` (requires Owner account)
- `eas build --platform ios --profile preview` (internal, no store, uses LAN)
- `eas build --platform android --profile preview` (`buildType apk`)
- `eas build --platform ios --profile production` (requires real `https://api.yourdomain.com` + final icons, `autoIncrement`)
- `eas build --platform android --profile production`
- **DO NOT** `eas submit` without explicit permission (Phase 11/12 rule).

## Verification Results (2026-08-29 Phase 12 Final — No Publish)

**Build/Config:**
- `mobile npm run typecheck` → `0` ✅ (after `theme`, `StatusBadge`, `Toast`, `ErrorBoundary`)
- `server npm run build` → `0` ✅
- `npx expo-doctor` → `18/18` ✅ (after placeholder PNGs 1×1, was 17/18 before)
- `npx expo export` → `0` `ios 2.92 MB 452660...hbc` `android 2.92 MB 107294...hbc` ✅ `SDK 54` not upgraded (`expo ~54.0.37` `babel-preset-expo 54.0.10`)
- `expo config --type public` validates `app.json` `name/slug/version/icon/splash/bundleIdentifier` ✅

**Runtime:**
- `GET /api/v1/health` → `200 connected` ✅
- `PRAGMA integrity_check` → `ok` ✅ `clean.sqlite` **204 KB** (not recreated) 7 migrations `..._payments_method:7` ✅ Counts: shops 3, users 3, customers 8, services 7, orders 55, payments 41, history ~70 `outstanding 694500` (verified before Phase 12 tests) ✅
- `EXPO_PUBLIC_API_BASE_URL` centralized `src/config/api.ts` only, no hardcoded IP elsewhere ✅

**Regression (phase10-regression.mjs re-run):**
- `health 200` ✅ `login 200` ✅ `customers list 200` ✅ `services list 200` ✅ `per_load exists` ✅ `receive 5.5kg 16000` ✅ `PROCESSING→READY→COMPLETED` `ready_at` ✅ `GCash` `gcash` ✅ `reports summary` `collections number` ✅ `sync push/pull` `synced` ✅ `shop scoping maria 404` ✅ `snapshot 7000 PER_KG` preserved ✅ `SNAP_160 16000 8000` ✅ **ALL PASS**

**Historical Pricing Regression:**
- `₱70/kg 7000 PER_KG` (`CLN-20260829-0001`) still ✅ `₱80/kg 8000` ✅ `₱160/8kg 16000 8000` (`CLN-20260829-0004`) ✅ `PER_PIECE` `8000/piece` ✅ `FIXED 5000` ✅ No UX `formatWeight` / report recalculation.

**Sync Regression:**
- Offline create `Pending` → `Sync Now` → `Synced` ✅ Retry no duplicate ✅ Pull server `ServerPullCust` → locally ✅ Interrupted sync resume ✅ Restart persistence `clean.db` intact `user_version 5` ✅

**Reports Regression:**
- `Collections 372000` vs `Order Value 1016500` vs `Outstanding 644500` ✅ `Daily Trend` `Aug 29 372000` ✅ `Top Services Wash & Dry` snapshot ✅ `Payment Methods` `cash/gcash` totals ✅ `Date filters` `Today/7d/Month/All` + custom `2099` empty `0` ✅

**Security:**
- `bcryptjs` ✅ `JWT` `authMiddleware` `req.auth.shopId` shop-scoped ✅ `mariaToken` 404 ✅ `SecureStore` ✅ no plaintext passwords ✅ no hardcoded production secret ✅ no `console.log` of tokens ✅

**Performance:**
- `Orders`/`Customers`/`Payments` `FlatList` ✅ `Reports` `limit 5/50` ✅ `sync` chunk `50` ✅ large data `55 orders` still usable ✅ `2.92 MB` export still budget ✅

**NPM Audit Review:**
- `mobile` 18 vulns (`xcode` transitive via `expo` `xcode` → `@expo/config-plugins` → `expo` `4.0.13-canary...`) + `server` 7 vulns (`tar` via `sqlite3→node-gyp`) — both require `npm audit fix --force` breaking `SDK 54` (`sqlite3@6.0.1`, `expo` canary) → **intentionally left unresolved**, documented as transitive not runtime, safe compatible updates none.

## Warnings / Remaining Issues

- `JWT_SECRET` fallback dev only (production throws) — not blocking dev
- `npm audit` `mobile 18` / `server 7` vulns transitive, `fix --force` breaks `SDK 54` — intentionally not fixed, documented
- Placeholder icons 1×1 transparent **BLOCKED** (need real 1024×1024 etc. before `eas build --profile production`)
- No `eas login`/credentials yet (requires `npm install -g eas-cli` + `eas login` + Apple/Google account ownership decisions — **BLOCKED**)
- No production HTTPS API yet (`eas.json production` placeholder `https://api.example.com` — **BLOCKED**)
- No hosted privacy policy URL yet (`PRIVACY_POLICY_DRAFT.md` placeholders — **BLOCKED**)
- No store screenshots yet (10 demo-data) — **BLOCKED**
- Manual iPhone final retest required (30 steps, see below) — **BLOCKED** until physical test

## MANUAL IPHONE TEST REQUIRED — FINAL (iPhone 13 Expo Go `exp://192.168.1.15:8081` — Do NOT auto-pass — concise 30)

**APP STARTUP** 1 Kill Expo Go, launch `Clean` via `exp://192.168.1.15:8081`, verify `Restoring session...` → `Home` (cached) not flash `Login`, 2 Logout → `Login` → Login `test@clean.test`/`password123` → `Home`.

**CUSTOMERS** 3 `Customers → + Add` `Test Phone 09170000002` `address` → `Save` disabled until `name/phone` valid, success `Toast` `Customer saved` (or `Alert`), search `091700` finds, long name wraps.

**SERVICES** 4 `Services & Rates → + Add` `Wash & Dry` `Per load ₱160` `weight_block 8` `Save Service` → `₱160.00 / 8kg`, `per_piece` `Comforter` `₱80/piece`, `fixed` `Pickup Fee` `₱50`, `Active/Inactive` badge via `StatusBadge`.

**RECEIVE LAUNDRY** 5 `Receive Laundry` → customer `Test Phone` → service `Wash & Dry` → weight `5.5` → `1 Load ₱160` `Total ₱160`, weight `decimal-pad`; 6 `12kg` → `2 Loads ₱320`; 7 Add `Additional 20` `Rush 50` → `Total ₱230` `UNPAID` → Review `Customer Service Rate Weight Loads Base Additional Rush TOTAL` → `Create` disabled until `weight>0` → `Order received` `Toast` → `Orders`.

**ORDERS** 8 `Orders` → filters `All|Received|Processing|Ready|Completed` → `All` all, `Received` only `RECEIVED`, search `091700` via contact, `READY` `Ready today` orange highlight if `≥2 days`.

**ORDER DETAILS** 9 Open order → sections `Order Information`, `Customer`, `Laundry Service`, `Pricing`, `Payment`, `Status` (`RECEIVED` badge), `Status History` timeline, not raw DB field names, `formatWeight` `5.5 kg` not `5500g`, `formatDate` `Aug 29, 2026 • 1:30 PM`.

**PAYMENTS** 10 `Payments` → `Collected Today` `Outstanding` `Unpaid` shop-scoped, `Search` `order_number`/`reference`, filters `All|Unpaid|Partial|Paid`, `Transactions` `₱130 GCash Ref` individual, `Outstanding` `Balance ₱280 PARTIAL` tap → `Order Details`; 11 `Order Details → Add Payment` `100` `Cash` → `Paid 100 Balance 130 PARTIAL` `Toast` `Payment recorded`, `GCash` `130` + `Ref` + `Notes` → `PAID 0`, overpay `150` on `130` rejected `exceeds balance`.

**REPORTS** 12 `Reports` → `Today` `Collections` vs `Order Value` vs `Outstanding` (never confused, `Collections` payments `200`, `Order Value` orders `500`), `Orders` `Avg`, `RECEIVED 5` bars, `UNPAID` etc., `Daily Trend` `Aug 29 ₱200`, offline `Reports` still local.

**OFFLINE** 13 Stop backend, create `OfflineCust 09172222222` → `Customers` offline, order `5kg` → `Orders` `PENDING`, add payment `₱50` → `Payments` offline, `Reports` offline still local via `DATE(*,'localtime')`, `Orders` `FlatList` still usable.

**SYNC** 14 Start backend, `Settings → Sync Now` → `Syncing...` → `Synced` `Pushed 4 Pulled 0 Pending 0` `Toast` `Sync complete`, `Last Synced` updates; 15 `Sync Now` again no duplicate `1 customer,1 order,1 payment,1 history`; 16 Pull: `curl POST /customers` server `ServerPullSyncCust`, `Sync Now` → `Pulled 1` → `Customers` search finds; 17 Interrupted: create 3 pending offline, `Sync Now`, kill backend mid, restart, `Sync Now` again resumes no duplicates; 18 Restart: close Expo Go, reopen `exp://192.168.1.15:8081`, verify `OfflineCust` order/payment still, `Reports` still, `Pending 0`.

**UX** 19 Keyboard `email/phone/decimal-pad` not behind `Save` (scroll), `SafeArea` no notch/home indicator, `Loading` `Restoring session...`, `Empty` `No customers yet` with `Add` button, `Error` `Server unavailable. Working with local data.` not raw `SQL`, `Toast` `Customer saved` etc., `ErrorBoundary` catch, `Back` predictable.

**RESTART PERSISTENCE** 20 After `Synced`, kill app, reopen, verify `Pending 0` `Last Synced` persists.

## Production Blockers (Not Production-Ready While Any Remain) — STRICT CLASSIFICATION

**Current Classification:** **NOT READY — BUILD READY (for `preview` internal) but NOT STORE SUBMISSION READY**

- **FINAL ICON REQUIRED** — `mobile/assets/icon.png` placeholder 68 bytes 1×1, need final 1024×1024 → **BLOCKED** `USER ACTION REQUIRED`
- **FINAL SPLASH REQUIRED** — `splash.png` placeholder, need final 1284×2778 → **BLOCKED**
- **FINAL ADAPTIVE ICON REQUIRED** — `adaptive-icon.png` placeholder → **BLOCKED**
- **PRODUCTION API REQUIRED** — `eas.json production.env EXPO_PUBLIC_API_BASE_URL https://api.example.com/api/v1` placeholder, not real `https://api.yourdomain.com` → **BLOCKED**
- **HTTPS REQUIRED** — production API must be TLS, not LAN `http://192.168.1.15` → **BLOCKED**
- **PRODUCTION BACKEND REQUIRED** — no prod deployment yet (needs `NODE_ENV=production`, `JWT_SECRET≥32`, `HOST/PORT`, `DATABASE_PATH` persistent, `npm run db:migrate`, `pm2`/`systemd`, TLS) → **BLOCKED**
- **APPLE DEVELOPER ACCOUNT REQUIRED** — for `eas login` + `eas build --platform ios --profile production` + TestFlight → **BLOCKED** `USER ACTION REQUIRED`
- **GOOGLE PLAY ACCOUNT REQUIRED** — for `eas build --platform android` → **BLOCKED**
- **EAS LOGIN REQUIRED** — `npx eas whoami` → `could not determine executable` (not installed/logged) → **BLOCKED** `npm install -g eas-cli` + `eas login`
- **HOSTED PRIVACY POLICY REQUIRED** — `PRIVACY_POLICY_DRAFT.md` has `[OWNER INFORMATION REQUIRED]` placeholders, not hosted → **BLOCKED**
- **PRIVACY CONTACT DETAILS REQUIRED** — same placeholders → **BLOCKED**
- **STORE SCREENSHOTS REQUIRED** — demo-data `Test Customer 09170...` 10 screens per `STORE_METADATA.md` not captured → **BLOCKED**
- **MANUAL IPHONE TEST REQUIRED** — all 20+30 steps above not auto-passed → **MANUAL TEST REQUIRED**
- **MANUAL TESTFLIGHT TEST REQUIRED** — no `eas build --profile production` yet → **NOT STARTED**
- **MANUAL ANDROID TEST REQUIRED** — no Android build yet → **NOT STARTED**

Do NOT call Clean production-ready/store-submission-ready while any real blocker above remains. `RELEASE_CHECKLIST.md` categorizes same.

## Recommended Next Phase

**Phase 12 (if you want adjustments) or Post-Launch Ops** — After you replace final assets, set real `https://api.yourdomain.com` in `eas.json production`, `eas login`, `eas credentials`, `eas build --platform ios --profile production` (and Android), TestFlight internal/beta (requires explicit `eas submit` — do NOT auto), Play internal testing, privacy policy hosted, screenshots captured, crash reporting (Sentry Expo) optional, OTA `eas update` workflow, support flow, no new business logic. Awaiting your explicit adjustment instructions — **NOT PUBLISHED**.

## Files Created/Modified (Phase 12 Review — No New Business Logic)

**Created in earlier phases, verified Phase 12:**
- `mobile/eas.json` (production-ready config, placeholder `https://api.example.com` — **BLOCKED** until real URL)
- `STORE_METADATA.md` (drafts `Clean — Laundry Manager` etc. — ready, not submitted)
- `PRIVACY_POLICY_DRAFT.md` (draft, `[OWNER INFORMATION REQUIRED]` — **BLOCKED**)
- `RELEASE_CHECKLIST.md` (checkboxes `COMPLETE`/`BLOCKED`/`USER ACTION REQUIRED`/`MANUAL TEST REQUIRED`)

**Modified (Phase 10, verified Phase 12):**
- `mobile/app.json` (icons/splash/identifiers `com.clean.laundry` — verified not changed in Phase 12)
- `mobile/assets/` placeholder PNGs kept (68 bytes each) + `assets/README.md` verified
- `README.md` (full `Quick Start` `Physical iPhone` `Features 1–10` etc. — verified Phase 12)
- `server/src/config/env.ts` (JWT prod throw — verified)

**Database/Migrations Changed:**
- None in Phase 12 (no new migrations, preserves `storage/clean.sqlite` **204 KB** 7 batches, `mobile clean.db` `user_version 5`).

## Manual Commands Available for Later (Verified `eas.json`)

```bash
# Install EAS
npm install -g eas-cli

# Login (requires Owner Apple/Google account — USER ACTION)
eas login
eas whoami

# Credentials (requires decision on bundleIdentifier com.clean.laundry already set)
eas credentials

# Local checks (no credentials needed — already passing)
cd mobile && npm run typecheck          # 0
cd server && npm run build              # 0
cd mobile && npx expo-doctor            # 18/18
cd mobile && npx expo export            # 2.92 MB
cd server && npm run db:migrate         # Batch 7

# Preview builds (internal, uses LAN or preview API, no store)
eas build --platform ios --profile preview        # uses http://192.168.1.15:3000/api/v1
eas build --platform android --profile preview    # buildType apk

# Production builds (requires FINAL ASSETS + real https://api.yourdomain.com + Apple/Google accounts)
# 1. Replace mobile/assets/icon.png (1024×1024), splash.png (1284×2778), adaptive-icon.png (1024×1024)
# 2. Edit mobile/eas.json production.env EXPO_PUBLIC_API_BASE_URL to https://api.yourdomain.com/api/v1
# 3. Ensure server/.env on prod host has JWT_SECRET≥32, NODE_ENV=production
eas build --platform ios --profile production     # autoIncrement buildNumber, distribution store
eas build --platform android --profile production # autoIncrement versionCode

# DO NOT run without explicit permission:
# eas submit --platform ios --profile production
# eas submit --platform android --profile production
```

**Confirmation:** **NOTHING was published/submitted** in Phase 12 — no `eas build --profile production` executed (only `npx expo export` local), no `eas submit`, no App Store / Play Store submission, no public release, `storage/clean.sqlite` preserved, all pending/synced records preserved, `DEV_CHECKPOINT.md` updated, waiting for your next adjustment instructions.

