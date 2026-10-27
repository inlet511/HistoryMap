<template>
  <div class="map-view">
    <header class="topbar">
      <div class="brand">
        <span class="title">中国历史地图变迁</span>
        <span class="year-display">{{ formatYear(timeline.currentYear) }}</span>
      </div>
      <div class="controls">
        <BaseMapSwitcher />
        <template v-if="auth.isAuthenticated">
          <n-dropdown :options="userMenu" @select="onUserMenu">
            <n-button quaternary size="small">{{ auth.user?.username }}</n-button>
          </n-dropdown>
        </template>
        <n-button v-else size="small" @click="$router.push('/login')">登录</n-button>
      </div>
    </header>
    <div class="main">
      <MapContainer
        :events="events"
        :wars="wars"
        :hovered-event-id="hoveredEventId"
        :factions-geo="factionsGeo"
        class="map"
      />
      <EventList
        :events="events"
        :loading="loading"
        :hovered-id="hoveredEventId"
        :range="range"
        class="panel"
        @hover="hoveredEventId = $event"
      />
    </div>
    <div class="timeline-wrap">
      <TimelineToolbar />
      <TimelineAxis class="timeline" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTimelineStore } from '@/stores/timeline';
import { useAuthStore } from '@/stores/auth';
import { eventsApi } from '@/api/events';
import { warsApi } from '@/api/wars';
import { factionsApi } from '@/api/factions';
import type { HistoryEvent, War } from '@/types';
import MapContainer from '@/components/MapView/MapContainer.vue';
import TimelineAxis from '@/components/Timeline/TimelineAxis.vue';
import TimelineToolbar from '@/components/Timeline/TimelineToolbar.vue';
import EventList from '@/components/EventPanel/EventList.vue';
import BaseMapSwitcher from '@/components/MapView/BaseMapSwitcher.vue';
import { NButton, NDropdown } from 'naive-ui';

const timeline = useTimelineStore();
const auth = useAuthStore();
const router = useRouter();

const events = ref<HistoryEvent[]>([]);
const wars = ref<War[]>([]);
const factionsGeo = ref<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
const loading = ref(false);
const hoveredEventId = ref<string | null>(null);
const range = 50;

const userMenu = [
  { label: '管理后台', key: 'admin' },
  { label: '退出登录', key: 'logout' },
];

function onUserMenu(key: string): void {
  if (key === 'admin') router.push('/admin');
  else if (key === 'logout') auth.logout().then(() => router.push('/'));
}

function formatYear(year: number): string {
  if (year < 0) return `公元前 ${-year} 年`;
  if (year === 0) return '公元元年';
  return `公元 ${year} 年`;
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const [evRes, warRes, facFc] = await Promise.all([
      eventsApi.nearYear(timeline.currentYear, range),
      warsApi.nearYear(timeline.currentYear, range),
      factionsApi.geometriesAtYear(timeline.currentYear),
    ]);
    events.value = evRes.items;
    wars.value = warRes.items;
    factionsGeo.value = facFc;
    console.log('[MapView] loaded year=', timeline.currentYear,
      'events=', events.value.length, 'wars=', wars.value.length,
      'factions=', facFc.features.length);
  } catch (e) {
    console.error('[MapView] Failed to load data', e);
    events.value = [];
    wars.value = [];
    factionsGeo.value = { type: 'FeatureCollection', features: [] };
  } finally {
    loading.value = false;
  }
}

// debounce so dragging the playhead doesn't spam the API (and trip 429 rate limit)
let loadTimer: number | undefined;
function scheduleLoad(): void {
  if (loadTimer !== undefined) clearTimeout(loadTimer);
  loadTimer = window.setTimeout(loadData, 250);
}

onMounted(loadData);
watch(() => timeline.currentYear, scheduleLoad);
</script>

<style scoped>
.map-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fafafa;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.year-display {
  font-size: 13px;
  color: #c0392b;
  font-weight: 500;
  background: #faf3f2;
  padding: 2px 8px;
  border-radius: 4px;
}
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.main {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 8px;
  padding: 8px;
}
.map {
  flex: 1;
  min-width: 0;
}
.panel {
  width: 340px;
  flex-shrink: 0;
}
.timeline-wrap {
  flex-shrink: 0;
  margin: 0 8px 8px;
}
.timeline {
  height: 188px;
  border-radius: 0 0 8px 8px;
}
</style>
