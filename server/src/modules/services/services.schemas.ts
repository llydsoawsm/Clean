import { z } from 'zod';

export const pricingTypeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => ['PER_KG', 'PER_PIECE', 'FIXED', 'PER_LOAD'].includes(v), {
    message: 'pricing_type must be PER_KG, PER_PIECE, FIXED, or PER_LOAD',
  })
  .transform((v) => v as 'PER_KG' | 'PER_PIECE' | 'FIXED' | 'PER_LOAD');

export const createServiceSchema = z.object({
  service_name: z.string().trim().min(1, 'Service name is required').max(100),
  pricing_type: pricingTypeSchema,
  price: z.number().min(0, 'Price must be >= 0').max(1000000, 'Price too large'),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  weight_block_grams: z.number().int().min(1000).max(50000).optional().nullable(),
  weight_block_kg: z.number().min(1).max(50).optional().nullable(),
});

export const updateServiceSchema = z.object({
  service_name: z.string().trim().min(1).max(100).optional(),
  pricing_type: pricingTypeSchema.optional(),
  price: z.number().min(0).max(1000000).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  weight_block_grams: z.number().int().min(1000).max(50000).optional().nullable(),
  weight_block_kg: z.number().min(1).max(50).optional().nullable(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
