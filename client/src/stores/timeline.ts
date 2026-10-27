import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BaseMapStyle } from '@/types';

/**
 * Timeline / map view state shared across components.
 *
 * Three time anchors:
 *  - currentYear     : the playhead (single moment shown on the map)
 *  - selectionStart   : video-clip-style "in"  point
 *  - selectionEnd     : video-clip-style "out" point
 *
 * The map renders data for currentYear; the timeline highlights the
 * [selectionStart, selectionEnd] range so the user can frame a period.
 */
export const useTimelineStore = defineStore('timeline', () => {
  // Default playhead at 战国中期 (350 BCE) — shows all 七雄 + 越, no overlap with 春秋
  const currentYear = ref(-350);

  // Default selection spanning 春秋→秦 (a visually rich slice)
  const selectionStart = ref(-770);
  const selectionEnd = ref(-206);

  const selectedFactionId = ref<string | null>(null);
  const baseMap = ref<BaseMapStyle>('admin');
  const mapCenter = ref<[number, number]>([104, 35]);
  const mapZoom = ref(3.2);

  // zoom level of the timeline itself (1 = full history fits the viewport)
  const timelineZoom = ref(1);

  const selectionSpan = computed(() => selectionEnd.value - selectionStart.value);

  function clampYear(year: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, year));
  }

  function setYear(year: number): void {
    currentYear.value = year;
  }

  function setSelection(start: number, end: number): void {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    selectionStart.value = s;
    selectionEnd.value = e;
  }

  function setSelectionStart(year: number): void {
    // never cross the out point
    selectionStart.value = Math.min(year, selectionEnd.value);
  }

  function setSelectionEnd(year: number): void {
    selectionEnd.value = Math.max(year, selectionStart.value);
  }

  /** Move both anchors together (pan the selection window). */
  function panSelection(deltaYears: number): void {
    selectionStart.value += deltaYears;
    selectionEnd.value += deltaYears;
  }

  function selectFaction(id: string | null): void {
    selectedFactionId.value = id;
  }

  function setBaseMap(style: BaseMapStyle): void {
    baseMap.value = style;
  }

  function setView(center: [number, number], zoom: number): void {
    mapCenter.value = center;
    mapZoom.value = zoom;
  }

  function setTimelineZoom(k: number): void {
    timelineZoom.value = Math.max(1, Math.min(60, k));
  }

  return {
    // state
    currentYear,
    selectionStart,
    selectionEnd,
    selectionSpan,
    selectedFactionId,
    baseMap,
    mapCenter,
    mapZoom,
    timelineZoom,
    // actions
    clampYear,
    setYear,
    setSelection,
    setSelectionStart,
    setSelectionEnd,
    panSelection,
    selectFaction,
    setBaseMap,
    setView,
    setTimelineZoom,
  };
});
