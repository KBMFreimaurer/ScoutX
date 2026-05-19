export const LEAGUE_PRESETS_BY_STATE = {
  NW: [
    "Niederrheinliga",
    "Leistungsklasse",
    "Bezirksliga",
    "Kreisliga",
    "Sonderliga",
    "Regionalliga",
  ],
  BY: ["Bezirksoberliga", "Bezirksliga", "Kreisliga", "Förderliga", "Regionalliga"],
  BW: ["Verbandsstaffel", "Landesstaffel", "Bezirksstaffel", "Kreisstaffel", "Regionalliga"],
};

export const LEAGUE_PRESETS_FALLBACK = ["Regionalliga", "Oberliga", "Landesliga", "Bezirksliga", "Kreisliga"];

export function getLeaguePresetsByState(stateCode) {
  const code = String(stateCode || "").trim().toUpperCase();
  return LEAGUE_PRESETS_BY_STATE[code] || LEAGUE_PRESETS_FALLBACK;
}
