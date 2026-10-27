import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 chars')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, digits, underscore'),
  password: z.string().min(6, 'Password must be at least 6 chars').max(100),
  displayName: z.string().max(50).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = 'reader' | 'user' | 'editor' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  displayName?: string | null;
}
