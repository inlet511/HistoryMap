<template>
  <n-button-group size="small">
    <n-button
      v-for="opt in options"
      :key="opt.value"
      :type="timeline.baseMap === opt.value ? 'primary' : 'default'"
      @click="timeline.setBaseMap(opt.value)"
    >
      {{ opt.label }}
    </n-button>
  </n-button-group>
</template>

<script setup lang="ts">
import { useTimelineStore } from '@/stores/timeline';
import { NButtonGroup, NButton } from 'naive-ui';
import type { BaseMapStyle } from '@/types';

const timeline = useTimelineStore();

const options: { label: string; value: BaseMapStyle }[] = [
  { label: '行政', value: 'admin' },
  { label: '卫星', value: 'satellite' },
  { label: '地形', value: 'terrain' },
  { label: '无', value: 'none' },
];
</script>
