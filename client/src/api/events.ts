import { api } from './client';
import type { HistoryEvent } from '@/types';

export const eventsApi = {
  list: () => api.get<{ items: HistoryEvent[] }>('/events'),
  nearYear: (year: number, range = 50) =>
    api.get<{ year: number; items: HistoryEvent[] }>(`/events/near/${year}`, { params: { range } }),
  atYear: (year: number) =>
    api.get<{ year: number; items: HistoryEvent[] }>(`/events/at/${year}`),
  getById: (id: string) => api.get<HistoryEvent>(`/events/${id}`),
  create: (input: Partial<HistoryEvent> & { year: number; year_label: string; title: string }) =>
    api.post<HistoryEvent>('/events', input),
  update: (id: string, input: Partial<HistoryEvent>) =>
    api.put<HistoryEvent>(`/events/${id}`, input),
  remove: (id: string) => api.del(`/events/${id}`),
};
