# Plan: Deeper War, Alliances, and Provinces

This is a large pass touching map rendering, gameplay state, and UI. I'll group the work so we can ship it cleanly.

## 1. Send Troops flow (province targeting)

- After declaring war, clicking an enemy country opens a **target panel** instead of immediately attacking.
- Panel lists that country's provinces with name + population + economy + current garrison.
- Pick a province → set troop count via input field + slider + quick buttons (25%, 50%, 100%, Max).
- "Send Troops" dispatches a movement whose destination is the **province centroid** (not country centroid). Existing army-speed-by-size logic kept.
- On arrival: combat resolves against that province's garrison; if won, only that province flips ownership. Country falls only when all its provinces are owned.

Province ownership lives in a new `provinceOwners: Record<string, string>` map in the store, keyed by `province.id`. Country-level `owners` is derived ("country is conquered when every province owner === attacker").

## 2. Alliance friction + relation drift

- **Forming an alliance** now requires relations ≥ +30 (was: instant accept by AI in many cases).
- **Breaking an alliance** applies a one-shot −40 to both sides + a 60s "betrayed" tag that blocks new alliance offers from that pair.
- **Drift over time**: every game tick, each relation moves toward a baseline derived from (geography, ideology proxy, shared enemies). Rate ≈ ±0.5 per real-time second, capped at [−100, +100]. Allies drift toward +60, enemies in active war drift toward −80.
- AI proposal logic checks the +30 threshold before sending alliance offers, so fewer noise offers reach the player.

## 3. Historical-region provinces (not random Voronoi)

- Replace the seeded Voronoi in `src/lib/provinces.ts` with a curated table of **historical regions per country** (e.g. France: Île-de-France, Bretagne, Normandie, Occitanie, …; Germany: Bayern, NRW, Baden-Württemberg, …; US: Northeast, Midwest, South, West, Pacific, Alaska; etc.).
- For each country we store a name list + a per-region population/economy weight. Cell shapes are still generated geometrically (the world map TopoJSON doesn't ship admin-1 polygons), but the **count, names, and weights match real subdivisions** instead of `sqrt(area)/k`.
- Countries without curated data fall back to a small generic split (1–4 regions named "North / South / East / West / Central").
- Province IDs become stable strings like `FRA_ile_de_france`, so saves survive code edits to other countries.

## 4. Capital city + main military icon

- Add a `capital: [lon, lat]` field to a `CAPITALS` map in `countryData.ts` for every playable country (using well-known coordinates).
- The **main army icon** for each country is rendered at the projected capital point, not the country centroid. Reinforcements spawn there.
- Capital is marked with a small star/dot under the icon and shown in the country info panel.

## 5. Bug fixes

- **Multi-province country not selectable**: today, when zoomed in, province click handlers swallow the event and the country selection state never updates. Fix: clicking a province sets *both* `selectedCountryId` (its owner) and `selectedProvinceId`. The country info panel opens as before.
- **France has no icon**: France's ISO numeric is `250`; the icon lookup is keyed off centroid placement that currently falls in the Atlantic because of the overseas-territory bounding box. Fix: project the icon from the new `capital` field (Paris) instead of the geometric centroid. This also fixes US (which today renders mid-Pacific because of Hawaii/Alaska) and Norway.
- **Province economy not visible**: province popover/panel currently shows only name. Add population (formatted with `formatPop`) and economy (formatted as `$X.XB` / `$X.XM`) plus current garrison.

## Technical notes

- New file: `src/lib/historicalRegions.ts` (curated table, ~30 countries with real subdivisions; everything else uses fallback).
- `src/lib/provinces.ts` keeps Voronoi geometry but driven by curated point counts and named cells.
- `src/lib/gameStore.ts` gets:
  - `provinceOwners`, `provinceGarrisons`
  - `relations` drift inside the existing tick loop
  - `declareAlliance`, `breakAlliance`, `proposeAlliance` updated for +30 / −40 rules
  - `sendTroops(originCountryId, targetProvinceId, count)` replacing the old country-targeted `attack`
- `src/components/WorldMap.tsx`:
  - capital-based icon positions
  - province click → bubbles up to country + province selection
  - province tooltip shows pop / economy / garrison
- `src/routes/play.tsx`:
  - new "Target Province" panel with slider + quantity input
  - alliance buttons disabled with hover text when relations < +30
- Save schema bumps to `empire-shift-save-v7`; older saves discarded with a one-line toast.

## Not in this pass

- Real admin-1 GeoJSON boundaries (still using clipped Voronoi shapes for cell geometry — only the *names and counts* match history).
- Full logistics/supply chains beyond the current army-speed-by-size rule.
- Multi-province simultaneous offensives in one click (you'd queue them one at a time).
