# Plan: Provinces, Hypsometric Map, War Flow

This is a large change. I'll break it into 4 focused areas. Confirm before I build so we don't waste a long pass on the wrong direction.

## 1. Hypsometric (elevation) overlay

Render an elevation-tinted layer on top of the political fills, not just contour lines.

- Procedural hypsometry generated from an SVG `<feTurbulence>` + `<feColorMatrix>` stack (lowlands green → highlands brown → peaks white), clipped to each country's path.
- Blended at ~35% opacity so political colors remain readable.
- Pure SVG, no extra dependencies, no extra data fetch.

Trade-off vs. real DEM: a true world elevation raster is ~5–20 MB and slow on mobile. Procedural gives the look at zero bandwidth cost. If you want real data later we can swap in a tiled raster.

## 2. Provinces system

This is the biggest change.

**Generation (deterministic, client-side):**
- Province count per country = `clamp(round(sqrt(area_km2) / k), 1, 40)` — large countries (Russia, US, Canada) get up to ~40; small ones get 1–3.
- Provinces generated via a seeded Voronoi (`d3-delaunay`) over points sampled inside each country polygon, clipped to the country shape.
- Sparse-area weighting: sampling density is biased by a simple population-density proxy (latitude band + distance from country centroid), so empty regions produce fewer, larger provinces.

**Per-province data:**
- `population` — distributed from total country population using the same density proxy, then jittered with a seeded RNG.
- `economy` (GDP share) — distributed proportionally to population with a wealth multiplier per country.
- `ownerId`, `garrison` (army units stationed there).

**Rendering:**
- Province borders drawn as thin lines inside each country.
- At low zoom, only country borders show; province borders fade in past ~3×.
- Tap a province to select it (replaces today's tap-country behavior when zoomed in).

## 3. War declaration & troop targeting flow

New interaction model:

1. Tap a country you don't own → side panel shows country info + **Declare War** button (only if not already at war / not allied).
2. After declaring war, the country's provinces become tappable as attack targets.
3. Tap one of your army icons → tap an enemy province → troops route to that specific province (current code routes to country centroid; this changes to province centroid).
4. Conquering all provinces = conquering the country.

Opinion / AI hooks stay as-is, just keyed on province ownership rolled up to country.

## 4. Country population counter + map pan fix

- Add `population` to each country (seeded from real-world figures in `countryData.ts`), shown in the country info panel and rolled up from provinces once conquests start splitting countries.
- Map pan: the right-side zoom control column currently uses `pointer-events-auto` on the inner div but the outer wrapper is `pointer-events-none` with `z-10` covering map area. I'll shrink the wrapper to exactly the button column width so the rest of the right edge is fully pannable, and verify on the 742px viewport.

## Technical notes

- New deps: `d3-delaunay` (~15 kB) for Voronoi.
- New file: `src/lib/provinces.ts` — generation + lookup, memoized per country.
- Save schema bumps to `empire-shift-save-v5`; old saves discarded.
- `WorldMap.tsx` gets a new `provinces` prop and an `onProvinceClick` callback; country fill logic moves to province fill when zoomed in.
- Movements retarget from country centroid to province centroid.

## Scope I'm NOT doing in this pass (call out so we agree)

- Real DEM raster overlay (procedural only).
- Province-level supply lines / fronts beyond what already exists at country level.
- Editing real-world province boundaries (e.g. actual US states) — generated Voronoi only. Real admin-1 boundaries would need a ~3 MB GeoJSON download.

Shall I proceed with this approach, or do you want real admin-1 province boundaries (US states, French régions, etc.) instead of generated Voronoi? That's the one decision that significantly changes the implementation.
