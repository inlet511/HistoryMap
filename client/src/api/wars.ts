import { api } from './client';
import type { War } from '@/types';

export const warsApi = {
  list: () => api.get<{ items: War[] }>('/wars'),
  atYear: (year: number) =>
    api.get<{ year: number; items: War[] }>(`/wars/at/${year}`),
  nearYear: (year: number, range = 50) =>
    api.get<{ year: number; items: War[] }>(`/wars/near/${year}`, { params: { range } }),
  getById: (id: string) => api.get<War>(`/wars/${id}`),
  create: (input: Partial<War> & { year: number; year_label: string; name: string }) =>
    api.post<War>('/wars', input),
  update: (id: string, input: Partial<War>) =>
    api.put<War>(`/wars/${id}`, input),
  remove: (id: string) => api.del(`/wars/${id}`),
};
