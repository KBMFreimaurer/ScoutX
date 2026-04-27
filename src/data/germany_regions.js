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

// Bezirks-Zuordnung für Verbände, die ihre Kreise unter Bezirken gruppieren.
// Diese Tokens erscheinen in fussball.de-Bereichslabels wie "Bezirk Oberbayern"
// und erweitern die Trefferquote analog zu den Niederrhein-Keywords
// (Beispiel Duisburg: ["duisburg","mulheim","dinslak"] → matched
// "Kreis Duisburg-Mülheim-Dinslaken").
const STATE_BEZIRK_BY_SHORTCODE = {
  BY: {
    M: "oberbayern",
    IN: "oberbayern",
    RO: "oberbayern",
    N: "mittelfranken",
    FUE: "mittelfranken",
    ER: "mittelfranken",
    A: "schwaben",
    R: "oberpfalz",
    WUE: "unterfranken",
    AB: "unterfranken",
    BT: "oberfranken",
    BA: "oberfranken",
    LA: "niederbayern",
    PA: "niederbayern",
  },
  NI: {
    H: "hannover",
    BS: "braunschweig",
    WOB: "braunschweig",
    HI: "braunschweig",
    GOE: "braunschweig",
    SZ: "braunschweig",
    LG: "luneburg",
    WL: "luneburg",
    CE: "luneburg",
    OS: "weser ems",
    OL: "weser ems",
    EL: "weser ems",
  },
  BW: {
    S: "stuttgart",
    HN: "stuttgart",
    LB: "stuttgart",
    ES: "stuttgart",
    BB: "stuttgart",
    TUE: "alb",
    RT: "alb",
    UL: "donau",
    KA: "karlsruhe",
    MA: "mannheim",
    HD: "mannheim",
    PF: "pforzheim",
    RNK: "mannheim",
    FR: "freiburg",
  },
  RP: {
    MZ: "rheinhessen",
    LU: "vorderpfalz",
    KL: "westpfalz",
    WO: "rheinhessen",
    SP: "vorderpfalz",
    MZB: "rheinhessen",
    RPK: "vorderpfalz",
    KH: "rheinhessen",
    KO: "rhein lahn",
    TR: "mosel",
    MYK: "rhein lahn",
  },
  HE: {
    F: "sud",
    WI: "sud",
    OF: "sud",
    DA: "sud",
    MTK: "sud",
    HG: "sud",
    MKK: "sud",
    GG: "sud",
    GI: "mitte",
    MR: "mitte",
    KS: "nord",
    FD: "mitte",
  },
};

