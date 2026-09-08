import { z } from 'zod';

export const createOrderSchema = z.object({
  customer_id: z.string().trim().min(1, 'customer_id is required'),
  service_id: z.string().trim().min(1, 'service_id is required'),
  weight_kg: z.number().min(0).max(1000).optional().nullable(),
  weight_grams: z.number().int().min(0).max(1000000).optional().nullable(),
  quantity: z.number().int().min(1).max(9999).optional().nullable(),
  additional_fee: z.number().min(0).max(100000).optional().default(0),
  additional_fee_centavos: z.number().int().min(0).optional(),
  rush_fee: z.number().min(0).max(100000).optional().default(0),
  rush_fee_centavos: z.number().int().min(0).optional(),
  is_rush: z.boolean().optional().default(false),
  amount_paid: z.number().min(0).max(1000000).optional().default(0),
  amount_paid_centavos: z.number().int().min(0).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
