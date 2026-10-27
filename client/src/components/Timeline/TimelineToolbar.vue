<template>
  <div class="timeline-toolbar">
    <div class="group">
      <span class="lbl lbl-start">起点</span>
      <NSelect
        :value="startDynastyId"
        :options="dynastyOptions"
        size="tiny"
        placeholder="选朝代"
        :consistent-menu-width="false"
        style="width: 140px"
        @update:value="onStartDynasty"
      />
      <NInputNumber
        :value="timeline.selectionStart"
        size="tiny"
        :step="1"
        style="width: 100px"
        @update:value="(v) => timeline.setSelectionStart(v ?? 0)"
  />
    </div>

    <div class="group">
      <span class="lbl lbl-end">终点</span>
      <NSelect
        :value="endDynastyId"
        :options="dynastyOptions"
        size="tiny"
        placeholder="选朝代"
        :consistent-menu-width="false"
        style="width: 140px"
        @update:value="onEndDynasty"
      />
      <NInputNumber
        :value="timeline.selectionEnd"
        size="tiny"
        :step="1"
        style="width: 100px"
        @update:value="(v) => timeline.setSelectionEnd(v ?? 0)"
  />
    </div>

    <div class="group zoom">
      <NButton size="tiny" @click="zoomOut" title="缩小">−</NButton>
      <span class="zoom-val">{{ Math.round(timeline.timelineZoom * 100) }}%</span>
      <NButton size="tiny" @click="zoomIn" title="放大">+</NButton>
      <NButton size="tiny" quaternary @click="reset" title="重置缩放">重置</NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { NSelect, NInputNumber, NButton } from 'naive-ui';
import { useTimelineStore } from '@/stores/timeline';
import { dynastiesApi } from '@/api/dynasties';
import type { Dynasty } from '@/types';

const timeline = useTimelineStore();
const dynasties = ref<Dynasty[]>([]);
const startDynastyId = ref<string | null>(null);
const endDynastyId = ref<string | null>(null);

function parentName(pid: string): string {
  return dynasties.value.find((x) => x.id === pid)?.name ?? '';
}

const dynastyOptions = computed(() =>
  dynasties.value.map((d) => ({
    label: d.parent_id ? `${parentName(d.parent_id)} · ${d.name}` : d.name,
    value: d.id,
  })),
);

function onStartDynasty(id: string | null): void {
  if (!id) return;
  startDynastyId.value = id;
  const d = dynasties.value.find((x) => x.id === id);
  if (d) timeline.setSelectionStart(d.start_year);
}

function onEndDynasty(id: string | null): void {
  if (!id) return;
  endDynastyId.value = id;
  const d = dynasties.value.find((x) => x.id === id);
  if (d) timeline.setSelectionEnd(d.end_year);
}

function zoomIn(): void {
  timeline.setTimelineZoom(timeline.timelineZoom * 1.4);
}
function zoomOut(): void {
  timeline.setTimelineZoom(timeline.timelineZoom / 1.4);
}
function reset(): void {
  timeline.setTimelineZoom(1);
}

onMounted(async () => {
  try {
    const res = await dynastiesApi.list();
    dynasties.value = res.items;
  } catch (e) {
    console.error('Failed to load dynasties for toolbar', e);
  }
});
</script>

<style scoped>
.timeline-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px 8px 0 0;
  border-bottom: none;
  flex-wrap: wrap;
}
.group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lbl {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  color: #fff;
}
.lbl-start {
  background: #2980b9;
}
.lbl-end {
  background: #27ae60;
}
.zoom {
  margin-left: auto;
}
.zoom-val {
  font-size: 11px;
  color: #666;
  min-width: 38px;
  text-align: center;
}
</style>
