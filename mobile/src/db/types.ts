/**
 * Clean Local DB Types
 * Defines sync status and shared row shapes.
 * Money stored as integer centavos. Weight as grams (int).
 */

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export type PricingType = 'per_kg' | 'per_piece' | 'fixed' | 'per_load';
export type OrderStatus = 'RECEIVED' | 'PROCESSING' | 'READY' | 'COMPLETED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface ShopRow {
  id: string;
  name: string;
  owner_name: string | null;
  contact_number: string | null;
  address: string | null;
  currency: string;
  rush_fee_centavos: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  last_synced_at: string | null;
}

export interface CustomerRow {
  id: string;
  shop_id: string | null;
  name: string;
  contact_number: string;
  address: string | null;
  notes: string | null;
  first_transaction_at: string | null;
  last_visit_at: string | null;
  transaction_count: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  is_deleted: number; // 0/1
}

export interface ServiceRow {
  id: string;
  shop_id: string | null;
  name: string;
  pricing_type: PricingType;
  unit_price_centavos: number;
  description: string | null;
  weight_block_grams: number | null; // for per_load: e.g., 8000
  is_active: number; // 0/1
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  is_deleted: number;
}

export interface OrderRow {
  id: string;
  shop_id: string | null;
  customer_id: string;
  service_id: string;
  order_number: string;
  pricing_type_snapshot: PricingType;
  service_name_snapshot: string;
  unit_price_snapshot_centavos: number;
  weight_block_grams_snapshot: number | null; // for per_load: e.g., 8000
  customer_name_snapshot: string | null;
  weight_grams: number | null;
  quantity: number | null;
  base_cost_centavos: number;
  additional_fee_centavos: number;
  rush_fee_centavos: number;
  is_rush: number; // 0/1
  total_centavos: number;
  amount_paid_centavos: number;
  balance_centavos: number;
  payment_status: PaymentStatus;
  status: OrderStatus;
  notes: string | null;
  estimated_ready_at: string | null;
  received_at: string;
  processing_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  is_deleted: number;
}

export type PaymentMethod = 'CASH' | 'GCASH' | 'OTHER';

export interface PaymentRow {
  id: string;
  order_id: string;
  shop_id: string | null;
  amount_centavos: number;
  method: string; // 'cash' legacy, 'CASH'/'GCASH'/'OTHER'
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  is_deleted: number;
}

export interface StatusHistoryRow {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_at: string;
  changed_by: string | null;
  sync_status: SyncStatus;
  is_deleted: number;
}

export const SYNC_STATUSES: SyncStatus[] = ['PENDING', 'SYNCING', 'SYNCED', 'FAILED'];
