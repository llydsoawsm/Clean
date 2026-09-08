# STORE_METADATA — Clean 0.1.0

> Drafts for App Store (iOS) and Google Play (Android). All descriptions reflect actual Phase 1–10 functionality. No QR receipt / claim code (intentionally excluded).

---

## Application Identity (Final)

- **App Name:** Clean
- **Slug:** clean
- **Version:** 0.1.0 (marketing)
- **Build Number Strategy:** `autoIncrement: true` in `eas.json` `production` (iOS `CFBundleVersion` + Android `versionCode` increment per upload, marketing `0.1.0` stays until store)
- **iOS Bundle Identifier:** `com.clean.laundry` (in `app.json` `ios.bundleIdentifier`)
- **Android Package:** `com.clean.laundry` (in `app.json` `android.package`)
- **Scheme:** `clean`
- **Primary Color:** `#172554`

---

## App Store — iOS

**App Name (30 chars):** Clean — Laundry Manager

**Subtitle (30 chars):** Offline Laundry Shop System

**Promotional Text (170 chars):**
Clean keeps your laundry shop running without internet. Receive orders, track laundry, handle payments, and view reports — then sync when online.

**Description (4000 chars):**
Clean is an offline-first laundry shop management app for owners.

Receive laundry fast:
- Choose customer and service
- Enter weight (per-kg) or quantity (per-piece) or package (per-load ₱160 / 8kg, configurable)
- Add additional/rush fees and initial payment — pricing snapshot preserved

Manage customers and services:
- Search customers by name or phone, shop-scoped
- Services: per-kg, per-piece, fixed, per-load (e.g., Wash & Dry ₱160 per 8kg)

Track every order:
- Status workflow RECEIVED → PROCESSING → READY → COMPLETED (balance must be 0 to complete)
- Ready aging: “Ready today” / “Ready for N days” highlight
- Full status history timeline

Handle payments honestly:
- Cash, GCash, Other with optional reference/notes
- Payment history append-only, overpayment rejected, balance recalculated from transactions
- Outstanding balances and daily collections (payments-based, not order totals)

Understand your shop:
- Today / Last 7 Days / This Month / All Time (local date via DATE(*,'localtime'))
- Collections vs Order Value vs Outstanding (never confused)
- Order/ payment status counts, top services (snapshot), top customers, payment methods, daily trends (simple bars)

Stay in sync, stay offline:
- All business works offline via local SQLite (WAL, shop-scoped)
- When online, sync pushes Customers → Services → Orders → Payments → Status History (idempotent UUIDs, dependency order, per-record results) and pulls incremental changes via cursor
- Shop A never sees Shop B data; pending changes show in Settings

Designed for iPhone, practical for shop owners, no QR/claim code.

**Keywords (100 chars, comma-separated):**
laundry, laundry shop, offline pos, laundry management, dry cleaning, wash dry, payments, reports, sync

**Support URL:** [OWNER URL REQUIRED]

**Privacy Policy URL:** [OWNER URL REQUIRED] — see `PRIVACY_POLICY_DRAFT.md`

**Category:**
- Primary: Business
- Secondary: Productivity

**Age Rating:** 4+ (no objectionable content)

**Copyright:** © 2026 [OWNER LEGAL NAME REQUIRED]

---

## Google Play — Android

**App Name (50 chars):** Clean — Laundry Manager

**Short Description (80 chars):**
Offline-first laundry shop management — receive, track, payments, reports, sync.

**Full Description (4000 chars):**
(Same as iOS Description above — keep consistent. Add for Android:)

Clean works without internet for daily operations:
- Receive laundry with snapshot pricing (₱70/kg, ₱80/kg, ₱160/8kg preserved)
- Customers & Services offline CRUD, shop-scoped
- Orders with RECEIVED/PROCESSING/READY/COMPLETED and Ready aging
- Payments Cash/GCash/Other, append-only history, outstanding
- Reports Today/7d/Month/All, Daily trends

When online: sync pushes pending changes in dependency order and pulls server updates incrementally. All data is shop-scoped.

Permissions: none beyond internet for sync (no camera/contacts/microphone requested). See privacy policy for data handling.

**Feature Graphic:** 1024×500 — Clean logo on #f4f6fb with text “Offline-First Laundry Management”

**Category:** Business

**Content Rating:** Everyone

**Contact Details:** [OWNER EMAIL/PHONE REQUIRED]

