import { Delaunay } from "d3-delaunay";
import { regionNamesFor, preferredProvinceCount } from "./historicalRegions";

export interface Province {
  id: string;
  countryId: string;
  index: number;
  name: string;
  /** SVG path string for the Voronoi cell (projected pixel space, may extend
   *  outside the country — render with a clipPath set to the country path). */
  d: string;
  cx: number;
  cy: number;
  /** Population in thousands. */
  population: number;
  /** Economy (GDP share) in billions USD. */
  economy: number;
}


function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number }

export function provinceCountFor(pixelArea: number): number {
  const n = Math.round(Math.sqrt(Math.max(1, pixelArea)) / 14);
  return Math.max(1, Math.min(14, n));
}

export interface ProvinceGenInput {
  countryId: string;
  bbox: BBox;
  /** Approximate visible pixel area (used to pick province count). */
  pixelArea: number;
  totalPopulation: number; // in thousands
  totalEconomy: number;    // in billions USD
}

export function generateProvinces(input: ProvinceGenInput): Province[] {
  const { countryId, bbox, pixelArea, totalPopulation, totalEconomy } = input;
  const rng = mulberry32(hashSeed(countryId));
  const fallbackN = provinceCountFor(pixelArea);
  const n = preferredProvinceCount(countryId, fallbackN);
  const names = regionNamesFor(countryId, n);

  const w = Math.max(1, bbox.maxX - bbox.minX);
  const h = Math.max(1, bbox.maxY - bbox.minY);
  const cx0 = (bbox.minX + bbox.maxX) / 2;
  const cy0 = (bbox.minY + bbox.maxY) / 2;

  const cols = Math.max(1, Math.round(Math.sqrt(n * (w / h))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const pts: [number, number][] = [];
  for (let r = 0; r < rows && pts.length < n; r++) {
    for (let c = 0; c < cols && pts.length < n; c++) {
      const jx = (rng() - 0.5) * (w / cols) * 0.9;
      const jy = (rng() - 0.5) * (h / rows) * 0.9;
      pts.push([
        bbox.minX + ((c + 0.5) * w) / cols + jx,
        bbox.minY + ((r + 0.5) * h) / rows + jy,
      ]);
    }
  }
  if (pts.length === 0) return [];

  const padX = w * 0.15 + 4;
  const padY = h * 0.15 + 4;
  const clipBox: [number, number, number, number] = [
    bbox.minX - padX, bbox.minY - padY, bbox.maxX + padX, bbox.maxY + padY,
  ];
  // Lloyd relaxation — softens grid artefacts into organic, irregular cells
  let delaunay = Delaunay.from(pts);
  let voronoi = delaunay.voronoi(clipBox);
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < pts.length; i++) {
      const cell = voronoi.cellPolygon(i);
      if (!cell || cell.length < 3) continue;
      let cx = 0, cy = 0, area = 0;
      for (let j = 0; j < cell.length - 1; j++) {
        const [x0, y0] = cell[j]; const [x1, y1] = cell[j + 1];
        const a = x0 * y1 - x1 * y0;
        area += a; cx += (x0 + x1) * a; cy += (y0 + y1) * a;
      }
      if (Math.abs(area) < 1e-6) continue;
      area *= 0.5;
      // Move 70% toward centroid each pass (relaxed Lloyd) for less grid feel
      const tx = cx / (6 * area), ty = cy / (6 * area);
      pts[i] = [pts[i][0] + (tx - pts[i][0]) * 0.7, pts[i][1] + (ty - pts[i][1]) * 0.7];
    }
    delaunay = Delaunay.from(pts);
    voronoi = delaunay.voronoi(clipBox);
  }

  // Build organic, wiggly cell paths by subdividing each Voronoi edge and
  // perturbing midpoints with deterministic noise. Shared edges between
  // neighbours use the SAME perturbation (keyed by sorted endpoints) so cells
  // stay watertight — no gaps between provinces.
  const edgeNoise = new Map<string, number>();
  const noiseFor = (a: [number, number], b: [number, number]): number => {
    const k = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
      ? `${a[0].toFixed(2)},${a[1].toFixed(2)}|${b[0].toFixed(2)},${b[1].toFixed(2)}`
      : `${b[0].toFixed(2)},${b[1].toFixed(2)}|${a[0].toFixed(2)},${a[1].toFixed(2)}`;
    let v = edgeNoise.get(k);
    if (v === undefined) { v = (rng() - 0.5) * 2; edgeNoise.set(k, v); }
    return v;
  };
  const wiggleAmp = Math.min(w, h) * 0.012;

  const cellPaths: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 3) { cellPaths[i] = ""; continue; }
    const out: [number, number][] = [];
    for (let j = 0; j < cell.length - 1; j++) {
      const a = cell[j] as [number, number];
      const b = cell[j + 1] as [number, number];
      out.push(a);
      // two perturbed midpoints per edge → soft S-curve borders
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (const t of [0.33, 0.66]) {
        const px = a[0] + dx * t;
        const py = a[1] + dy * t;
        const off = noiseFor(a, b) * wiggleAmp * (1 - Math.abs(t - 0.5) * 1.2);
        out.push([px + nx * off, py + ny * off]);
      }
    }
    cellPaths[i] = "M" + out.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z";
  }

  const span = Math.hypot(w, h);
  const raw = pts.map((p, i) => {
    const d = cellPaths[i] ?? "";
    const dist = Math.hypot(p[0] - cx0, p[1] - cy0);
    const centralBias = 1 - Math.min(1, dist / (span * 0.55));
    const density = 0.25 + centralBias * 0.6 + rng() * 0.4;
    return { i, p, d, density };
  });
  const totalDensity = raw.reduce((s, r) => s + r.density, 0) || 1;

  return raw
    .filter((r) => r.d.length > 0)
    .map((r) => {
      const share = r.density / totalDensity;
      return {
        id: `${countryId}_${r.i}`,
        countryId,
        index: r.i,
        name: names[r.i] ?? `Region ${r.i + 1}`,
        d: r.d,
        cx: r.p[0],
        cy: r.p[1],
        population: Math.round(totalPopulation * share),
        economy: Math.round(totalEconomy * share * 100) / 100,
      };
    });
}


const PROVINCE_CACHE = new Map<string, Province[]>();

export function getOrGenerateProvinces(input: ProvinceGenInput): Province[] {
  const key = `${input.countryId}:${Math.round(input.bbox.minX)}:${Math.round(input.bbox.minY)}:${Math.round(input.bbox.maxX)}:${Math.round(input.bbox.maxY)}:${Math.round(input.totalPopulation)}`;
  const cached = PROVINCE_CACHE.get(key);
  if (cached) return cached;
  const next = generateProvinces(input);
  PROVINCE_CACHE.set(key, next);
  return next;
}

export function clearProvinceCache() { PROVINCE_CACHE.clear(); }
