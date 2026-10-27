<template>
  <div class="timeline-axis">
    <div ref="svgHost" class="svg-host"></div>
    <div class="year-label">{{ yearLabel }}</div>
    <div class="selection-label">{{ selectionLabel }}</div>
    <div class="hint">滚轮缩放 · 拖动起止手柄框选(松开自动聚焦) · 拖动红线移动 · 点击朝代跳播放头</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { useTimelineStore } from '@/stores/timeline';
import { dynastiesApi } from '@/api/dynasties';
import type { Dynasty } from '@/types';

const timeline = useTimelineStore();
const svgHost = ref<HTMLDivElement>();
const yearLabel = ref('');
const selectionLabel = ref('');

// module-level render state (persist across re-renders triggered by zoom)
let dynasties: Dynasty[] = [];
let svgSel: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let mainG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
let zoomTransform: d3.ZoomTransform | null = null;
let baseX: d3.ScaleLinear<number, number> | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;
let suppressZoomSync = false;
let suppressSelectionZoom = false;
let hasInitialFit = false;
let lastSize: { w: number; h: number } = { w: 0, h: 0 };

const PAD_L = 56;
const PAD_R = 18;

// layout constants
const MAIN_BAR_H = 20;          // main axis (dynastic succession)
const PAR_BAR_H = 14;           // parallel factions layer
const PAR_BAR_GAP = 2;
const CALLOUT_ROW_H = 11;
const CALLOUT_MAX_ROWS = 2;
const MAX_PAR_LANES = 4;
const CALLOUT_TOP_Y = 4;
const AXIS_BOTTOM_PAD = 14;

function formatYear(year: number): string {
  if (year < 0) return `公元前 ${-year} 年`;
  if (year === 0) return '公元元年';
  return `公元 ${year} 年`;
}

function measure(text: string, size: number): number {
  if (!measureCtx) return text.length * size * 0.6;
  measureCtx.font = `${size}px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif`;
  return measureCtx.measureText(text).width;
}

/** Pick readable text colour against a dynasty's background colour. */
function textColorFor(bg: string): string {
  const hex = bg.replace('#', '');
  if (hex.length < 6) return '#fff';
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 170 ? '#1a1a1a' : '#fff';
}

function currentX(): d3.ScaleLinear<number, number> {
  if (!baseX) throw new Error('baseX not initialized');
  return zoomTransform ? zoomTransform.rescaleX(baseX) : baseX;
}

function snapYear(year: number, x: d3.ScaleLinear<number, number>): number {
  const boundaries = new Set<number>();
  for (const d of dynasties) {
    boundaries.add(d.start_year);
    boundaries.add(d.end_year);
  }
  let best = year;
  let bestDist = Infinity;
  for (const b of boundaries) {
    const dist = Math.abs(x(b) - x(year));
    if (dist < bestDist) {
      bestDist = dist;
      best = b;
    }
  }
  return bestDist < 6 ? best : year;
}

function niceStep(raw: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  let chosen = steps[steps.length - 1];
  for (const st of steps) {
    if (st >= raw) {
      chosen = st;
      break;
    }
  }
  return chosen;
}

/** Greedy lane assignment for parallel factions (sub-dynasties). */
function assignLanes(items: Dynasty[]): Map<Dynasty, number> {
  const sorted = [...items].sort((a, b) => a.start_year - b.start_year);
  const laneEnds: number[] = [];
  const result = new Map<Dynasty, number>();
  for (const d of sorted) {
    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      // boundary-touching (prev.end == this.start) is allowed on the same lane
      if (laneEnds[i] <= d.start_year) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(d.end_year);
    } else {
      laneEnds[lane] = d.end_year;
    }
    result.set(d, Math.min(lane, MAX_PAR_LANES - 1));
  }
  return result;
}

function maxLane(lanes: Map<Dynasty, number>): number {
  let m = 0;
  for (const v of lanes.values()) if (v > m) m = v;
  return m;
}

/** Zoom the timeline so [selectionStart, selectionEnd] fills the whole width. */
function zoomToSelection(): void {
  if (!svgSel || !zoomBehavior || !baseX) return;
  const selStart = timeline.selectionStart;
  const selEnd = timeline.selectionEnd;
  if (selEnd - selStart < 1) return;
  const range = baseX.range();
  const baseW = range[1] - range[0];
  const bs = baseX(selStart);
  const be = baseX(selEnd);
  if (be - bs < 1) return;
  let k = baseW / (be - bs);
  k = Math.max(1, Math.min(60, k));
  const tx = range[0] - bs * k;
  const t = d3.zoomIdentity.translate(tx, 0).scale(k);
  svgSel.call(zoomBehavior.transform, t);
}

