// Curated historical/administrative region names per country (ISO 3166-1 numeric).
// Used to give procedurally-generated provinces real-world names + counts
// instead of "Province 1, 2, 3…".
//
// The map cell *geometry* still comes from a clipped Voronoi (the world TopoJSON
// has no admin-1 polygons), but the **count and names** are historical.

export const HISTORICAL_REGIONS: Record<string, string[]> = {
  // United States
  "840": [
    "Northeast", "Mid-Atlantic", "Southeast", "Florida", "Great Lakes",
    "Midwest", "Texas", "Mountain", "Pacific Northwest", "California",
    "Alaska", "Plains",
  ],
  // France
  "250": [
    "Île-de-France", "Bretagne", "Normandie", "Hauts-de-France", "Grand Est",
    "Bourgogne-Franche-Comté", "Centre-Val de Loire", "Pays de la Loire",
    "Nouvelle-Aquitaine", "Occitanie", "Auvergne-Rhône-Alpes", "Provence",
  ],
  // Germany
  "276": [
    "Bayern", "Baden-Württemberg", "Nordrhein-Westfalen", "Niedersachsen",
    "Hessen", "Rheinland-Pfalz", "Sachsen", "Thüringen", "Berlin-Brandenburg",
    "Schleswig-Holstein", "Sachsen-Anhalt", "Mecklenburg",
  ],
  // United Kingdom
  "826": ["South East", "London", "South West", "Midlands", "North", "Wales", "Scotland", "Northern Ireland"],
  // Italy
  "380": [
    "Lombardia", "Piemonte", "Veneto", "Emilia-Romagna", "Toscana",
    "Lazio", "Campania", "Puglia", "Sicilia", "Sardegna",
  ],
  // Spain
  "724": [
    "Andalucía", "Cataluña", "Castilla y León", "Madrid", "Galicia",
    "Castilla-La Mancha", "País Vasco", "Aragón", "Valencia",
  ],
  // Russia
  "643": [
    "Central", "Northwest", "South", "North Caucasus", "Volga",
    "Ural", "Siberia", "Far East", "Arctic", "Crimea",
    "Kaliningrad", "Republic of Tatarstan",
  ],
  // China
  "156": [
    "Beijing", "Shanghai", "Guangdong", "Sichuan", "Henan",
    "Shandong", "Hubei", "Hunan", "Jiangsu", "Zhejiang",
    "Xinjiang", "Tibet", "Inner Mongolia", "Manchuria",
  ],
  // Japan
  "392": ["Hokkaidō", "Tōhoku", "Kantō", "Chūbu", "Kansai", "Chūgoku", "Shikoku", "Kyūshū"],
  // India
  "356": [
    "Punjab", "Rajasthan", "Gujarat", "Maharashtra", "Karnataka",
    "Kerala", "Tamil Nadu", "Andhra Pradesh", "Odisha", "West Bengal",
    "Bihar", "Uttar Pradesh", "Madhya Pradesh", "Kashmir",
  ],
  // Brazil
  "76": ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul", "Amazonas"],
  // Canada
  "124": [
    "British Columbia", "Alberta", "Prairies", "Ontario", "Québec",
    "Atlantic", "Territories",
  ],
  // Australia
  "36": ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Northern Territory"],
  // Mexico
  "484": ["Norte", "Bajío", "Centro", "Pacífico", "Golfo", "Sur", "Yucatán"],
  // Argentina
  "32": ["Pampas", "Patagonia", "Cuyo", "Norte Grande", "Mesopotamia"],
  // South Korea
  "410": ["Seoul Capital", "Gangwon", "Chungcheong", "Jeolla", "Gyeongsang", "Jeju"],
  // South Africa
  "710": ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo"],
  // Turkey
  "792": ["Marmara", "Aegean", "Mediterranean", "Central Anatolia", "Black Sea", "Eastern Anatolia", "Southeastern Anatolia"],
  // Poland
  "616": ["Mazowsze", "Małopolska", "Wielkopolska", "Śląsk", "Pomorze", "Galicja"],
  // Ukraine
  "804": ["Kyiv", "Lviv", "Odessa", "Kharkiv", "Donbas", "Crimea", "Dnipro"],
  // Egypt
  "818": ["Cairo", "Delta", "Alexandria", "Upper Egypt", "Sinai", "Western Desert"],
  // Iran
  "364": ["Tehran", "Khorasan", "Fars", "Isfahan", "Azerbaijan", "Khuzestan", "Mazandaran"],
  // Saudi Arabia
  "682": ["Riyadh", "Hejaz", "Najd", "Eastern Province", "Asir"],
  // Nigeria
  "566": ["North West", "North East", "North Central", "South West", "South East", "South South"],
  // Indonesia
  "360": ["Java", "Sumatra", "Kalimantan", "Sulawesi", "Bali & Nusa Tenggara", "Papua", "Maluku"],
  // Vietnam
  "704": ["Northern", "North Central", "Central Highlands", "South Central", "Mekong Delta", "Southeast"],
  // Pakistan
  "586": ["Punjab", "Sindh", "Khyber", "Balochistan", "Kashmir"],
  // Bangladesh
  "50": ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet"],
  // Norway
  "578": ["Østlandet", "Vestlandet", "Sørlandet", "Trøndelag", "Nord-Norge"],
  // Sweden
  "752": ["Götaland", "Svealand", "Norrland"],
  // Netherlands
  "528": ["Noord-Holland", "Zuid-Holland", "Utrecht", "Brabant", "Limburg", "Friesland"],
  // Belgium
  "56": ["Vlaanderen", "Wallonië", "Brussels"],
  // Switzerland
  "756": ["Zürich", "Bern", "Romandie", "Ticino", "Ostschweiz"],
  // Austria
  "40": ["Wien", "Niederösterreich", "Oberösterreich", "Steiermark", "Tirol", "Salzburg", "Kärnten"],
  // Czechia
  "203": ["Bohemia", "Moravia", "Silesia"],
  // Romania
  "642": ["Transilvania", "Muntenia", "Moldova", "Oltenia", "Banat", "Dobrogea"],
  // Greece
  "300": ["Attica", "Macedonia", "Thessaly", "Peloponnese", "Crete", "Aegean"],
  // Portugal
  "620": ["Norte", "Centro", "Lisboa", "Alentejo", "Algarve"],
  // Ireland
  "372": ["Leinster", "Munster", "Connacht", "Ulster"],
  // Finland
  "246": ["Uusimaa", "Lappi", "Pohjanmaa", "Pirkanmaa", "Varsinais-Suomi"],
  // Denmark
  "208": ["Hovedstaden", "Sjælland", "Syddanmark", "Midtjylland", "Nordjylland"],
  // Somalia (includes the self-declared region of Somaliland and Puntland)
  "706": ["Banaadir", "Jubaland", "South West", "Galmudug", "Hirshabeelle", "Puntland", "Somaliland"],
  // Serbia (includes Kosovo and Vojvodina as historic regions)
  "688": ["Belgrade", "Šumadija", "Vojvodina", "Southern Serbia", "Eastern Serbia", "Kosovo"],
};

const GENERIC_FALLBACK = ["Central", "North", "South", "East", "West", "Coast", "Highland"];

export function regionNamesFor(countryId: string, n: number): string[] {
  const list = HISTORICAL_REGIONS[String(Number(countryId))];
  if (list && list.length > 0) {
    return list.slice(0, Math.max(1, Math.min(list.length, n)));
  }
  if (n <= 1) return ["Capital Region"];
  return GENERIC_FALLBACK.slice(0, n);
}

export function preferredProvinceCount(countryId: string, fallback: number): number {
  const list = HISTORICAL_REGIONS[String(Number(countryId))];
  if (list) return list.length;
  return fallback;
}
