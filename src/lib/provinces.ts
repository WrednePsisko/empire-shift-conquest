import { Delaunay } from "d3-delaunay";

export interface Province {
  id: string;
  countryId: string;
  index: number;
  /** SVG path string for the Voronoi cell (already in projected pixel space). */
  d: string;
  /** Projected pixel centroid. */
  cx: number;
  cy: number;
  /** Population in thousands. */
  population: number;
  /** Economy (GDP share) in billions USD. */
  economy: number;
  /** 0..1 density proxy (higher = more populated). */
  density: number;
}

// Seeded mulberry32 RNG for deterministic generation per-country.
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

/** Sample N points whose density falls off near the polygon boundary, so sparse
 *  border regions naturally get bigger Voronoi cells. */
function samplePoints(
  bbox: BBox,
  containsPoint: (x: number, y: number) => boolean,
  count: number,
  rng: () => number,
): [number, number][] {
  const out: [number, number][] = [];
  const target = count;
  const maxTries = count * 60;
  let tries = 0;
  while (out.length < target && tries < maxTries) {
    tries++;
    const x = bbox.minX + rng() * (bbox.maxX - bbox.minX);
    const y = bbox.minY + rng() * (bbox.maxY - bbox.minY);
    if (!containsPoint(x, y)) continue;
    // Lloyd-ish acceptance bias: prefer points away from already-placed neighbors
    let ok = true;
    const minDist = Math.min(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) / (Math.sqrt(target) * 2.2);
    for (const p of out) {
      const dx = p[0] - x, dy = p[1] - y;
      if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
    }
    if (ok) out.push([x, y]);
  }
  // Fill remainder without spacing constraint
  while (out.length < target && tries < maxTries * 2) {
    tries++;
    const x = bbox.minX + rng() * (bbox.maxX - bbox.minX);
    const y = bbox.minY + rng() * (bbox.maxY - bbox.minY);
    if (containsPoint(x, y)) out.push([x, y]);
  }
  return out;
}

export interface ProvinceGenInput {
  countryId: string;
  bbox: BBox;
  containsPoint: (x: number, y: number) => boolean;
  /** Pixel area of country (used for province count). */
  pixelArea: number;
  /** Country totals to distribute. */
  totalPopulation: number; // in thousands
  totalEconomy: number;    // in billions USD
}

/** Choose province count from country area: small countries 1-3, large up to 14. */
export function provinceCountFor(pixelArea: number): number {
  const n = Math.round(Math.sqrt(pixelArea) / 18);
  return Math.max(1, Math.min(14, n));
}

export function generateProvinces(input: ProvinceGenInput): Province[] {
  const { countryId, bbox, containsPoint, pixelArea, totalPopulation, totalEconomy } = input;
  const rng = mulberry32(hashSeed(countryId));
  const n = provinceCountFor(pixelArea);
  const pts = samplePoints(bbox, containsPoint, n, rng);
  if (pts.length === 0) return [];

  const padX = (bbox.maxX - bbox.minX) * 0.05 + 2;
  const padY = (bbox.maxY - bbox.minY) * 0.05 + 2;
  const delaunay = Delaunay.from(pts);
  const voronoi = delaunay.voronoi([
    bbox.minX - padX, bbox.minY - padY, bbox.maxX + padX, bbox.maxY + padY,
  ]);

  // Density proxy: prefer cells closer to country centroid
  const cx0 = (bbox.minX + bbox.maxX) / 2;
  const cy0 = (bbox.minY + bbox.maxY) / 2;
  const span = Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);

  const raw = pts.map((p, i) => {
    const d = voronoi.renderCell(i) ?? "";
    const dist = Math.hypot(p[0] - cx0, p[1] - cy0);
    const centralBias = 1 - Math.min(1, dist / (span * 0.55));
    const density = 0.25 + centralBias * 0.6 + rng() * 0.4; // 0.25..~1.25
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
        density: r.density,
      };
    });
}
