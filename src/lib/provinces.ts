import { Delaunay } from "d3-delaunay";

export interface Province {
  id: string;
  countryId: string;
  index: number;
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
  const n = provinceCountFor(pixelArea);

  const w = Math.max(1, bbox.maxX - bbox.minX);
  const h = Math.max(1, bbox.maxY - bbox.minY);
  const cx0 = (bbox.minX + bbox.maxX) / 2;
  const cy0 = (bbox.minY + bbox.maxY) / 2;

  // Generate jittered grid points for stable cell sizes
  const cols = Math.max(1, Math.round(Math.sqrt(n * (w / h))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const pts: [number, number][] = [];
  for (let r = 0; r < rows && pts.length < n; r++) {
    for (let c = 0; c < cols && pts.length < n; c++) {
      const jx = (rng() - 0.5) * (w / cols) * 0.6;
      const jy = (rng() - 0.5) * (h / rows) * 0.6;
      pts.push([
        bbox.minX + ((c + 0.5) * w) / cols + jx,
        bbox.minY + ((r + 0.5) * h) / rows + jy,
      ]);
    }
  }
  if (pts.length === 0) return [];

  const padX = w * 0.15 + 4;
  const padY = h * 0.15 + 4;
  const delaunay = Delaunay.from(pts);
  const voronoi = delaunay.voronoi([
    bbox.minX - padX, bbox.minY - padY, bbox.maxX + padX, bbox.maxY + padY,
  ]);

  const span = Math.hypot(w, h);
  const raw = pts.map((p, i) => {
    const d = voronoi.renderCell(i) ?? "";
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
