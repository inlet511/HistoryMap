import type { ApiError } from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// access token in memory + sessionStorage fallback (short-lived, 15min)
let accessToken: string | null = sessionStorage.getItem('access_token');

function setToken(token: string): void {
  accessToken = token;
  sessionStorage.setItem('access_token', token);
}

function clearToken(): void {
  accessToken = null;
  sessionStorage.removeItem('access_token');
}

function getToken(): string | null {
  return accessToken;
}

// In-flight refresh promise — deduplicates concurrent 401 retries
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // send HttpOnly refresh cookie
    });
    if (!res.ok) {
      clearToken();
      return false;
    }
    const data = (await res.json()) as { accessToken: string };
    setToken(data.accessToken);
    return true;
  } catch {
    clearToken();
    return false;
  }
}

function toError(data: unknown, status: number): Error & { code?: string; status?: number; details?: unknown } {
  const e = data as Partial<ApiError> | { message?: string };
  const message = e.message || `Request failed (${status})`;
  const err = Object.assign(new Error(message), {
    code: (e as Partial<ApiError>).code,
    status,
    details: (e as Partial<ApiError>).details,
  });
  return err;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRefresh?: boolean;
  signal?: AbortSignal;
  /** Expected empty 204 — return null instead of parsing JSON. */
  allowEmpty?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, skipAuthRefresh, signal, allowEmpty } = opts;

  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal,
    });
  } catch {
    throw new Error('网络错误，请检查连接');
  }

  // 401 → attempt one refresh, then retry (4xx otherwise don't retry)
  if (res.status === 401 && !skipAuthRefresh) {
    if (!refreshing) {
      refreshing = refreshTokens().finally(() => {
        refreshing = null;
      });
    }
    const ok = await refreshing;
    if (ok) {
      return request<T>(path, { ...opts, skipAuthRefresh: true });
    }
    throw new Error('会话已过期，请重新登录');
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    throw toError(data, res.status);
  }

  if (allowEmpty && (res.status === 204 || data === null)) {
    return null as T;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE', allowEmpty: true }),
};

export { setToken, clearToken, getToken };
