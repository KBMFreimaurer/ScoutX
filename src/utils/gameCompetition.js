function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function extractAgeGroup(game) {
  const explicit = String(game?.ageGroup || "").trim().toUpperCase();
  if (/^U(?:15|16|17|18|19|20|21)$/.test(explicit)) {
    return explicit;
  }

  const candidates = [
    game?.competitionName,
    game?.competition,
    game?.league,
    game?.home,
    game?.away,
  ];

  for (const candidate of candidates) {
    const match = String(candidate || "").match(/\bU(15|16|17|18|19|20|21)\b/i);
    if (match) {
      return `U${match[1]}`;
    }
  }

  return "";
}

export function resolveGameCompetitionLabel(game) {
  const candidates = [
    game?.league,
    game?.competitionName,
    game?.competition,
    game?.liga,
    game?.division,
    game?.staffel,
    game?.staffelName,
    game?.leagueName,
    game?.wettbewerb,
    game?.wettbewerbName,
    game?.spielklasse,
    game?.spielklasseName,
  ];

  for (const candidate of candidates) {
    const label = String(candidate || "").trim();
    if (label) {
      return label;
    }
  }

  return "Nicht angegeben";
}

export function resolveGameCompetitionType(game) {
  const source = normalizeLookup(game?.source);
  const provider = normalizeLookup(game?.provider);
  const isTournament = Boolean(game?.turnier) || source === "tournament";
  const isNational =
    source === "national" ||
    source === "dfb national games" ||
    provider === "dfb.de" ||
    provider.includes("dfb");

  if (isTournament) {
    return {
      key: "tournament",
      label: "Turnier",
      groupLabel: "Turniere",
      sourceLabel: String(game?.provider || "meinturnierplan.de").trim() || "meinturnierplan.de",
    };
  }

  if (isNational) {
    const ageGroup = extractAgeGroup(game);
    return {
      key: "national",
      label: ageGroup ? `DFB ${ageGroup}` : "DFB-Spiel",
      groupLabel: "DFB-Spiele",
      sourceLabel: String(game?.provider || "dfb.de").trim() || "dfb.de",
    };
  }

  return {
    key: "league",
    label: "Ligaspiel",
    groupLabel: "Ligaspiele",
    sourceLabel: String(game?.provider || "fussball.de/Adapter").trim() || "fussball.de/Adapter",
  };
}

export function buildGameCompetitionSummary(games) {
  const order = ["league", "tournament", "national"];
  const counts = new Map();

  for (const game of Array.isArray(games) ? games : []) {
    const type = resolveGameCompetitionType(game);
    counts.set(type.key, {
      key: type.key,
      label: type.groupLabel,
      count: (counts.get(type.key)?.count || 0) + 1,
    });
  }

  return order.map((key) => counts.get(key)).filter(Boolean);
}
