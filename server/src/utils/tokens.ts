import { createHash, randomBytes } from 'node:crypto';

/** Generate an opaque refresh token (URL-safe, 48 bytes). */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Hash a refresh token before storing server-side (never store plaintext). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