function build(width: number, height: number): void {
  const host = svgHost.value;
  if (!host) return;
  d3.select(host).selectAll('*').remove();
  svgSel = d3
    .select(host)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('display', 'block');

  mainG = svgSel.append('g').attr('class', 'main');

  zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 60])
    .filter((event) => {
      if (event.type === 'wheel') return true;
      const t = event.target as Element | null;
      if (!t) return true;
      return !t.closest('.handle-start, .handle-end, .playhead');
    })
    .on('zoom', (event) => {
      zoomTransform = event.transform;
      suppressZoomSync = true;
      timeline.setTimelineZoom(event.transform.k);
      suppressZoomSync = false;
      draw(width, height);
    });
  svgSel.call(zoomBehavior);
  if (zoomTransform) {
    svgSel.call(zoomBehavior.transform, zoomTransform);
  }
}

interface PlacedCallout {
  d: Dynasty;
  cx: number;
  lw: number;
  row: number;
  dotY: number;
  side: 'top' | 'bottom';
}

function layoutCallouts(
  items: Dynasty[],
  dotYFor: (d: Dynasty) => number,
  x: d3.ScaleLinear<number, number>,
  side: 'top' | 'bottom',
  calloutStartY: number,
  calloutEndY: number,
  maxRowsLimit = CALLOUT_MAX_ROWS,
): void {
  if (items.length === 0 || !mainG) return;
  const availH = calloutEndY - calloutStartY;
  const maxRows = Math.min(maxRowsLimit, Math.max(1, Math.floor(availH / CALLOUT_ROW_H)));

  const rows: Array<Array<[number, number]>> = [];
  const sorted = items
    .map((d) => ({
      d,
      cx: (x(d.start_year) + x(d.end_year)) / 2,
      lw: measure(d.name, 9) + 8,
      dotY: dotYFor(d),
    }))
    .sort((a, b) => a.cx - b.cx);

  const placed: PlacedCallout[] = [];
  for (const it of sorted) {
    let row = 0;
    for (; row < rows.length; row++) {
      const intervals = rows[row];
      const x1 = it.cx - it.lw / 2;
      const x2 = it.cx + it.lw / 2;
      const overlaps = intervals.some(([a, b]) => !(x2 < a - 2 || x1 > b + 2));
      if (!overlaps) break;
    }
    if (row >= maxRows) row = maxRows - 1;
    if (!rows[row]) rows[row] = [];
    rows[row].push([it.cx - it.lw / 2, it.cx + it.lw / 2]);
    placed.push({ d: it.d, cx: it.cx, lw: it.lw, row, dotY: it.dotY, side });
  }

  const cg = mainG.append('g').attr('class', `callout callout-${side}`);
  for (const p of placed) {
    const labelCenter =
      side === 'top'
        ? calloutStartY + p.row * CALLOUT_ROW_H + CALLOUT_ROW_H / 2
        : calloutStartY + p.row * CALLOUT_ROW_H + CALLOUT_ROW_H / 2;
    cg.append('circle').attr('cx', p.cx).attr('cy', p.dotY).attr('r', 2.4).attr('fill', p.d.color);
    cg.append('line')
      .attr('x1', p.cx)
      .attr('y1', p.dotY)
      .attr('x2', p.cx)
      .attr('y2', side === 'top' ? labelCenter + 4 : labelCenter - 4)
      .attr('stroke', p.d.color)
      .attr('stroke-width', 0.7)
      .attr('opacity', 0.5);
    const pillW = p.lw;
    const pillH = 10;
    cg.append('rect')
      .attr('x', p.cx - pillW / 2)
      .attr('y', labelCenter - pillH / 2)
      .attr('width', pillW)
      .attr('height', pillH)
      .attr('rx', 5)
      .attr('fill', p.d.color)
      .attr('opacity', 0.92);
    cg.append('text')
      .attr('x', p.cx)
      .attr('y', labelCenter)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 9)
      .attr('fill', textColorFor(p.d.color))
      .attr('pointer-events', 'none')
      .text(p.d.name);
  }
}

