import { api } from './client';
import type { AuthResponse, User } from '@/types';

export const authApi = {
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) => api.post<AuthResponse>('/auth/register', input),

  login: (input: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', input),

  refresh: () =>
    api.post<AuthResponse>('/auth/refresh', undefined, { skipAuthRefresh: true }),

  logout: () => api.post<{ message: string }>('/auth/logout'),

  me: () => api.get<{ user: User | null }>('/auth/me'),
};
