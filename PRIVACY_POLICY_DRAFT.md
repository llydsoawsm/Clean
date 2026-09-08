# Privacy Policy DRAFT — Clean (Offline-First Laundry Shop Management)

> **DRAFT — NOT LEGAL ADVICE.** Replace all `[OWNER INFORMATION REQUIRED]` placeholders with your legal entity details before publishing. Host at a stable URL (e.g., `https://example.com/privacy`) and set `Support URL` / `Privacy Policy URL` in App Store Connect / Play Console.

**Effective Date:** [OWNER DATE REQUIRED — e.g., August 29, 2026]  
**App:** Clean — Version 0.1.0  
**Contact:** [OWNER EMAIL REQUIRED] / [OWNER PHONE REQUIRED] / [OWNER ADDRESS REQUIRED]

---

## 1. Introduction

Clean is an offline-first mobile laundry shop management system for shop owners. This policy explains what data Clean collects, why, where it is stored, and how it is protected.

## 2. Data We Collect — and Why

### 2.1 Owner Account & Shop
- **What:** Owner name, shop name, shop address/contact, email, hashed password, shop ID/currency/rush fee.
- **Why:** To create and authenticate your shop account, scope all business data to your shop, and restore your session offline.
- **Where:** Server `users`/`shops` (hashed password, never plaintext) + local `shops` cache (expo-sqlite) + SecureStore token (see 7).

### 2.2 Customer Information
- **What:** Customer name, contact number (phone), address/notes (optional) you enter when receiving laundry. No customer accounts, no passwords.
- **Why:** To identify laundry orders, search orders, show order history, and support shop analytics (top customers by order count).
- **Where:** Local `customers` (expo-sqlite) shop-scoped + server `customers` after sync (`shop_id`, `contact_number` unique per shop). Not shared across shops.

### 2.3 Laundry Orders
- **What:** Order number (`CLN-YYYYMMDD-####`), customer/service snapshots (service name, pricing type, unit price, weight block), weight/quantity, base/additional/rush/total, status (`RECEIVED→PROCESSING→READY→COMPLETED`), timestamps (`received_at`, `processing_at`, `ready_at`, `completed_at`), notes.
- **Why:** To track laundry lifecycle, pricing history, reports, and sync. Snapshots preserve historical `₱70/kg`, `₱80/kg`, `₱160/8kg` etc. even if service price later changes.
- **Where:** Local `orders` + server `orders` shop-scoped.

### 2.4 Payment Transactions
- **What:** Payment amount (centavos), method (`Cash`/`GCash`/`Other` + optional `reference`, `notes`), `created_at`, `order_id`, `shop_id`. Financial records append-only.
- **Why:** To record collections, outstanding balances, daily collections, and payment history.
- **Where:** Local `payments` + server `payments` shop-scoped. Not altered after creation (except soft-delete via sync tombstone).

### 2.5 Service & Rate Information
- **What:** Service name, `pricing_type` (`per_kg`, `per_piece`, `fixed`, `per_load`), `unit_price_centavos`, `description`, `weight_block_grams` (e.g., 8000), `is_active`.
- **Why:** To offer services when receiving laundry and to snapshot pricing at order time.
- **Where:** Local `services` + server `services` shop-scoped.

### 2.6 Synchronization Metadata
- **What:** `sync_status` (`PENDING|SYNCING|SYNCED|FAILED`), `last_synced_at`, `sync_state.last_sync_cursor`, `sync_logs` (entity, action, error, timestamp), `updated_at`/`created_at`/`is_deleted` for incremental pull.
- **Why:** To know what to push/pull, retry safely, detect conflicts, and avoid duplicates.
- **Where:** Local `sync_state`/`sync_logs` + server `updated_at` indexes.

### 2.7 Authentication Tokens
- **What:** JWT token (7-day expiry) + user/shop session.
- **Why:** To authenticate sync/report API calls without re-entering password, and to allow offline open via cached session.
- **Where:** `expo-secure-store` (encrypted) + in-memory `AuthContext`. Never committed to repo or logged.

## 3. Data NOT Collected

Clean does **not** collect or transmit (and store metadata confirms no SDK for):
- Precise location / GPS
- Camera / photos / microphone / contacts beyond the customer contact you manually enter
- Advertising ID / tracking / analytics SDK data (no AdMob, no Firebase Analytics, no Facebook SDK) — verified `mobile/package.json` dependencies: `expo`, `expo-sqlite`, `expo-secure-store`, `expo-router`, `react-native` only
- Financial credentials beyond payment `reference` you optionally enter (no card numbers, no bank logins, no full GCash credentials)
- Data from other shops (shop-scoped via `req.auth.shopId`, never trust client `shop_id`)

