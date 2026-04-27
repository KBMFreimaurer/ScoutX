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

const VERBAND_BY_STATE = {
  BW: "Württemberg/Baden/Südbaden",
  BY: "BFV",
  BE: "BFV Berlin",
  BB: "FLB",
  HB: "BFV Bremen",
  HH: "HFV",
  HE: "HFV Hessen",
  MV: "LFV MV",
  NI: "NFV",
  NW: "FVN/FLVW/FVM",
  RP: "SWFV/FVR",
  SL: "SFV",
  SN: "SFV Sachsen",
  ST: "FSA",
  SH: "SHFV",
  TH: "TFV",
};

const REGION_SETS = {
  BW: [
    ["Stuttgart", "S"],
    ["Karlsruhe", "KA"],
    ["Mannheim", "MA"],
    ["Heidelberg", "HD"],
    ["Freiburg im Breisgau", "FR"],
    ["Ulm", "UL"],
    ["Heilbronn", "HN"],
    ["Pforzheim", "PF"],
    ["Ludwigsburg", "LB"],
    ["Esslingen", "ES"],
    ["Böblingen", "BB"],
    ["Tübingen", "TUE"],
    ["Reutlingen", "RT"],
    ["Rhein-Neckar-Kreis", "RNK"],
  ],
  BY: [
    ["München", "M"],
    ["Nürnberg", "N"],
    ["Augsburg", "A"],
    ["Regensburg", "R"],
    ["Ingolstadt", "IN"],
    ["Würzburg", "WUE"],
    ["Fürth", "FUE"],
    ["Erlangen", "ER"],
    ["Bayreuth", "BT"],
    ["Bamberg", "BA"],
    ["Rosenheim", "RO"],
    ["Landshut", "LA"],
    ["Passau", "PA"],
    ["Aschaffenburg", "AB"],
  ],
  BE: [
    ["Berlin", "B"],
    ["Mitte", "B-MI", "bezirk"],
    ["Pankow", "B-PK", "bezirk"],
    ["Neukölln", "B-NK", "bezirk"],
    ["Charlottenburg-Wilmersdorf", "B-CW", "bezirk"],
    ["Friedrichshain-Kreuzberg", "B-FK", "bezirk"],
    ["Spandau", "B-SP", "bezirk"],
    ["Reinickendorf", "B-RD", "bezirk"],
    ["Tempelhof-Schöneberg", "B-TS", "bezirk"],
  ],
  BB: [
    ["Potsdam", "P"],
    ["Cottbus", "CB"],
    ["Brandenburg an der Havel", "BRB"],
    ["Frankfurt (Oder)", "FF"],
    ["Potsdam-Mittelmark", "PM"],
    ["Havelland", "HVL"],
    ["Oberhavel", "OHV"],
    ["Barnim", "BAR"],
    ["Dahme-Spreewald", "LDS"],
    ["Teltow-Fläming", "TF"],
  ],
  HB: [
    ["Bremen", "HB"],
    ["Bremerhaven", "BHV"],
  ],
  HH: [
    ["Hamburg", "HH"],
    ["Hamburg-Mitte", "HH-M", "bezirk"],
    ["Altona", "HH-A", "bezirk"],
    ["Eimsbüttel", "HH-E", "bezirk"],
    ["Hamburg-Nord", "HH-N", "bezirk"],
    ["Wandsbek", "HH-W", "bezirk"],
    ["Bergedorf", "HH-B", "bezirk"],
    ["Harburg", "HH-H", "bezirk"],
  ],
  HE: [
    ["Frankfurt am Main", "F"],
    ["Wiesbaden", "WI"],
    ["Kassel", "KS"],
    ["Darmstadt", "DA"],
    ["Offenbach am Main", "OF"],
    ["Main-Taunus-Kreis", "MTK"],
    ["Hochtaunuskreis", "HG"],
    ["Main-Kinzig-Kreis", "MKK"],
    ["Groß-Gerau", "GG"],
    ["Gießen", "GI"],
    ["Marburg-Biedenkopf", "MR"],
    ["Fulda", "FD"],
  ],
  MV: [
    ["Rostock", "HRO"],
    ["Schwerin", "SN"],
    ["Vorpommern-Greifswald", "VG"],
    ["Vorpommern-Rügen", "VR"],
    ["Mecklenburgische Seenplatte", "MSE"],
    ["Landkreis Rostock", "LRO"],
    ["Ludwigslust-Parchim", "LUP"],
    ["Nordwestmecklenburg", "NWM"],
  ],
  NI: [
    ["Hannover / Region Hannover", "H"],
    ["Braunschweig", "BS"],
    ["Osnabrück", "OS"],
    ["Oldenburg", "OL"],
    ["Wolfsburg", "WOB"],
    ["Göttingen", "GOE"],
    ["Hildesheim", "HI"],
    ["Salzgitter", "SZ"],
    ["Celle", "CE"],
    ["Lüneburg", "LG"],
    ["Emsland", "EL"],
    ["Harburg", "WL"],
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
    ["Mainz", "MZ"],
    ["Ludwigshafen am Rhein", "LU"],
    ["Koblenz", "KO"],
    ["Trier", "TR"],
    ["Kaiserslautern", "KL"],
    ["Worms", "WO"],
    ["Speyer", "SP"],
    ["Mainz-Bingen", "MZB"],
    ["Rhein-Pfalz-Kreis", "RPK"],
    ["Bad Kreuznach", "KH"],
    ["Mayen-Koblenz", "MYK"],
  ],
  SL: [
    ["Regionalverband Saarbrücken", "SB"],
    ["Saarlouis", "SLS"],
    ["Merzig-Wadern", "MZG"],
    ["Neunkirchen", "NK"],
    ["Saarpfalz-Kreis", "SPK"],
    ["St. Wendel", "WND"],
  ],
  SN: [
    ["Leipzig", "L"],
    ["Dresden", "DD"],
    ["Chemnitz", "C"],
    ["Zwickau", "Z"],
    ["Vogtlandkreis", "V"],
    ["Görlitz", "GR"],
    ["Bautzen", "BZ"],
    ["Meißen", "MEI"],
    ["Mittelsachsen", "MSN"],
    ["Erzgebirgskreis", "ERZ"],
    ["Landkreis Leipzig", "LL"],
  ],
  ST: [
    ["Magdeburg", "MD"],
    ["Halle (Saale)", "HAL"],
    ["Dessau-Roßlau", "DE"],
    ["Harz", "HZ"],
    ["Saalekreis", "SK"],
    ["Burgenlandkreis", "BLK"],
    ["Anhalt-Bitterfeld", "ABI"],
    ["Mansfeld-Südharz", "MSH"],
    ["Stendal", "SDL"],
    ["Börde", "BK"],
  ],
  SH: [
    ["Kiel", "KI"],
    ["Lübeck", "HL"],
    ["Flensburg", "FL"],
    ["Neumünster", "NMS"],
    ["Pinneberg", "PI"],
    ["Segeberg", "SE"],
    ["Stormarn", "OD"],
    ["Herzogtum Lauenburg", "RZ"],
    ["Rendsburg-Eckernförde", "RD"],
    ["Schleswig-Flensburg", "SL"],
    ["Ostholstein", "OH"],
    ["Nordfriesland", "NF"],
  ],
  TH: [
    ["Erfurt", "EF"],
    ["Jena", "J"],
    ["Gera", "G"],
    ["Weimar", "WE"],
    ["Eisenach / Wartburgkreis", "WAK"],
    ["Gotha", "GTH"],
    ["Ilm-Kreis", "IK"],
    ["Saalfeld-Rudolstadt", "SLF"],
    ["Saale-Orla-Kreis", "SOK"],
    ["Saale-Holzland-Kreis", "SHK"],
    ["Nordhausen", "NDH"],
  ],
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeRegion(stateCode, entry, index) {
  const [name, shortCode, type = "region", legacyId = "", verband = VERBAND_BY_STATE[stateCode]] = entry;
  const id = legacyId || `${stateCode.toLowerCase()}-${slugify(shortCode || name)}`;
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
    fussballDeMapping: {
      searchName: name,
      verband,
      kreis: type === "kreis" ? name : "",
      region: type !== "kreis" ? name : "",
      areaKeywords: [name],
    },
    enabled: true,
    priority: index + 1,
  };
}

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
