import { z } from 'zod';

export const updateUserSchema = z
  .object({
    fullName: z.string().min(2).max(100).optional(),
    phone: z.string().min(5).max(30).optional(),
    password: z.string().min(8).max(128).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });