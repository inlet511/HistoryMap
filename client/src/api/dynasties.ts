import { api } from './client';
import type { Dynasty } from '@/types';

export const dynastiesApi = {
  list: () => api.get<{ items: Dynasty[] }>('/dynasties'),
  atYear: (year: number) =>
    api.get<{ year: number; items: Dynasty[] }>(`/dynasties/at/${year}`),
  getById: (id: string) => api.get<Dynasty>(`/dynasties/${id}`),
  create: (input: Partial<Dynasty> & { id: string; name: string; start_year: number; end_year: number; color: string }) =>
    api.post<Dynasty>('/dynasties', input),
  update: (id: string, input: Partial<Dynasty>) =>
    api.put<Dynasty>(`/dynasties/${id}`, input),
  remove: (id: string) => api.del(`/dynasties/${id}`),
};
