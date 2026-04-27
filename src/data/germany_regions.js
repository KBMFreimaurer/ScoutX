const STATE_NAMES = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

// Mandant-Codes der Landesverbände auf fussball.de.
// Diese werden in URLs wie wam_kinds_<mandant>_<saison>_<typ>.json verwendet
// und bestimmen, welcher Verband abgefragt wird. FVN=22 ist verifiziert; weitere
// Codes basieren auf den auf fussball.de gepflegten Verbandskennzahlen und können
// per Mapping-Override (siehe FUSSBALLDE_MANDANT) angepasst werden.
const VERBANDS = {
  SHFV: { code: "SHFV", label: "Schleswig-Holsteinischer FV", mandant: "01", areaKeyword: "schleswig" },
  NFV: { code: "NFV", label: "Niedersächsischer FV", mandant: "02", areaKeyword: "niedersachsen" },
  HFV_HH: { code: "HFV", label: "Hamburger FV", mandant: "03", areaKeyword: "hamburg" },
  BFV_HB: { code: "BFV Bremen", label: "Bremer FV", mandant: "04", areaKeyword: "bremen" },
  FLVW: { code: "FLVW", label: "FLVW Westfalen", mandant: "05", areaKeyword: "westfalen" },
  FLB: { code: "FLB", label: "Fußball-Landesverband Brandenburg", mandant: "06", areaKeyword: "brandenburg" },
  FVM: { code: "FVM", label: "Fußball-Verband Mittelrhein", mandant: "07", areaKeyword: "mittelrhein" },
  LFV_MV: { code: "LFV MV", label: "Landesfußballverband Mecklenburg-Vorpommern", mandant: "08", areaKeyword: "mecklenburg" },
  TFV: { code: "TFV", label: "Thüringer Fußball-Verband", mandant: "09", areaKeyword: "thuringen" },
  SFV_SN: { code: "SFV Sachsen", label: "Sächsischer Fußball-Verband", mandant: "11", areaKeyword: "sachsen" },
  SBFV: { code: "SBFV", label: "Südbadischer Fußball-Verband", mandant: "12", areaKeyword: "sudbaden" },
  FSA: { code: "FSA", label: "Fußballverband Sachsen-Anhalt", mandant: "13", areaKeyword: "sachsen-anhalt" },
  HFV_HE: { code: "HFV Hessen", label: "Hessischer Fußball-Verband", mandant: "15", areaKeyword: "hessen" },
  SWFV: { code: "SWFV", label: "Südwestdeutscher Fußballverband", mandant: "17", areaKeyword: "sudwest" },
  BFV_BY: { code: "BFV", label: "Bayerischer Fußball-Verband", mandant: "21", areaKeyword: "bayern" },
  FVN: { code: "FVN", label: "Fußballverband Niederrhein", mandant: "22", areaKeyword: "niederrhein" },
  SFV_SL: { code: "SFV Saar", label: "Saarländischer Fußballverband", mandant: "23", areaKeyword: "saarland" },
  FVR: { code: "FVR", label: "Fußballverband Rheinland", mandant: "25", areaKeyword: "rheinland" },
  BFV_BE: { code: "BFV Berlin", label: "Berliner Fußball-Verband", mandant: "27", areaKeyword: "berlin" },
  WFV: { code: "WFV", label: "Württembergischer Fußballverband", mandant: "32", areaKeyword: "wurttemberg" },
  BFV_BA: { code: "BFV Baden", label: "Badischer Fußballverband", mandant: "33", areaKeyword: "baden" },
};

const STATE_DEFAULT_VERBAND = {
  SH: "SHFV",
  NI: "NFV",
  HH: "HFV_HH",
  HB: "BFV_HB",
  BB: "FLB",
  MV: "LFV_MV",
  TH: "TFV",
  SN: "SFV_SN",
  ST: "FSA",
  HE: "HFV_HE",
  BY: "BFV_BY",
  BE: "BFV_BE",
  SL: "SFV_SL",
  RP: "SWFV",
  NW: "FVN",
  BW: "WFV",
};

function getVerband(verbandKey) {
  if (!verbandKey) {
    return null;
  }
  if (typeof verbandKey === "object") {
    return verbandKey;
  }
  return VERBANDS[String(verbandKey)] || null;
}

