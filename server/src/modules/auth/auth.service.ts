import { env } from '@config/env';
import { ConflictError, UnauthorizedError } from '@utils/errors';
import { hashPassword, verifyPassword } from '@utils/password';
import { signAccessToken, verifyAccessToken } from '@utils/jwt';
import { generateRefreshToken, hashToken } from '@utils/tokens';
import * as repo from './auth.repository';
import type { AuthUser, LoginInput, RegisterInput, UserRole } from './auth.types';

export interface IssueTokensContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function parseDurationToSeconds(s: string, fallback: number): number {
  const m = s.match(/^(\d+)([smhd])$/);
  if (!m) return fallback;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * mult;
}

function refreshTokenExpiry(): Date {
  return new Date(
    Date.now() + parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN, 7 * 86400) * 1000,
  );
}

export async function register(
  input: RegisterInput,
  ctx?: IssueTokensContext,
): Promise<AuthResult> {
  const byEmail = await repo.findUserByEmail(input.email);
  if (byEmail) throw new ConflictError('Email already registered');
  const byUsername = await repo.findUserByUsername(input.username);
  if (byUsername) throw new ConflictError('Username already taken');

  const hash = await hashPassword(input.password);
  const user = await repo.createUser(
    input.email,
    input.username,
    hash,
    'user' as UserRole,
    input.displayName,
  );
  return issueTokens(user, ctx);
}

export async function login(
  input: LoginInput,
  ctx?: IssueTokensContext,
): Promise<AuthResult> {
  const userRow = await repo.findUserByEmail(input.email);
  if (!userRow) throw new UnauthorizedError('Invalid credentials');
  if (!userRow.is_active) throw new UnauthorizedError('Account disabled');
  const ok = await verifyPassword(input.password, userRow.password_hash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');

  await repo.updateLastLogin(userRow.id);
  return issueTokens(repo.toAuthUser(userRow), ctx);
}

export async function refresh(
  refreshToken: string,
  ctx?: IssueTokensContext,
): Promise<AuthResult> {
  const tokenHash = hashToken(refreshToken);
  const row = await repo.findRefreshToken(tokenHash);
  if (!row) throw new UnauthorizedError('Invalid refresh token');
  if (row.revoked_at) throw new UnauthorizedError('Refresh token revoked');
  if (row.expires_at < new Date()) throw new UnauthorizedError('Refresh token expired');

  const user = await repo.getUserById(row.user_id);
  if (!user) throw new UnauthorizedError('User not found');

  // Rotate: revoke old, issue fresh pair
  await repo.revokeRefreshToken(row.id);
  return issueTokens(user, ctx);
}

export async function logout(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  const row = await repo.findRefreshToken(tokenHash);
  if (row && !row.revoked_at) {
    await repo.revokeRefreshToken(row.id);
  }
}

export async function getUserFromAccessToken(
  accessToken: string,
): Promise<AuthUser> {
  const payload = verifyAccessToken(accessToken);
  const user = await repo.getUserById(payload.userId);
  if (!user) throw new UnauthorizedError('User not found');
  return user;
}

async function issueTokens(
  user: AuthUser,
  ctx?: IssueTokensContext,
): Promise<AuthResult> {
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    username: user.username,
  });
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = refreshTokenExpiry();
  await repo.saveRefreshToken(
    user.id,
    hashToken(refreshToken),
    refreshExpiresAt,
    ctx?.userAgent,
    ctx?.ip,
  );
  return { user, accessToken, refreshToken, refreshExpiresAt };
}
