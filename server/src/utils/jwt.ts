import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '@config/env';
import { UnauthorizedError } from '@utils/errors';

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  role: string;
  username: string;
}

export function signAccessToken(payload: {
  userId: string;
  role: string;
  username: string;
}): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    return decoded as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