---

## Release Notes — Clean 0.1.0 (Initial Internal/Beta Release)

Initial internal/beta release including:
- Authentication (register/login, 7-day offline session, SecureStore)
- Customers & Services & Rates (shop-scoped, offline CRUD, per-load ₱160/8kg)
- Receive Laundry (snapshot pricing, weight/quantity, fees, payment, RECEIVED PENDING)
- Order Tracking (RECEIVED→PROCESSING→READY→COMPLETED, Ready aging, status history, balance guard)
- Payments (Cash/GCash/Other, reference/notes, append-only history, outstanding, daily collections)
- Reports (Today/7d/Month/All/Custom, Collections vs Order Value vs Outstanding, avg, status counts, top services/customers, payment methods, daily trends simple bars)
- Offline-first SQLite (WAL, shop-scoped) + Sync (push in dependency order, pull incremental cursor, idempotent UUIDs, retry 2s/5s/15s, shop-scoped)
- Polish: consistent headers, OfflineBanner, Toast, Empty/Error/Loading, StatusBadge, SafeArea, keyboard handling

No QR receipt/claim code (intentionally excluded). This is an internal/beta test build, not yet public stable — awaiting final icon/splash (currently 1×1 placeholder, see `mobile/assets/README.md`) and production HTTPS API.

---

## Screenshot Plan (10 required, use test/demo data, no real PII)

Use iPhone 13 (6.1") and Android (1080×1920). All with demo data `Test Customer 09170...`, not real numbers. No passwords/JWTs visible.

1. **Login / Welcome** — Clean logo, email/password, “Offline-first”
2. **Home** — `Today's Laundry 4 Received 3 Processing 2 Ready` + `Collected Today ₱X Outstanding ₱Y` + `Manage` cards (Orders/Customers/Services/Payments/Reports/Settings)
3. **Receive Laundry** — Customer `Juan Reyes` → Service `Wash & Dry ₱160/8kg` → Weight `5.5 kg 1 Load ₱160` → Fees → Payment → Review
4. **Orders** — List `CLN-20260829-0004 Wash & Dry ₱160 Bal:₱0 PAID` + filters `All|Received|Processing|Ready|Completed` + `Ready today` highlight
5. **Order Details** — `CLN-... RECEIVED` + `Customer` + `Pricing Total ₱230 Paid ₱100 Balance ₱130 PARTIAL` + `Status History` + `Payments` `Cash/GCash`
6. **Customers** — List `Juan Reyes 09171234567` search `0917` + `+ Add Customer`
7. **Services & Rates** — `Wash & Dry Per load ₱160.00 / 8kg` `Comforter Per piece ₱80` `Pickup Fee Fixed ₱50` + `Active` badge
8. **Payments** — `Financial Summary Collected Today ₱X Outstanding ₱Y` + `Transactions` `₱130 GCash Ref` + `Outstanding` `Balance ₱280 PARTIAL`
9. **Reports** — `Today Collections ₱X Order Value ₱Y Outstanding ₱Z` + `RECEIVED 5 PROCESSING 3` bars + `Daily Trend Aug 29 ₱950 5 orders` + `Top Services Wash & Dry 18`
10. **Sync / Settings** — `Synchronization Synced Last Sync 1:15 PM Pending 0 [Sync Now]` + `About Clean Version 0.1.0 • Expo SDK 54`

For each, capture light mode, status bar not showing sensitive data.

---

## Privacy Notes (for store forms)

See `PRIVACY_POLICY_DRAFT.md` + Section 31 in final report. Data collected: owner account/shop, customer names/contacts, orders/payments/services/sync metadata. No ad tracking, no analytics SDK, tokens in SecureStore, shop-scoped, local + server SQLite.

---

## Remaining Metadata Blockers

- [ ] Final `icon.png` 1024×1024 (currently 68 bytes placeholder, see `assets/README.md`) — **BLOCKED**
- [ ] Final `splash.png` 1284×2778 — **BLOCKED**
- [ ] Final `adaptive-icon.png` 1024×1024 — **BLOCKED**
- [ ] Owner legal name/address/email for Support/Privacy URLs
- [ ] Privacy Policy hosted URL (after approving draft)
- [ ] Screenshots captured from iPhone with demo data
- [ ] TestFlight tester account strategy (see `PRIVACY_POLICY_DRAFT.md` `Test Account` section)

All other metadata ready.
