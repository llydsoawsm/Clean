import type { PricingType, ServiceRow } from '@/db/types';

export interface LocalService {
  id: string;
  name: string;
  pricing_type: PricingType;
  unit_price_centavos: number;
  min_charge_centavos?: number;
  weight_block_grams?: number;
  description?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

let services: LocalService[] = [
  {
    id: 's1',
    name: 'Wash & Fold',
    pricing_type: 'per_kg',
    unit_price_centavos: 3500,
    min_charge_centavos: 10000,
    description: 'Everyday laundry, folded neatly',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's2',
    name: 'Dry Cleaning',
    pricing_type: 'per_piece',
    unit_price_centavos: 15000,
    min_charge_centavos: 15000,
    description: 'Delicate garments, pressed on hanger',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's3',
    name: 'Bedding & Comforter',
    pricing_type: 'per_load',
    unit_price_centavos: 18000,
    weight_block_grams: 8000,
    description: 'Up to 8kg per load',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's4',
    name: 'Shoe Wash',
    pricing_type: 'per_piece',
    unit_price_centavos: 12000,
    min_charge_centavos: 12000,
    description: 'Deep cleaning and deodorizing',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const serviceStore = {
  getAll(): LocalService[] {
    return [...services];
  },

  getActive(): LocalService[] {
    return services.filter((s) => s.is_active === 1);
  },

  getById(id: string): LocalService | undefined {
    return services.find((s) => s.id === id);
  },

  create(input: {
    name: string;
    pricing_type: PricingType;
    unit_price_centavos: number;
    min_charge_centavos?: number;
    weight_block_grams?: number;
    description?: string;
  }): LocalService {
    const newService: LocalService = {
      id: `srv-${Date.now()}`,
      name: input.name,
      pricing_type: input.pricing_type,
      unit_price_centavos: input.unit_price_centavos,
      min_charge_centavos: input.min_charge_centavos,
      weight_block_grams: input.weight_block_grams,
      description: input.description,
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    services = [newService, ...services];
    notify();
    return newService;
  },

  update(id: string, partial: Partial<LocalService>): void {
    services = services.map((s) =>
      s.id === id
        ? {
            ...s,
            ...partial,
            updated_at: new Date().toISOString(),
          }
        : s
    );
    notify();
  },

  delete(id: string): void {
    services = services.filter((s) => s.id !== id);
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
