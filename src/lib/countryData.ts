// GDP in trillions USD (approx). Keyed by ISO 3166-1 numeric code (string, no leading zeros normalized away).
// Income per second = gdpT * 100.
export const COUNTRY_GDP: Record<string, number> = {
  "840": 27.0, // USA
  "156": 17.7, // China
  "276": 4.5,  // Germany
  "392": 4.2,  // Japan
  "356": 3.7,  // India
  "826": 3.3,  // UK
  "250": 3.0,  // France
  "380": 2.2,  // Italy
  "76": 2.1,   // Brazil
  "124": 2.1,  // Canada
  "643": 2.0,  // Russia
  "484": 1.8,  // Mexico
  "36": 1.7,   // Australia
  "410": 1.7,  // South Korea
  "724": 1.6,  // Spain
  "360": 1.4,  // Indonesia
  "792": 1.1,  // Turkey
  "528": 1.1,  // Netherlands
  "682": 1.1,  // Saudi Arabia
  "756": 0.9,  // Switzerland
  "616": 0.8,  // Poland
  "158": 0.8,  // Taiwan
  "32": 0.6,   // Argentina
  "752": 0.6,  // Sweden
  "56": 0.6,   // Belgium
  "372": 0.55, // Ireland
  "376": 0.52, // Israel
  "578": 0.5,  // Norway
  "784": 0.5,  // UAE
  "818": 0.4,  // Egypt
  "710": 0.4,  // South Africa
  "364": 0.4,  // Iran
  "764": 0.5,  // Thailand
  "50": 0.45,  // Bangladesh
  "704": 0.43, // Vietnam
  "566": 0.4,  // Nigeria
  "608": 0.4,  // Philippines
  "586": 0.34, // Pakistan
  "642": 0.35, // Romania
  "152": 0.33, // Chile
  "170": 0.36, // Colombia
  "246": 0.3,  // Finland
  "203": 0.33, // Czech
  "620": 0.29, // Portugal
  "554": 0.25, // New Zealand
  "604": 0.27, // Peru
  "300": 0.24, // Greece
  "368": 0.27, // Iraq
  "398": 0.26, // Kazakhstan
  "348": 0.21, // Hungary
  "634": 0.24, // Qatar
  "804": 0.18, // Ukraine
  "504": 0.14, // Morocco
  "192": 0.11, // Cuba
  "862": 0.1,  // Venezuela
  "231": 0.16, // Ethiopia
  "404": 0.12, // Kenya
  "24": 0.1,   // Angola
  "288": 0.08, // Ghana
  "12": 0.22,  // Algeria
  "434": 0.4,  // Libya wait, that's high; keep ~0.04
  "999": 0.05, // fallback
};
// Adjust Libya
COUNTRY_GDP["434"] = 0.04;

export function getGdp(id: string | number): number {
  const key = String(Number(id)); // normalize leading zeros
  return COUNTRY_GDP[key] ?? 0.05;
}
