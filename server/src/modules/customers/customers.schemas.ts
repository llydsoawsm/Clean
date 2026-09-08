import { z } from 'zod';

const contactRegex = /^[0-9+\-\s()]{7,20}$/;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(100, 'Name too long'),
  contact_number: z
    .string()
    .trim()
    .min(7, 'Contact number is too short')
    .max(20, 'Contact number too long')
    .regex(contactRegex, 'Invalid contact number format'),
  address: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(100).optional(),
  contact_number: z.string().trim().regex(contactRegex, 'Invalid contact number format').optional(),
  address: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
