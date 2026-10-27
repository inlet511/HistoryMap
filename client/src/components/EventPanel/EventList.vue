<template>
  <div class="event-list">
    <div class="header">
      <span>历史事件</span>
      <span class="year">{{ formatYear(timeline.currentYear) }} ±{{ range }}年</span>
    </div>
    <div class="items">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="events.length === 0" class="empty">该时段暂无事件数据</div>
      <div
        v-for="e in events"
        :key="e.id"
        class="item"
        :class="{ active: e.id === hoveredId }"
        @mouseenter="emit('hover', e.id)"
        @mouseleave="emit('hover', null)"
      >
        <div class="year-badge" :style="{ background: typeColor(e.type) }">
          {{ e.year_label }}
        </div>
        <div class="content">
          <div class="title">{{ e.title }}</div>
          <div v-if="e.location_label" class="location">📍 {{ e.location_label }}</div>
          <div v-if="e.description" class="desc">{{ e.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTimelineStore } from '@/stores/timeline';
import type { HistoryEvent } from '@/types';

defineProps<{
  events: HistoryEvent[];
  loading: boolean;
  hoveredId: string | null;
  range: number;
}>();
const emit = defineEmits<{ (e: 'hover', id: string | null): void }>();

const timeline = useTimelineStore();

function formatYear(year: number): string {
  if (year < 0) return `前${-year}年`;
  if (year === 0) return '元年';
  return `${year}年`;
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    battle: '#c0392b',
    reform: '#2980b9',
    founding: '#27ae60',
    fall: '#7f8c8d',
    treaty: '#8e44ad',
    event: '#f39c12',
  };
  return map[type] || '#f39c12';
}
</script>

<style scoped>
.event-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
  font-weight: 500;
  font-size: 14px;
}
.header .year {
  font-size: 12px;
  color: #888;
}
.items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.empty {
  text-align: center;
  color: #888;
  padding: 24px 0;
  font-size: 13px;
}
.item {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.item:hover,
.item.active {
  background: #faf3f2;
}
.year-badge {
  flex-shrink: 0;
  width: 60px;
  padding: 3px 0;
  text-align: center;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  align-self: flex-start;
}
.content {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}
.location {
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
}
.desc {
  font-size: 11px;
  color: #666;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
