import type { CustomerRow } from '@/db/types';

export interface CustomerItem {
  id: string;
  shop_id: string;
  name: string;
  contact_number?: string;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

let customersList: CustomerItem[] = [
  {
    id: 'c1',
    shop_id: 'shop-1',
    name: 'Maria Santos',
    contact_number: '0917-123-4567',
    address: 'Block 4, Lot 12, Sunrise Village',
    notes: 'Prefers mild detergent',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'SYNCED',
  },
  {
    id: 'c2',
    shop_id: 'shop-1',
    name: 'Juan Dela Cruz',
    contact_number: '0918-987-6543',
    address: '124 Rizal Ave, Barangay 5',
    notes: 'Weekly drop-off regular',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'SYNCED',
  },
  {
    id: 'c3',
    shop_id: 'shop-1',
    name: 'Ana Reyes',
    contact_number: '0922-333-4444',
    address: 'Unit 302, Green Residences',
    notes: 'Call upon arrival for pickup',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'SYNCED',
  },
  {
    id: 'c4',
    shop_id: 'shop-1',
    name: 'Carlos Gomez',
    contact_number: '0919-555-6677',
    address: '77 Mabini St',
    notes: 'Rush wash regular',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'SYNCED',
  },
];

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const customerStore = {
  getAll(): CustomerItem[] {
    return [...customersList];
  },

  getById(id: string): CustomerItem | undefined {
    return customersList.find((c) => c.id === id);
  },

  search(query: string): CustomerItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...customersList];
    return customersList.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.contact_number ? c.contact_number.includes(q) : false)
    );
  },

  add(input: { name: string; contact_number?: string; address?: string; notes?: string }): CustomerItem {
    const newCust: CustomerItem = {
      id: `c${Date.now()}`,
      shop_id: 'shop-1',
      name: input.name.trim(),
      contact_number: input.contact_number?.trim() || '',
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'PENDING',
    };
    customersList = [newCust, ...customersList];
    notify();
    return newCust;
  },

  update(id: string, updates: Partial<CustomerItem>): void {
    customersList = customersList.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
    notify();
  },

  delete(id: string): void {
    customersList = customersList.filter((c) => c.id !== id);
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
