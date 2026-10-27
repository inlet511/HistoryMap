<template>
  <div ref="containerRef" class="map-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import maplibregl from 'maplibre-gl';
import { useTimelineStore } from '@/stores/timeline';
import type { HistoryEvent, War, BaseMapStyle } from '@/types';

const props = defineProps<{
  events: HistoryEvent[];
  wars: War[];
  hoveredEventId: string | null;
  factionsGeo: GeoJSON.FeatureCollection;
}>();

const timeline = useTimelineStore();
const containerRef = ref<HTMLDivElement>();
let map: maplibregl.Map | null = null;
let popup: maplibregl.Popup | null = null;
let hoveredFactionId: string | number | undefined = undefined;

// Four base styles — raster tiles, swappable at runtime
const baseStyles: Record<BaseMapStyle, maplibregl.StyleSpecification> = {
  admin: {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  },
  satellite: {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      sat: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri World Imagery',
      },
    },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
  },
  terrain: {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      otm: {
        type: 'raster',
        tiles: [
          'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenTopoMap, © OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'otm', type: 'raster', source: 'otm' }],
  },
  none: { version: 8, glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', sources: {}, layers: [] },
};

function eventsToGeoJSON(events: HistoryEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lng as number, e.lat as number] },
        properties: {
          id: e.id,
          title: e.title,
          type: e.type,
          year: e.year,
          year_label: e.year_label,
        },
      })),
  };
}

function addOrUpdateSource(id: string, data: GeoJSON.FeatureCollection): void {
  if (!map) return;
  if (!map.getSource(id)) {
    map.addSource(id, id === 'factions'
      ? { type: 'geojson', data, promoteId: 'faction_id' }
      : { type: 'geojson', data });
  } else {
    (map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
  }
}

function addFactionLayers(): void {
  if (!map) return;
  const fc = props.factionsGeo;
  console.log('[MapContainer] addFactionLayers: features=', fc.features.length, 'sample=', fc.features[0]?.properties);
  addOrUpdateSource('factions', fc);

  // filled polygon — color per faction, deeper on hover
  if (!map.getLayer('factions-fill')) {
    map.addLayer({
      id: 'factions-fill',
      type: 'fill',
      source: 'factions',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.65, 0.45],
      },
    });
  }
  // outline
  if (!map.getLayer('factions-outline')) {
    map.addLayer({
      id: 'factions-outline',
      type: 'line',
      source: 'factions',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.6,
        'line-opacity': 1,
      },
    });
  }
  // label — use Open Sans (supported by demotiles glyphs), not Noto Sans
  if (!map.getLayer('factions-label')) {
    map.addLayer({
      id: 'factions-label',
      type: 'symbol',
      source: 'factions',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 13,
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#1a1a1a',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2.5,
      },
    });
  }
}

function addEventsLayers(): void {
  if (!map) return;
  addOrUpdateSource('events', eventsToGeoJSON(props.events));

  if (!map.getLayer('events-circle')) {
    map.addLayer({
      id: 'events-circle',
      type: 'circle',
      source: 'events',
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'match',
          ['get', 'type'],
          'battle', '#c0392b',
          'reform', '#2980b9',
          'founding', '#27ae60',
          'fall', '#7f8c8d',
          'treaty', '#8e44ad',
          '#f39c12',
        ],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    });
  }

  if (!map.getLayer('events-hover')) {
    map.addLayer({
      id: 'events-hover',
      type: 'circle',
      source: 'events',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 11,
        'circle-color': '#e74c3c',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 3,
      },
      filter: ['==', ['get', 'id'], props.hoveredEventId ?? ''],
    });
  }
}

function addDataLayers(): void {
  if (!map) return;
  addFactionLayers();
  addEventsLayers();
}

function bindFactionHover(): void {
  if (!map) return;

  map.on('mousemove', 'factions-fill', (e) => {
    if (!map || !e.features || e.features.length === 0) return;
    const feat = e.features[0];
    if (feat.id === undefined || feat.id === null) return;
    if (hoveredFactionId !== undefined && hoveredFactionId !== feat.id) {
      map.setFeatureState({ source: 'factions', id: hoveredFactionId }, { hover: false });
    }
    hoveredFactionId = feat.id as string | number;
    map.setFeatureState({ source: 'factions', id: hoveredFactionId }, { hover: true });

    const name = feat.properties?.name ?? '';
    const start = feat.properties?.start_year;
    const end = feat.properties?.end_year;
    const label = (start != null && end != null) ? `${name}  (${formatYr(start)} ~ ${formatYr(end)})` : name;
    popup?.setLngLat(e.lngLat).setHTML(label).addTo(map);
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'factions-fill', () => {
    if (!map) return;
    if (hoveredFactionId !== undefined) {
      map.setFeatureState({ source: 'factions', id: hoveredFactionId }, { hover: false });
    }
    hoveredFactionId = undefined;
    popup?.remove();
    map.getCanvas().style.cursor = '';
  });
}

function formatYr(y: number): string {
  if (y < 0) return `前${-y}`;
  return `${y}`;
}

onMounted(() => {
  if (!containerRef.value) return;
  popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'faction-popup' });
  map = new maplibregl.Map({
    container: containerRef.value,
    style: baseStyles[timeline.baseMap],
    center: timeline.mapCenter,
    zoom: timeline.mapZoom,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl(), 'top-left');
  map.on('load', () => {
    addDataLayers();
    bindFactionHover();
  });
  map.on('moveend', () => {
    if (!map) return;
    timeline.setView(
      [map.getCenter().lng, map.getCenter().lat],
      map.getZoom(),
    );
  });
});

watch(
  () => timeline.baseMap,
  (s) => {
    if (!map) return;
    map.setStyle(baseStyles[s]);
    map.once('style.load', () => {
      addDataLayers();
      // feature-state is lost after setStyle; rebind hover listeners are map-level (persist)
    });
  },
);

watch(
  () => props.events,
  () => {
    if (map && map.getSource('events')) {
      (map.getSource('events') as maplibregl.GeoJSONSource).setData(
        eventsToGeoJSON(props.events),
      );
    }
  },
  { deep: true },
);

watch(
  () => props.factionsGeo,
  (fc) => {
    if (!map) return;
    if (!map.getSource('factions')) {
      // source not yet created (map still loading) — create it with the real data
      addFactionLayers();
    } else {
      (map.getSource('factions') as maplibregl.GeoJSONSource).setData(fc);
    }
  },
  { deep: false },
);

watch(
  () => props.hoveredEventId,
  (id) => {
    if (!map || !map.getLayer('events-hover')) return;
    if (id) {
      map.setFilter('events-hover', ['==', ['get', 'id'], id]);
      map.setLayoutProperty('events-hover', 'visibility', 'visible');
    } else {
      map.setLayoutProperty('events-hover', 'visibility', 'none');
    }
  },
);

onUnmounted(() => {
  popup?.remove();
  map?.remove();
  map = null;
});
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
}
</style>

<style>
/* faction hover popup (global, not scoped) */
.faction-popup .maplibregl-popup-content {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.faction-popup .maplibregl-popup-tip {
  border-top-color: rgba(255, 255, 255, 0.95);
}
</style>