// Explizite Area-Keywords pro Region (mirroring NRW-Duisburg-Pattern).
// Wenn fussball.de eine Region in einem zusammengesetzten Kreis-Label führt
// (z. B. "Kreis Duisburg-Mülheim-Dinslaken"), listen wir hier alle Tokens, die
// im Label vorkommen können. Greift, falls auto-generierte Keywords nicht
// reichen.
const REGION_KEYWORD_OVERRIDES = {
  // NRW (FVN) – wie bisher, jetzt zentral hier gepflegt:
  duesseldorf: ["dusseldorf", "duesseldorf"],
  duisburg: ["duisburg", "mulheim", "dinslak"],
  essen: ["essen"],
  krefeld: ["krefeld", "kempen"],
  moenchen: ["monchengladbach", "moenchengladbach", "viersen"],
  neuss: ["neuss", "grevenbroich"],
  oberhausen: ["oberhausen", "bottrop"],
  viersen: ["viersen", "monchengladbach", "moenchengladbach"],
  wesel: ["wesel", "moers", "rees", "bocholt"],
  kleve: ["kleve", "geldern", "rees", "bocholt"],
  // BY (BFV) – Stadt-Kreise und ihre Bezirke
  "by-m": ["munchen", "muenchen", "munchen stadt", "munchen land", "oberbayern"],
  "by-n": ["nurnberg", "nuernberg", "mittelfranken"],
  "by-fue": ["furth", "fuerth", "mittelfranken"],
  "by-er": ["erlangen", "pegnitzgrund", "mittelfranken"],
  "by-a": ["augsburg", "schwaben"],
  "by-r": ["regensburg", "oberpfalz"],
  "by-in": ["ingolstadt", "donau isar", "oberbayern"],
  "by-wue": ["wurzburg", "wuerzburg", "unterfranken"],
  "by-ab": ["aschaffenburg", "untermain", "unterfranken"],
  "by-bt": ["bayreuth", "oberfranken"],
  "by-ba": ["bamberg", "oberfranken"],
  "by-ro": ["rosenheim", "inn salzach", "oberbayern"],
  "by-la": ["landshut", "niederbayern"],
  "by-pa": ["passau", "niederbayern"],
  // NI (NFV) – Kreise mit Bezirk
  "ni-h": ["hannover", "region hannover"],
  "ni-bs": ["braunschweig"],
  "ni-os": ["osnabruck", "osnabrueck", "weser ems"],
  "ni-ol": ["oldenburg", "weser ems"],
  "ni-wob": ["wolfsburg", "braunschweig"],
  "ni-goe": ["gottingen", "goettingen", "braunschweig"],
  "ni-hi": ["hildesheim", "braunschweig"],
  "ni-sz": ["salzgitter", "braunschweig"],
  "ni-ce": ["celle", "luneburg", "lueneburg"],
  "ni-lg": ["luneburg", "lueneburg"],
  "ni-el": ["emsland", "weser ems"],
  "ni-wl": ["harburg", "luneburg", "lueneburg"],
  // SH (SHFV) – Kreis-basiert, plain
  "sh-ki": ["kiel"],
  "sh-hl": ["lubeck", "luebeck"],
  "sh-fl": ["flensburg"],
  "sh-nms": ["neumunster", "neumuenster"],
  "sh-pi": ["pinneberg"],
  "sh-se": ["segeberg"],
  "sh-od": ["stormarn"],
  "sh-rz": ["lauenburg", "herzogtum lauenburg"],
  "sh-rd": ["rendsburg", "eckernforde", "eckernfoerde"],
  "sh-sl": ["schleswig", "flensburg"],
  "sh-oh": ["ostholstein"],
  "sh-nf": ["nordfriesland"],
  // HE (HFV) – mit Region/Bezirk Süd/Mitte/Nord
  "he-f": ["frankfurt", "main", "sud"],
  "he-wi": ["wiesbaden", "sud"],
  "he-ks": ["kassel", "nord"],
  "he-da": ["darmstadt", "sud"],
  "he-of": ["offenbach", "sud"],
  "he-mtk": ["main taunus", "sud"],
  "he-hg": ["hochtaunus", "taunus", "sud"],
  "he-mkk": ["main kinzig", "sud"],
  "he-gg": ["gross gerau", "sud"],
  "he-gi": ["giessen", "mitte"],
  "he-mr": ["marburg", "biedenkopf", "mitte"],
  "he-fd": ["fulda", "mitte"],
  // BB (FLB) – Brandenburg, plain Kreise
  "bb-p": ["potsdam"],
  "bb-cb": ["cottbus", "spree neisse"],
  "bb-brb": ["brandenburg", "havel"],
  "bb-ff": ["frankfurt oder", "oder"],
  "bb-pm": ["potsdam mittelmark"],
  "bb-hvl": ["havelland"],
  "bb-ohv": ["oberhavel"],
  "bb-bar": ["barnim"],
  "bb-lds": ["dahme", "spreewald"],
  "bb-tf": ["teltow", "flaming", "flaeming"],
  // MV (LFV-MV) – Kreise
  "mv-hro": ["rostock"],
  "mv-sn": ["schwerin"],
  "mv-vg": ["vorpommern greifswald", "greifswald"],
  "mv-vr": ["vorpommern rugen", "ruegen", "rugen"],
  "mv-mse": ["mecklenburgische seenplatte", "seenplatte"],
  "mv-lro": ["landkreis rostock"],
  "mv-lup": ["ludwigslust", "parchim"],
  "mv-nwm": ["nordwestmecklenburg"],
  // SN (SFV Sachsen) – Kreise
  "sn-l": ["leipzig"],
  "sn-dd": ["dresden"],
  "sn-c": ["chemnitz"],
  "sn-z": ["zwickau"],
  "sn-v": ["vogtland"],
  "sn-gr": ["gorlitz", "goerlitz"],
  "sn-bz": ["bautzen"],
  "sn-mei": ["meissen", "meisen"],
  "sn-msn": ["mittelsachsen"],
  "sn-erz": ["erzgebirge"],
  "sn-ll": ["landkreis leipzig"],
  // ST (FSA) – Kreise
  "st-md": ["magdeburg"],
  "st-hal": ["halle", "saale"],
  "st-de": ["dessau", "rosslau", "russlau"],
  "st-hz": ["harz"],
  "st-sk": ["saalekreis", "saale"],
  "st-blk": ["burgenlandkreis"],
  "st-abi": ["anhalt", "bitterfeld"],
  "st-msh": ["mansfeld", "sudharz", "suedharz"],
  "st-sdl": ["stendal"],
  "st-bk": ["borde", "boerde"],
  // TH (TFV) – Kreise
  "th-ef": ["erfurt"],
  "th-j": ["jena"],
  "th-g": ["gera"],
  "th-we": ["weimar"],
  "th-wak": ["eisenach", "wartburg"],
  "th-gth": ["gotha"],
  "th-ik": ["ilm"],
  "th-slf": ["saalfeld", "rudolstadt"],
  "th-sok": ["saale orla"],
  "th-shk": ["saale holzland"],
  "th-ndh": ["nordhausen"],
  // SL (SFV Saar) – Kreise
  "sl-sb": ["saarbrucken", "saarbruecken", "regionalverband"],
  "sl-sls": ["saarlouis"],
  "sl-mzg": ["merzig", "wadern"],
  "sl-nk": ["neunkirchen"],
  "sl-spk": ["saarpfalz"],
  "sl-wnd": ["wendel", "st wendel"],
  // RP (SWFV/FVR) – mit Bezirken
  "rp-mz": ["mainz", "rheinhessen"],
  "rp-lu": ["ludwigshafen", "vorderpfalz"],
  "rp-kl": ["kaiserslautern", "westpfalz"],
  "rp-wo": ["worms", "rheinhessen"],
  "rp-sp": ["speyer", "vorderpfalz"],
  "rp-mzb": ["mainz bingen", "rheinhessen"],
  "rp-rpk": ["rhein pfalz", "vorderpfalz"],
  "rp-kh": ["bad kreuznach", "rheinhessen"],
  "rp-ko": ["koblenz", "rhein lahn"],
  "rp-tr": ["trier", "mosel"],
  "rp-myk": ["mayen", "koblenz", "rhein lahn"],
  // BW (WFV/BFV-Baden/SBFV) – Bezirks-Hinweise
  "bw-s": ["stuttgart"],
  "bw-hn": ["heilbronn"],
  "bw-lb": ["ludwigsburg"],
  "bw-es": ["esslingen", "neckar fils"],
  "bw-bb": ["boblingen", "boeblingen"],
  "bw-tue": ["tubingen", "tuebingen", "alb"],
  "bw-rt": ["reutlingen", "alb"],
  "bw-ul": ["ulm", "donau"],
  "bw-ka": ["karlsruhe"],
  "bw-ma": ["mannheim"],
  "bw-hd": ["heidelberg"],
  "bw-pf": ["pforzheim"],
  "bw-rnk": ["rhein neckar"],
  "bw-fr": ["freiburg", "breisgau"],
  // BE (BFV Berlin) – verbandsweit + Bezirk-spezifisch
  "be-b": ["berlin"],
  "be-b-mi": ["mitte"],
  "be-b-pk": ["pankow"],
  "be-b-nk": ["neukolln", "neukoelln"],
  "be-b-cw": ["charlottenburg", "wilmersdorf"],
  "be-b-fk": ["friedrichshain", "kreuzberg"],
  "be-b-sp": ["spandau"],
  "be-b-rd": ["reinickendorf"],
  "be-b-ts": ["tempelhof", "schoneberg", "schoeneberg"],
  // HH (HFV) – Stadtstaat + Bezirke
  "hh-hh": ["hamburg"],
  "hh-hh-m": ["mitte"],
  "hh-hh-a": ["altona"],
  "hh-hh-e": ["eimsbuttel", "eimsbuettel"],
  "hh-hh-n": ["nord"],
  "hh-hh-w": ["wandsbek"],
  "hh-hh-b": ["bergedorf"],
  "hh-hh-h": ["harburg"],
  // HB (BFV Bremen)
  "hb-hb": ["bremen"],
  "hb-bhv": ["bremerhaven"],
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

function buildRegionAreaKeywords({ stateCode, name, shortCode, legacyId, verband, regionId }) {
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
    lubeck: ["lubeck", "luebeck"],
    neumunster: ["neumunster", "neumuenster"],
    eckerforde: ["eckerforde", "eckernforde", "eckernfoerde"],
    boblingen: ["boblingen", "boeblingen"],
    gorlitz: ["gorlitz", "goerlitz"],
    meissen: ["meissen", "meisen"],
    suedharz: ["sudharz", "suedharz"],
    borde: ["borde", "boerde"],
    eimsbuttel: ["eimsbuttel", "eimsbuettel"],
    schoneberg: ["schoneberg", "schoeneberg"],
    neukolln: ["neukolln", "neukoelln"],
  };

  for (const segment of [...keywords]) {
    const variants = variantMap[segment];
    if (variants) {
      for (const variant of variants) {
        keywords.add(variant);
      }
    }
  }

  // Bezirks-Tag aus dem Lookup (BY, NI, BW, RP, HE) – ergänzt verbandsweite
  // Spielklassen, die auf Bezirksebene laufen.
  const bezirk = STATE_BEZIRK_BY_SHORTCODE[stateCode]?.[shortCode];
  if (bezirk) {
    keywords.add(bezirk);
  }

  // Explizite Region-spezifische Tokens aus REGION_KEYWORD_OVERRIDES
  // (mirroring NRW-Pattern aus KREIS_AREA_KEYWORDS).
  const overrides = REGION_KEYWORD_OVERRIDES[regionId] || [];
  for (const override of overrides) {
    const normalized = String(override || "").trim().toLowerCase();
    if (normalized) {
      keywords.add(normalized);
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
  const areaKeywords = buildRegionAreaKeywords({
    stateCode,
    name,
    shortCode,
    legacyId,
    verband,
    regionId: id,
  });

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
