import { query } from '@db/pool';
import type { AuthUser, UserRole } from './auth.types';

interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string | null;
  is_active: boolean;
}

function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    displayName: u.display_name,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    'SELECT id, email, username, password_hash, role, display_name, is_active FROM users WHERE email = $1',
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserByUsername(
  username: string,
): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    'SELECT id, email, username, password_hash, role, display_name, is_active FROM users WHERE username = $1',
    [username],
  );
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  username: string,
  passwordHash: string,
  role: UserRole,
  displayName?: string | null,
): Promise<AuthUser> {
  const rows = await query<{
    id: string;
    email: string;
    username: string;
    role: UserRole;
    display_name: string | null;
  }>(
    `INSERT INTO users (email, username, password_hash, role, display_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, username, role, display_name`,
    [email, username, passwordHash, role, displayName ?? null],
  );
  const u = rows[0];
  return { id: u.id, email: u.email, username: u.username, role: u.role, displayName: u.display_name };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const rows = await query<{
    id: string;
    email: string;
    username: string;
    role: UserRole;
    display_name: string | null;
  }>(
    'SELECT id, email, username, role, display_name FROM users WHERE id = $1 AND is_active = TRUE',
    [userId],
  );
  if (rows.length === 0) return null;
  const u = rows[0];
  return { id: u.id, email: u.email, username: u.username, role: u.role, displayName: u.display_name };
}

export async function updateLastLogin(userId: string): Promise<void> {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
}

// -------- refresh tokens --------

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export async function saveRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  userAgent?: string | null,
  ip?: string | null,
): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent ?? null, ip ?? null],
  );
}

export async function findRefreshToken(
  tokenHash: string,
): Promise<RefreshTokenRow | null> {
  const rows = await query<RefreshTokenRow>(
    'SELECT id, user_id, token_hash, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [id]);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
}

export { toAuthUser };