const REGION_SETS = {
  BW: [
    ["Stuttgart", "S", "kreis", "", "WFV"],
    ["Heilbronn", "HN", "kreis", "", "WFV"],
    ["Ludwigsburg", "LB", "kreis", "", "WFV"],
    ["Esslingen", "ES", "kreis", "", "WFV"],
    ["Böblingen", "BB", "kreis", "", "WFV"],
    ["Tübingen", "TUE", "kreis", "", "WFV"],
    ["Reutlingen", "RT", "kreis", "", "WFV"],
    ["Ulm", "UL", "kreis", "", "WFV"],
    ["Karlsruhe", "KA", "kreis", "", "BFV_BA"],
    ["Mannheim", "MA", "kreis", "", "BFV_BA"],
    ["Heidelberg", "HD", "kreis", "", "BFV_BA"],
    ["Pforzheim", "PF", "kreis", "", "BFV_BA"],
    ["Rhein-Neckar-Kreis", "RNK", "kreis", "", "BFV_BA"],
    ["Freiburg im Breisgau", "FR", "kreis", "", "SBFV"],
  ],
  BY: [
    ["München", "M", "kreis", "", "BFV_BY"],
    ["Nürnberg", "N", "kreis", "", "BFV_BY"],
    ["Augsburg", "A", "kreis", "", "BFV_BY"],
    ["Regensburg", "R", "kreis", "", "BFV_BY"],
    ["Ingolstadt", "IN", "kreis", "", "BFV_BY"],
    ["Würzburg", "WUE", "kreis", "", "BFV_BY"],
    ["Fürth", "FUE", "kreis", "", "BFV_BY"],
    ["Erlangen", "ER", "kreis", "", "BFV_BY"],
    ["Bayreuth", "BT", "kreis", "", "BFV_BY"],
    ["Bamberg", "BA", "kreis", "", "BFV_BY"],
    ["Rosenheim", "RO", "kreis", "", "BFV_BY"],
    ["Landshut", "LA", "kreis", "", "BFV_BY"],
    ["Passau", "PA", "kreis", "", "BFV_BY"],
    ["Aschaffenburg", "AB", "kreis", "", "BFV_BY"],
  ],
  BE: [
    ["Berlin", "B", "region", "", "BFV_BE"],
    ["Mitte", "B-MI", "bezirk", "", "BFV_BE"],
    ["Pankow", "B-PK", "bezirk", "", "BFV_BE"],
    ["Neukölln", "B-NK", "bezirk", "", "BFV_BE"],
    ["Charlottenburg-Wilmersdorf", "B-CW", "bezirk", "", "BFV_BE"],
    ["Friedrichshain-Kreuzberg", "B-FK", "bezirk", "", "BFV_BE"],
    ["Spandau", "B-SP", "bezirk", "", "BFV_BE"],
    ["Reinickendorf", "B-RD", "bezirk", "", "BFV_BE"],
    ["Tempelhof-Schöneberg", "B-TS", "bezirk", "", "BFV_BE"],
  ],
  BB: [
    ["Potsdam", "P", "kreis", "", "FLB"],
    ["Cottbus", "CB", "kreis", "", "FLB"],
    ["Brandenburg an der Havel", "BRB", "kreis", "", "FLB"],
    ["Frankfurt (Oder)", "FF", "kreis", "", "FLB"],
    ["Potsdam-Mittelmark", "PM", "kreis", "", "FLB"],
    ["Havelland", "HVL", "kreis", "", "FLB"],
    ["Oberhavel", "OHV", "kreis", "", "FLB"],
    ["Barnim", "BAR", "kreis", "", "FLB"],
    ["Dahme-Spreewald", "LDS", "kreis", "", "FLB"],
    ["Teltow-Fläming", "TF", "kreis", "", "FLB"],
  ],
  HB: [
    ["Bremen", "HB", "region", "", "BFV_HB"],
    ["Bremerhaven", "BHV", "region", "", "BFV_HB"],
  ],
  HH: [
    ["Hamburg", "HH", "region", "", "HFV_HH"],
    ["Hamburg-Mitte", "HH-M", "bezirk", "", "HFV_HH"],
    ["Altona", "HH-A", "bezirk", "", "HFV_HH"],
    ["Eimsbüttel", "HH-E", "bezirk", "", "HFV_HH"],
    ["Hamburg-Nord", "HH-N", "bezirk", "", "HFV_HH"],
    ["Wandsbek", "HH-W", "bezirk", "", "HFV_HH"],
    ["Bergedorf", "HH-B", "bezirk", "", "HFV_HH"],
    ["Harburg", "HH-H", "bezirk", "", "HFV_HH"],
  ],
  HE: [
    ["Frankfurt am Main", "F", "kreis", "", "HFV_HE"],
    ["Wiesbaden", "WI", "kreis", "", "HFV_HE"],
    ["Kassel", "KS", "kreis", "", "HFV_HE"],
    ["Darmstadt", "DA", "kreis", "", "HFV_HE"],
    ["Offenbach am Main", "OF", "kreis", "", "HFV_HE"],
    ["Main-Taunus-Kreis", "MTK", "kreis", "", "HFV_HE"],
    ["Hochtaunuskreis", "HG", "kreis", "", "HFV_HE"],
    ["Main-Kinzig-Kreis", "MKK", "kreis", "", "HFV_HE"],
    ["Groß-Gerau", "GG", "kreis", "", "HFV_HE"],
    ["Gießen", "GI", "kreis", "", "HFV_HE"],
    ["Marburg-Biedenkopf", "MR", "kreis", "", "HFV_HE"],
    ["Fulda", "FD", "kreis", "", "HFV_HE"],
  ],
  MV: [
    ["Rostock", "HRO", "kreis", "", "LFV_MV"],
    ["Schwerin", "SN", "kreis", "", "LFV_MV"],
    ["Vorpommern-Greifswald", "VG", "kreis", "", "LFV_MV"],
    ["Vorpommern-Rügen", "VR", "kreis", "", "LFV_MV"],
    ["Mecklenburgische Seenplatte", "MSE", "kreis", "", "LFV_MV"],
    ["Landkreis Rostock", "LRO", "kreis", "", "LFV_MV"],
    ["Ludwigslust-Parchim", "LUP", "kreis", "", "LFV_MV"],
    ["Nordwestmecklenburg", "NWM", "kreis", "", "LFV_MV"],
  ],
  NI: [
    ["Hannover / Region Hannover", "H", "kreis", "", "NFV"],
    ["Braunschweig", "BS", "kreis", "", "NFV"],
    ["Osnabrück", "OS", "kreis", "", "NFV"],
    ["Oldenburg", "OL", "kreis", "", "NFV"],
    ["Wolfsburg", "WOB", "kreis", "", "NFV"],
    ["Göttingen", "GOE", "kreis", "", "NFV"],
    ["Hildesheim", "HI", "kreis", "", "NFV"],
    ["Salzgitter", "SZ", "kreis", "", "NFV"],
    ["Celle", "CE", "kreis", "", "NFV"],
    ["Lüneburg", "LG", "kreis", "", "NFV"],
    ["Emsland", "EL", "kreis", "", "NFV"],
    ["Harburg", "WL", "kreis", "", "NFV"],
  ],
  NW: [
    ["Düsseldorf", "DU", "kreis", "duesseldorf", "FVN"],
    ["Duisburg", "DUI", "kreis", "duisburg", "FVN"],
    ["Essen", "ES", "kreis", "essen", "FVN"],
    ["Krefeld", "KR", "kreis", "krefeld", "FVN"],
    ["Mönchengladbach", "MG", "kreis", "moenchen", "FVN"],
    ["Neuss/Grevenbroich", "NE", "kreis", "neuss", "FVN"],
    ["Oberhausen", "OB", "kreis", "oberhausen", "FVN"],
    ["Viersen", "VIE", "kreis", "viersen", "FVN"],
    ["Wesel", "WES", "kreis", "wesel", "FVN"],
    ["Kleve/Geldern", "KLE", "kreis", "kleve", "FVN"],
  ],
  RP: [
    ["Mainz", "MZ", "kreis", "", "SWFV"],
    ["Ludwigshafen am Rhein", "LU", "kreis", "", "SWFV"],
    ["Kaiserslautern", "KL", "kreis", "", "SWFV"],
    ["Worms", "WO", "kreis", "", "SWFV"],
    ["Speyer", "SP", "kreis", "", "SWFV"],
    ["Mainz-Bingen", "MZB", "kreis", "", "SWFV"],
    ["Rhein-Pfalz-Kreis", "RPK", "kreis", "", "SWFV"],
    ["Bad Kreuznach", "KH", "kreis", "", "SWFV"],
    ["Koblenz", "KO", "kreis", "", "FVR"],
    ["Trier", "TR", "kreis", "", "FVR"],
    ["Mayen-Koblenz", "MYK", "kreis", "", "FVR"],
  ],
  SL: [
    ["Regionalverband Saarbrücken", "SB", "kreis", "", "SFV_SL"],
    ["Saarlouis", "SLS", "kreis", "", "SFV_SL"],
    ["Merzig-Wadern", "MZG", "kreis", "", "SFV_SL"],
    ["Neunkirchen", "NK", "kreis", "", "SFV_SL"],
    ["Saarpfalz-Kreis", "SPK", "kreis", "", "SFV_SL"],
    ["St. Wendel", "WND", "kreis", "", "SFV_SL"],
  ],
  SN: [
    ["Leipzig", "L", "kreis", "", "SFV_SN"],
    ["Dresden", "DD", "kreis", "", "SFV_SN"],
    ["Chemnitz", "C", "kreis", "", "SFV_SN"],
    ["Zwickau", "Z", "kreis", "", "SFV_SN"],
    ["Vogtlandkreis", "V", "kreis", "", "SFV_SN"],
    ["Görlitz", "GR", "kreis", "", "SFV_SN"],
    ["Bautzen", "BZ", "kreis", "", "SFV_SN"],
    ["Meißen", "MEI", "kreis", "", "SFV_SN"],
    ["Mittelsachsen", "MSN", "kreis", "", "SFV_SN"],
    ["Erzgebirgskreis", "ERZ", "kreis", "", "SFV_SN"],
    ["Landkreis Leipzig", "LL", "kreis", "", "SFV_SN"],
  ],
  ST: [
    ["Magdeburg", "MD", "kreis", "", "FSA"],
    ["Halle (Saale)", "HAL", "kreis", "", "FSA"],
    ["Dessau-Roßlau", "DE", "kreis", "", "FSA"],
    ["Harz", "HZ", "kreis", "", "FSA"],
    ["Saalekreis", "SK", "kreis", "", "FSA"],
    ["Burgenlandkreis", "BLK", "kreis", "", "FSA"],
    ["Anhalt-Bitterfeld", "ABI", "kreis", "", "FSA"],
    ["Mansfeld-Südharz", "MSH", "kreis", "", "FSA"],
    ["Stendal", "SDL", "kreis", "", "FSA"],
    ["Börde", "BK", "kreis", "", "FSA"],
  ],
  SH: [
    ["Kiel", "KI", "kreis", "", "SHFV"],
    ["Lübeck", "HL", "kreis", "", "SHFV"],
    ["Flensburg", "FL", "kreis", "", "SHFV"],
    ["Neumünster", "NMS", "kreis", "", "SHFV"],
    ["Pinneberg", "PI", "kreis", "", "SHFV"],
    ["Segeberg", "SE", "kreis", "", "SHFV"],
    ["Stormarn", "OD", "kreis", "", "SHFV"],
    ["Herzogtum Lauenburg", "RZ", "kreis", "", "SHFV"],
    ["Rendsburg-Eckernförde", "RD", "kreis", "", "SHFV"],
    ["Schleswig-Flensburg", "SL", "kreis", "", "SHFV"],
    ["Ostholstein", "OH", "kreis", "", "SHFV"],
    ["Nordfriesland", "NF", "kreis", "", "SHFV"],
  ],
  TH: [
    ["Erfurt", "EF", "kreis", "", "TFV"],
    ["Jena", "J", "kreis", "", "TFV"],
    ["Gera", "G", "kreis", "", "TFV"],
    ["Weimar", "WE", "kreis", "", "TFV"],
    ["Eisenach / Wartburgkreis", "WAK", "kreis", "", "TFV"],
    ["Gotha", "GTH", "kreis", "", "TFV"],
    ["Ilm-Kreis", "IK", "kreis", "", "TFV"],
    ["Saalfeld-Rudolstadt", "SLF", "kreis", "", "TFV"],
    ["Saale-Orla-Kreis", "SOK", "kreis", "", "TFV"],
    ["Saale-Holzland-Kreis", "SHK", "kreis", "", "TFV"],
    ["Nordhausen", "NDH", "kreis", "", "TFV"],
  ],
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildRegionAreaKeywords(name, shortCode, legacyId, verband) {
  const keywords = new Set();
  const normalizedName = slugify(name).replace(/-/g, " ").trim();
  const segments = normalizedName.split(" ").filter(Boolean);

  for (const segment of segments) {
    if (segment.length >= 4) {
      keywords.add(segment);
    }
  }

  if (normalizedName) {
    keywords.add(normalizedName);
  }

  if (legacyId) {
    keywords.add(slugify(legacyId).replace(/-/g, " "));
  }

  // Variants for cities with umlauts that fussball.de may write differently.
  const variantMap = {
    munchen: ["munchen", "muenchen"],
    nurnberg: ["nurnberg", "nuernberg"],
    wurzburg: ["wurzburg", "wuerzburg"],
    furth: ["furth", "fuerth"],
    monchengladbach: ["monchengladbach", "moenchengladbach"],
    dusseldorf: ["dusseldorf", "duesseldorf"],
    osnabruck: ["osnabruck", "osnabrueck"],
    saarbrucken: ["saarbrucken", "saarbruecken"],
    luneburg: ["luneburg", "lueneburg"],
    gottingen: ["gottingen", "goettingen"],
    tubingen: ["tubingen", "tuebingen"],
    rosslau: ["rosslau", "russlau"],
  };

  for (const segment of [...keywords]) {
    const variants = variantMap[segment];
    if (variants) {
      for (const variant of variants) {
        keywords.add(variant);
      }
    }
  }

  if (verband?.code) {
    keywords.add(slugify(verband.code).replace(/-/g, " "));
  }

  return [...keywords].filter(Boolean);
}

function makeRegion(stateCode, entry, index) {
  const [name, shortCode, type = "region", legacyId = "", verbandKey = STATE_DEFAULT_VERBAND[stateCode]] = entry;
  const id = legacyId || `${stateCode.toLowerCase()}-${slugify(shortCode || name)}`;
  const verband = getVerband(verbandKey);
  const verbandCode = verband?.code || verbandKey || "";
  const verbandLabel = verband?.label || verbandCode;
  const areaKeywords = buildRegionAreaKeywords(name, shortCode, legacyId, verband);

  // City-state Verbände (Berlin/Hamburg/Bremen) und Bundesland-Auswahlen ohne
  // dedizierte Kreisstruktur dürfen auf den verbandsweiten Spielbetrieb fallen,
  // damit der Spielplan auch dort funktioniert. Reine Bezirks-Mappings sollen
  // dagegen nicht den ganzen Landesverband crawlen.
  const allowRegionalFallback =
    type === "region" || (type === "kreis" && ["BE", "HH", "HB"].includes(stateCode));

  return {
    id,
    name,
    label: name,
    displayName: name,
    kurz: shortCode,
    shortCode,
    type,
    stateCode,
    stateName: STATE_NAMES[stateCode],
    verband: verbandCode,
    verbandLabel,
    fussballDeMapping: {
      searchName: name,
      verband: verbandCode,
      verbandLabel,
      mandant: verband?.mandant || "",
      kreis: type === "kreis" ? name : "",
      region: type !== "kreis" ? name : "",
      areaKeywords,
      allowRegionalFallback,
    },
    enabled: true,
    priority: index + 1,
  };
}

export const GERMANY_VERBANDS = VERBANDS;
export const GERMANY_STATES = Object.entries(STATE_NAMES).map(([stateCode, stateName]) => ({
  code: stateCode,
  name: stateName,
  regions: (REGION_SETS[stateCode] || []).map((entry, index) => makeRegion(stateCode, entry, index)),
}));

export const GERMANY_REGIONS = GERMANY_STATES.flatMap((state) => state.regions);
export const LEGACY_NRW_REGION_IDS = new Set(REGION_SETS.NW.map((entry) => entry[3]).filter(Boolean));

export function getStateByCode(stateCode) {
  const code = String(stateCode || "").trim().toUpperCase();
  return GERMANY_STATES.find((state) => state.code === code) || null;
}

export function getRegionsByState(stateCode) {
  return getStateByCode(stateCode)?.regions || [];
}

export function getRegionById(regionId) {
  const id = String(regionId || "").trim();
  return GERMANY_REGIONS.find((region) => region.id === id) || null;
}

export function getRegionByStateAndShortCode(stateCode, shortCode) {
  const code = String(shortCode || "").trim().toUpperCase();
  return getRegionsByState(stateCode).find((region) => region.shortCode === code) || null;
}

export function inferStateCodeFromRegionIds(regionIds, fallback = "") {
  const ids = Array.isArray(regionIds) ? regionIds : [regionIds];
  for (const id of ids) {
    const region = getRegionById(id);
    if (region?.stateCode) {
      return region.stateCode;
    }
  }
  return String(fallback || "").trim().toUpperCase();
}
