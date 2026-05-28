// GDP in trillions USD (approx). Keyed by ISO 3166-1 numeric code (string, no leading zeros normalized away).
// Income per second = gdpT * 100.
export const COUNTRY_GDP: Record<string, number> = {
  "840": 27.0, "156": 17.7, "276": 4.5, "392": 4.2, "356": 3.7,
  "826": 3.3, "250": 3.0, "380": 2.2, "76": 2.1, "124": 2.1,
  "643": 2.0, "484": 1.8, "36": 1.7, "410": 1.7, "724": 1.6,
  "360": 1.4, "792": 1.1, "528": 1.1, "682": 1.1, "756": 0.9,
  "616": 0.8, "158": 0.8, "32": 0.6, "752": 0.6, "56": 0.6,
  "372": 0.55, "376": 0.52, "578": 0.5, "784": 0.5, "818": 0.4,
  "710": 0.4, "364": 0.4, "764": 0.5, "50": 0.45, "704": 0.43,
  "566": 0.4, "608": 0.4, "586": 0.34, "642": 0.35, "152": 0.33,
  "170": 0.36, "246": 0.3, "203": 0.33, "620": 0.29, "554": 0.25,
  "604": 0.27, "300": 0.24, "368": 0.27, "398": 0.26, "348": 0.21,
  "634": 0.24, "804": 0.18, "504": 0.14, "192": 0.11, "862": 0.1,
  "231": 0.16, "404": 0.12, "24": 0.1, "288": 0.08, "12": 0.22,
  "434": 0.04,
};

// ISO numeric codes of regions players cannot play / are filtered from the world.
export const EXCLUDED_COUNTRY_IDS = new Set<string>(["10", "260"]);

// Well-known landlocked countries (ISO numeric). No direct sea access.
export const LANDLOCKED_COUNTRY_IDS = new Set<string>([
  "4","20","51","40","31","112","64","68","72","854","108","140","148","203",
  "748","231","348","398","417","418","426","438","442","454","466","498","496",
  "524","562","807","600","646","674","688","703","728","756","762","795","800",
  "860","336","894","716",
]);

export function isPlayableCountry(id: string | number): boolean {
  return !EXCLUDED_COUNTRY_IDS.has(String(Number(id)));
}

export function hasSeaAccess(id: string | number): boolean {
  return !LANDLOCKED_COUNTRY_IDS.has(String(Number(id)));
}

export function getGdp(id: string | number): number {
  const key = String(Number(id));
  return COUNTRY_GDP[key] ?? 0.05;
}
