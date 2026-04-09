const FUSSBALL_BASE_URL = "https://www.fussball.de";
const FUSSBALL_MATCH_ID_RE = /^[A-Z0-9]{20,}$/;

function normalizeText(value) {
  return String(value || "").trim();
}

function toAbsoluteUrl(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (text.startsWith("/")) {
    return `${FUSSBALL_BASE_URL}${text}`;
  }

  return "";
}

function isLikelyFussballMatchId(value) {
  return FUSSBALL_MATCH_ID_RE.test(normalizeText(value).toUpperCase());
}

export function buildFussballMatchUrlFromId(value) {
  const text = normalizeText(value).toUpperCase();
  if (!isLikelyFussballMatchId(text)) {
    return "";
  }
  return `${FUSSBALL_BASE_URL}/spiel/-/spiel/${text}`;
}

export function resolveGameMatchUrl(game) {
  const safeGame = game && typeof game === "object" ? game : {};
  const directCandidates = [
    safeGame.matchUrl,
    safeGame.match_url,
    safeGame.sourceUrl,
    safeGame.source_url,
    safeGame.url,
    safeGame.link,
  ];

  for (const candidate of directCandidates) {
    const absolute = toAbsoluteUrl(candidate);
    if (absolute) {
      return absolute;
    }
  }

  const idCandidates = [safeGame.matchId, safeGame.match_id, safeGame.id];
  for (const candidate of idCandidates) {
    const built = buildFussballMatchUrlFromId(candidate);
    if (built) {
      return built;
    }
  }

  return "";
}
