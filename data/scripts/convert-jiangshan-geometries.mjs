/**
 * Convert real historical boundaries from jiangshan-map (谭其骧+CHGIS digitized)
 * into faction_geometries.json, replacing the hand-drawn approximation for
 * 战国 (Warring States) and 三国 (Three Kingdoms).
 *
 * 春秋 forces keep the approximation (jiangshan-map coverage starts at -403 BCE,
 * before the bulk of the Spring & Autumn period).
 *
 * Each dynasty phase → one geometry row per matched polity, so a faction's
 * borders evolve across phases (e.g. 秦 grows as it conquers the other six).
 *
 * Run from repo root:
 *   node data/scripts/convert-jiangshan-geometries.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const JG = path.join(REPO, 'data', 'raw', 'jiangshan-map', 'geojson');
const SEED = path.join(REPO, 'data', 'seed', 'faction_geometries.json');

// polity title (Chinese) → our faction_id, keyed by dynasty
const MAP = {
  zhanguo: {
    '秦': 'qin_warring', '楚': 'chu_warring', '齐': 'qi_warring', '燕': 'yan_warring',
    '韩': 'han_warring', '赵': 'zhao_warring', '魏': 'wei_warring', '越': 'yue_spring',
  },
  sanguo: {
    '魏': 'wei', '蜀汉': 'shu', '吴': 'wu',
  },
};

const idx = JSON.parse(fs.readFileSync(path.join(JG, 'index.json'), 'utf8'));
const existing = JSON.parse(fs.readFileSync(SEED, 'utf8'));

// keep ALL approximation rows as a fallback for years before real data kicks in
// (e.g. 战国 -475~-404, before jiangshan-map coverage at -403).
// Backend uses DISTINCT ON (faction_id) ORDER BY start_year DESC so real data
// (later start_year) shadows the approximation for overlapping years.
const approximation = existing.filter((r) => r.source === 'approximation');
console.log(`[convert] keeping ${approximation.length} approximation rows (fallback for early years)`);

const realRows = [];
const stats = {};

for (const dyn of idx.dynasties) {
  const m = MAP[dyn.key];
  if (!m) continue;
  console.log(`[convert] ${dyn.title} (${dyn.from}~${dyn.to}) ${dyn.phases.length} phases`);
  for (const ph of dyn.phases) {
    const snapPath = path.join(JG, 'snapshots', ph.snapshot + '.geojson');
    if (!fs.existsSync(snapPath)) { console.warn(`  missing ${snapPath}`); continue; }
    const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    const polities = snap.features.filter((f) => f.properties.layer === 'polity');
    let matched = 0;
    for (const feat of polities) {
      const fid = m[feat.properties.title];
      if (!fid) continue;
      realRows.push({
        faction_id: fid,
        start_year: ph.from,
        end_year: ph.to,
        source: 'jiangshan-map (谭其骧+CHGIS)',
        geom: feat.geometry,
      });
      matched++;
      stats[fid] = (stats[fid] || 0) + 1;
    }
    console.log(`  ${ph.snapshot} ${ph.from}~${ph.to}: ${matched}/${polities.length} polity matched`);
  }
}

// Backfill early years (before jiangshan-map coverage at -403) by borrowing the
// earliest real phase's shape, so 战国 early period (-475~-404) isn't blank.
const FACTION_START = {
  qin_warring: -475, chu_warring: -475, qi_warring: -475, yan_warring: -475,
  han_warring: -453, zhao_warring: -453, wei_warring: -453, yue_spring: -514,
  wei: 220, shu: 221, wu: 222,
};
const fallbackRows = [];
for (const fid of Object.keys(stats)) {
  const facStart = FACTION_START[fid];
  if (facStart == null) continue;
  const rowsFor = realRows.filter((r) => r.faction_id === fid).sort((a, b) => a.start_year - b.start_year);
  if (rowsFor.length === 0) continue;
  const earliest = rowsFor[0];
  if (earliest.start_year > facStart) {
    fallbackRows.push({
      faction_id: fid,
      start_year: facStart,
      end_year: earliest.start_year - 1,
      source: 'jiangshan-map (early-shape fallback)',
      geom: earliest.geom,
    });
  }
}
console.log(`[convert] ${fallbackRows.length} early-fallback rows for pre-coverage years`);

const out = [...approximation, ...realRows, ...fallbackRows];
fs.writeFileSync(SEED, JSON.stringify(out, null, 2), 'utf8');
console.log(`\n[convert] wrote ${out.length} rows to ${SEED}`);
console.log(`  approximation (春秋 fallback): ${approximation.length}`);
console.log(`  real (战国+三国): ${realRows.length}`);
console.log(`  early-shape fallback: ${fallbackRows.length}`);
console.log('  per-faction phase counts:');
for (const [fid, n] of Object.entries(stats)) console.log(`    ${fid}: ${n} phases`);
