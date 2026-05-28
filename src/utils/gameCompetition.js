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