## 4. How Data Is Stored

- **Local device:** `mobile clean.db` (expo-sqlite WAL) on your iPhone — all business data shop-scoped, works offline. Deleting the app deletes local data (pending `PENDING` not yet synced would be lost — sync before deleting).
- **Server:** `server/storage/clean.sqlite` (Knex) per shop (`shop_id` FK), soft-delete `is_deleted` tombstones for pull.
- **In transit:** `https://api.example.com/api/v1` in production (see `eas.json` `production` env placeholder), TLS. Development LAN `http://192.168.1.15:3000/api/v1` is HTTP only for Expo Go local testing and must not be used in production (see `README` Environment).

## 5. Synchronization

- Push order: `Customers → Services → Orders → Payments → Status History` (dependency order), batch 50, per-record `synced/failed`, idempotent UUIDs, retry `2s/5s/15s`.
- Pull: incremental `since` cursor (`updated_at`/`created_at` > `since` shop-scoped), `nextCursor = max(updated_at)`.
- Conflicts: customers/services latest `updated_at` wins; orders conservative (never overwrite snapshots); payments/history append-only via `SUM` merge / `ON CONFLICT DO NOTHING`.
- Triggers: after login, foreground (throttled 30s), after mutation (manual `Sync Now` in Phase 10), connectivity returns (health check).

## 6. Data Retention

- **Active data:** Retained while your shop uses Clean, in both local DB and server DB (`storage/clean.sqlite` never auto-reset).
- **Deleted customers/services:** Soft-deleted (`is_deleted=1` + `updated_at`) tombstone retained to propagate to other devices; historical orders remain.
- **Payments/orders:** Never hard-deleted via sync (financial history append-only).
- **On logout:** Local business data **not** wiped (only `SecureStore` session cleared) — preserves offline `PENDING` until next login sync (as designed in `AuthContext logout`).
- **On account deletion request:** [OWNER PROCESS REQUIRED — e.g., contact `privacy@example.com`, manual DB purge within 30 days].

## 7. Security Measures

- Passwords hashed with `bcryptjs` (server `auth.routes.ts`), never plaintext, never logged.
- JWT signed with `JWT_SECRET` (32+ chars, `server/.env` → `JWT_SECRET`, `server/.env.example` placeholder; `server/src/config/env.ts` throws in production if `<16`, dev fallback only: `dev-clean-jwt-secret-change-me-32chars!!`).
- Shop scoping: every API (`customers`, `services`, `orders`, `payments`, `reports`, `sync`) uses `req.auth.shopId` derived from JWT, never trusts client `shop_id`.
- `SecureStore` for token, `expo-sqlite` WAL, no `EXPO_PUBLIC` secrets (only `EXPO_PUBLIC_API_BASE_URL` is client-visible and contains no secret).
- No `SQL`/`stack` exposure in `ErrorState` (user sees “Your local data is safe. Working offline.”).

## 8. Your Rights

You may request: access to your shop data, correction, export (future), or deletion (see 6). Contact `[OWNER EMAIL]`.

## 9. Children

Clean is a business tool for shop owners, not directed to children.

## 10. Changes

We will update this policy and the `Effective Date` when data handling changes; the `DEV_CHECKPOINT.md` version `0.1.0` reflects current behavior.

## 11. Contact

[OWNER INFORMATION REQUIRED]
- Legal Entity: [OWNER LEGAL NAME]
- Address: [OWNER ADDRESS]
- Email: [OWNER EMAIL]
- Phone: [OWNER PHONE]

---

## Appendix — Data Flow Checklist for Store Privacy Forms

**Data collected by Clean (and used):**
- Contact info (customer contact_number) — for order identification, shop-scoped, not shared, stored local+server, transmitted via TLS when syncing.
- User content (orders, payments, services, customer names) — for shop operations, stored local+server, shop-scoped.
- Identifiers (customer ID, order number, shop ID, user ID) — for record linking, shop-scoped.

**Data NOT collected / tracked:**
- Precise location — No
- Photos/camera — No
- Contacts (address book) — No (only manual contact you enter, not device contacts)
- Health, financial (card/bank), browsing, advertising — No
- Tracking across apps/websites — No (no Ad SDK, verified `package.json`)
- Analytics SDK — None (only Expo + SQLite)

**Data linked to user:** Customer contact/order data linked to shop owner account (shop-scoped), not to third parties.

**Data used for tracking:** No.
