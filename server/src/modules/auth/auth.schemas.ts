import { z } from 'zod';

export const registerSchema = z.object({
  shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(100),
  ownerName: z.string().trim().min(2, 'Owner name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