function draw(width: number, height: number): void {
  if (!svgSel || !mainG || !baseX) return;
  const x = currentX();
  const axisY = height - AXIS_BOTTOM_PAD;
  mainG.selectAll('*').remove();

  // --- data partition ---
  // main axis = top-level dynasties (the historian-recognised succession)
  const mainDynasties = dynasties
    .filter((d) => !d.parent_id)
    .sort((a, b) => a.start_year - b.start_year || a.sort_order - b.sort_order);
  // parallel layer = sub-dynasties (concurrent regimes / vassal states)
  const parallel = dynasties
    .filter((d) => d.parent_id)
    .sort((a, b) => a.start_year - b.start_year);
  const parLanes = assignLanes(parallel);
  const parRows = Math.min(MAX_PAR_LANES, maxLane(parLanes) + 1);

  // --- layout Y positions ---
  const topCalloutEnd = CALLOUT_TOP_Y + CALLOUT_MAX_ROWS * CALLOUT_ROW_H;
  const mainBarY = topCalloutEnd + 2;                 // main axis row
  const parBarY = mainBarY + MAIN_BAR_H + 4;          // parallel layer start
  const parLayerEnd = parBarY + parRows * (PAR_BAR_H + PAR_BAR_GAP);
  const botCalloutStart = parLayerEnd + 4;
  const BOT_CALLOUT_ROWS = 3;                         // more room for parallel labels
  const botCalloutEnd = Math.min(botCalloutStart + BOT_CALLOUT_ROWS * CALLOUT_ROW_H, axisY - 4);

  // --- tick gridlines + labels ---
  const [d0, d1] = x.domain();
  const span = d1 - d0;
  const tickStep = niceStep(span / 12);
  const ticks: number[] = [];
  for (let y = Math.ceil(d0 / tickStep) * tickStep; y <= d1; y += tickStep) {
    ticks.push(y);
  }
  const gridG = mainG.append('g').attr('class', 'grid');
  gridG
    .selectAll('line')
    .data(ticks)
    .enter()
    .append('line')
    .attr('x1', (t) => x(t))
    .attr('x2', (t) => x(t))
    .attr('y1', 0)
    .attr('y2', axisY)
    .attr('stroke', '#eee')
    .attr('stroke-width', 0.5);
  gridG
    .selectAll('text')
    .data(ticks)
    .enter()
    .append('text')
    .attr('x', (t) => x(t))
    .attr('y', height - 3)
    .attr('text-anchor', 'middle')
    .attr('font-size', 9)
    .attr('fill', '#888')
    .text((t) => (t < 0 ? `${-t}BC` : `${t}AD`));

  const halfMain = MAIN_BAR_H / 2;

  // helper to draw a single coloured segment (rx=0 keeps adjacent segments flush)
  const drawSeg = (
    d: Dynasty,
    x1: number,
    x2: number,
    segY: number,
    segH: number,
  ): void => {
    const px1 = x(x1);
    const px2 = x(x2);
    const w = Math.max(1.5, px2 - px1);
    mainG!
      .append('rect')
      .attr('x', px1)
      .attr('y', segY)
      .attr('width', w)
      .attr('height', segH)
      .attr('rx', 0)
      .attr('fill', d.color)
      .attr('opacity', 0.95)
      .style('cursor', 'pointer')
      .on('click', () => {
        // click a dynasty → jump playhead to its midpoint (do NOT change selection)
        timeline.setYear(Math.round((d.start_year + d.end_year) / 2));
      });
  };

  // --- MAIN AXIS: single row, half-height handoff at overlaps ---
  const narrowMain: Dynasty[] = [];
  for (let i = 0; i < mainDynasties.length; i++) {
    const d = mainDynasties[i];
    const prev = i > 0 ? mainDynasties[i - 1] : null;
    const next = i < mainDynasties.length - 1 ? mainDynasties[i + 1] : null;
    // segment A: head overlapped by prev → bottom half (prev shows on top)
    const aEnd =
      prev && prev.end_year > d.start_year ? Math.min(prev.end_year, d.end_year) : d.start_year;
    if (aEnd > d.start_year) {
      drawSeg(d, d.start_year, aEnd, mainBarY + halfMain, halfMain);
    }
    // segment B: middle, full height
    const bStart = aEnd > d.start_year ? aEnd : d.start_year;
    const bEnd = next && d.end_year > next.start_year ? next.start_year : d.end_year;
    if (bEnd > bStart) {
      drawSeg(d, bStart, bEnd, mainBarY, MAIN_BAR_H);
    }
    // segment C: tail overlaps next → top half (next shows on bottom)
    const cStart = next && d.end_year > next.start_year ? next.start_year : d.end_year;
    if (d.end_year > cStart) {
      drawSeg(d, cStart, d.end_year, mainBarY, halfMain);
    }
    // collect narrow bars for callout
    const barW = x(d.end_year) - x(d.start_year);
    if (barW < measure(d.name, 10) + 8) narrowMain.push(d);
  }
  // main axis inline labels
  const mainLabelsG = mainG.append('g').attr('class', 'labels-main');
  mainLabelsG
    .selectAll('text')
    .data(mainDynasties)
    .enter()
    .append('text')
    .attr('x', (d) => (x(d.start_year) + x(d.end_year)) / 2)
    .attr('y', mainBarY + MAIN_BAR_H / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', 10)
    .attr('font-weight', 600)
    .attr('fill', (d) => textColorFor(d.color))
    .attr('pointer-events', 'none')
    .text((d) => {
      const barW = x(d.end_year) - x(d.start_year);
      return barW >= measure(d.name, 10) + 8 ? d.name : '';
    });
  layoutCallouts(
    narrowMain,
    (d) => mainBarY + MAIN_BAR_H,
    x,
    'top',
    CALLOUT_TOP_Y,
    topCalloutEnd,
    CALLOUT_MAX_ROWS,
  );

  // --- PARALLEL LAYER: multi-row lanes for concurrent regimes ---
  const narrowPar: Dynasty[] = [];
  const PAR_LABEL_SIZE = 8;
  const PAR_LABEL_GAP = 2;
  for (const d of parallel) {
    const lane = parLanes.get(d) ?? 0;
    const segY = parBarY + lane * (PAR_BAR_H + PAR_BAR_GAP);
    drawSeg(d, d.start_year, d.end_year, segY, PAR_BAR_H);
    const barW = x(d.end_year) - x(d.start_year);
    if (barW < measure(d.name, PAR_LABEL_SIZE) + PAR_LABEL_GAP) narrowPar.push(d);
  }
  // labels group created AFTER the bar rects so text renders on top (SVG z-order)
  const parBarsG = mainG.append('g').attr('class', 'bars-parallel');
  parBarsG
    .selectAll('text')
    .data(parallel)
    .enter()
    .append('text')
    .attr('x', (d) => (x(d.start_year) + x(d.end_year)) / 2)
    .attr('y', (d) => parBarY + (parLanes.get(d) ?? 0) * (PAR_BAR_H + PAR_BAR_GAP) + PAR_BAR_H / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', PAR_LABEL_SIZE)
    .attr('fill', (d) => textColorFor(d.color))
    .attr('pointer-events', 'none')
    .text((d) => {
      const barW = x(d.end_year) - x(d.start_year);
      return barW >= measure(d.name, PAR_LABEL_SIZE) + PAR_LABEL_GAP ? d.name : '';
    });
  layoutCallouts(
    narrowPar,
    (d) => parBarY + (parLanes.get(d) ?? 0) * (PAR_BAR_H + PAR_BAR_GAP) + PAR_BAR_H,
    x,
    'bottom',
    botCalloutStart,
    botCalloutEnd,
    BOT_CALLOUT_ROWS,
  );

  // --- selection overlay (video-clip style) ---
  const selStartX = x(timeline.selectionStart);
  const selEndX = x(timeline.selectionEnd);
  const leftEdge = x(d0);
  const rightEdge = x(d1);
  mainG
    .append('rect')
    .attr('x', leftEdge)
    .attr('y', 0)
    .attr('width', Math.max(0, selStartX - leftEdge))
    .attr('height', axisY)
    .attr('fill', '#000')
    .attr('opacity', 0.13)
    .attr('pointer-events', 'none');
  mainG
    .append('rect')
    .attr('x', selEndX)
    .attr('y', 0)
    .attr('width', Math.max(0, rightEdge - selEndX))
    .attr('height', axisY)
    .attr('fill', '#000')
    .attr('opacity', 0.13)
    .attr('pointer-events', 'none');
  mainG
    .append('rect')
    .attr('x', selStartX)
    .attr('y', 0)
    .attr('width', Math.max(0, selEndX - selStartX))
    .attr('height', axisY)
    .attr('fill', '#c0392b')
    .attr('opacity', 0.06)
    .attr('pointer-events', 'none');

  // --- selection handles (in/out points) ---
  const makeHandle = (yearVal: number, side: 'start' | 'end'): void => {
    const px = x(yearVal);
    const color = side === 'start' ? '#2980b9' : '#27ae60';
    const g = mainG!.append('g').attr('class', `handle-${side}`).style('cursor', 'ew-resize');
    g.append('line')
      .attr('x1', px)
      .attr('x2', px)
      .attr('y1', 0)
      .attr('y2', axisY)
      .attr('stroke', color)
      .attr('stroke-width', 2);
    g.append('circle').attr('cx', px).attr('cy', 2).attr('r', 5).attr('fill', color);
    g.append('circle').attr('cx', px).attr('cy', axisY).attr('r', 4).attr('fill', color);
    const drag = d3
      .drag<SVGGElement, unknown>()
      .on('start', () => {
        suppressSelectionZoom = true;
      })
      .on('drag', (event) => {
        const yr = Math.round(x.invert(event.x));
        const snapped = snapYear(yr, x);
        if (side === 'start') timeline.setSelectionStart(snapped);
        else timeline.setSelectionEnd(snapped);
        updateLabels();
        draw(width, height);
      })
      .on('end', () => {
        suppressSelectionZoom = false;
        zoomToSelection();
      });
    g.call(drag);
  };
  makeHandle(timeline.selectionStart, 'start');
  makeHandle(timeline.selectionEnd, 'end');

  // --- playhead (current year) ---
  const ph = mainG.append('g').attr('class', 'playhead');
  const phX = x(timeline.currentYear);
  ph
    .append('line')
    .attr('x1', phX)
    .attr('x2', phX)
    .attr('y1', 0)
    .attr('y2', axisY)
    .attr('stroke', '#c0392b')
    .attr('stroke-width', 1.5)
    .attr('opacity', 0.75);
  ph
    .append('circle')
    .attr('cx', phX)
    .attr('cy', axisY)
    .attr('r', 5.5)
    .attr('fill', '#c0392b')
    .style('cursor', 'ew-resize');
  const phDrag = d3
    .drag<SVGGElement, unknown>()
    .on('drag', (event) => {
      const yr = Math.round(x.invert(event.x));
      timeline.setYear(yr);
      updateLabels();
      draw(width, height);
    });
  ph.call(phDrag);

  updateLabels();
}

function updateLabels(): void {
  yearLabel.value = formatYear(timeline.currentYear);
  const a = timeline.selectionStart;
  const b = timeline.selectionEnd;
  selectionLabel.value = `选区 ${formatYear(a)} — ${formatYear(b)}（共 ${Math.abs(b - a)} 年）`;
}

function render(): void {
  const host = svgHost.value;
  if (!host || dynasties.length === 0) return;
  const width = host.clientWidth;
  const height = host.clientHeight;
  const minYear = (d3.min(dynasties, (d) => d.start_year) ?? -5000) - 50;
  const maxYear = (d3.max(dynasties, (d) => d.end_year) ?? 2026) + 50;
  baseX = d3.scaleLinear().domain([minYear, maxYear]).range([PAD_L, width - PAD_R]);
  const sizeChanged = width !== lastSize.w || height !== lastSize.h;
  if (!svgSel || sizeChanged) {
    build(width, height);
    lastSize = { w: width, h: height };
  }
  draw(width, height);
  if (!hasInitialFit) {
    hasInitialFit = true;
    zoomToSelection();
  }
}

async function loadDynasties(): Promise<void> {
  try {
    const res = await dynastiesApi.list();
    dynasties = res.items;
    render();
  } catch (e) {
    console.error('Failed to load dynasties', e);
  }
}

onMounted(() => {
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  updateLabels();
  loadDynasties();
  window.addEventListener('resize', render);
});

onUnmounted(() => {
  window.removeEventListener('resize', render);
});

watch(() => timeline.currentYear, updateLabels);

watch(
  () => [timeline.selectionStart, timeline.selectionEnd],
  () => {
    updateLabels();
    if (suppressSelectionZoom) {
      const host = svgHost.value;
      if (host) draw(host.clientWidth, host.clientHeight);
    } else {
      zoomToSelection();
    }
  },
);

watch(
  () => timeline.timelineZoom,
  (k) => {
    if (suppressZoomSync) return;
    if (svgSel && zoomBehavior) svgSel.call(zoomBehavior.scaleTo, k);
  },
);
</script>

<style scoped>
.timeline-axis {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  user-select: none;
  overflow: hidden;
}
.svg-host {
  width: 100%;
  height: 100%;
}
.year-label {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #c0392b;
  background: rgba(255, 255, 255, 0.92);
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: none;
}
.selection-label {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 12px;
  color: #333;
  background: rgba(255, 255, 255, 0.92);
  padding: 2px 8px;
  border-radius: 4px;
  pointer-events: none;
}
.hint {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #aaa;
  pointer-events: none;
  white-space: nowrap;
}
</style>
