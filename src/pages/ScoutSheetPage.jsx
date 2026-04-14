import { useEffect, useMemo, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { STORAGE_KEYS } from "../config/storage";
import { useScoutX } from "../context/ScoutXContext";
import { fetchClubSuggestions } from "../services/clubSearch";
import { C } from "../styles/theme";

const MAX_PROFILE_IMAGE_EDGE = 320;
const CLUB_LOGO_CACHE_KEY = "scoutplan.clubLogos.v1";
const DOMINANT_FOOT_LABELS = {
  left: "Linksfuß",
  both: "Beidfüßig",
  right: "Rechtsfuß",
};

function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLogoUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^(\/|\.{1,2}\/)/.test(text)) {
    return text;
  }

  return "";
}

function readClubLogoCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CLUB_LOGO_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const cache = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normalizedKey = toLookupKey(key);
      const normalizedUrl = normalizeLogoUrl(value);
      if (normalizedKey && normalizedUrl) {
        cache[normalizedKey] = normalizedUrl;
      }
    }
    return cache;
  } catch {
    return {};
  }
}

function mergeClubLogoCache(prev, clubs) {
  const next = { ...prev };
  let changed = false;

  for (const club of Array.isArray(clubs) ? clubs : []) {
    const key = toLookupKey(club?.name);
    const logoUrl = normalizeLogoUrl(club?.logoUrl);
    if (!key || !logoUrl) {
      continue;
    }
    if (next[key] === logoUrl) {
      continue;
    }
    next[key] = logoUrl;
    changed = true;
  }

  return changed ? next : prev;
}

function extractGameLogo(game, side) {
  const source = game && typeof game === "object" ? game : {};
  const fields =
    side === "home"
      ? ["homeLogo", "homeLogoUrl", "homeClubLogo", "homeBadge", "homeCrest", "homeCrestUrl"]
      : ["awayLogo", "awayLogoUrl", "awayClubLogo", "awayBadge", "awayCrest", "awayCrestUrl"];

  for (const field of fields) {
    const normalized = normalizeLogoUrl(source[field]);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function buildClubCatalog({ entries, games, planHistory, activeTeams, favorites, logoCache }) {
  const lookup = new Map();

  const add = (name, meta = {}) => {
    const clubName = String(name || "").trim();
    if (!clubName) {
      return;
    }

    const key = toLookupKey(clubName);
    if (!key) {
      return;
    }

    const existing = lookup.get(key);
    const countIncrement = Math.max(1, Number(meta.count) || 1);
    const fallbackLogo = normalizeLogoUrl(logoCache?.[key]);
    const logoUrl = normalizeLogoUrl(meta.logoUrl) || fallbackLogo || "";
    const location = String(meta.location || "").trim();
    const link = String(meta.link || "").trim();

    if (existing) {
      existing.count += countIncrement;
      if (!existing.logoUrl && logoUrl) {
        existing.logoUrl = logoUrl;
      }
      if (!existing.location && location) {
        existing.location = location;
      }
      if (!existing.link && link) {
        existing.link = link;
      }
      return;
    }

    lookup.set(key, {
      key,
      name: clubName,
      count: countIncrement,
      logoUrl,
      location,
      link,
    });
  };

  for (const entry of Array.isArray(entries) ? entries : []) {
    add(entry?.club, { count: 2 });
  }

  for (const team of Array.isArray(activeTeams) ? activeTeams : []) {
    add(team);
  }

  for (const team of Array.isArray(favorites) ? favorites : []) {
    add(team);
  }

  for (const game of Array.isArray(games) ? games : []) {
    add(game?.home, { logoUrl: extractGameLogo(game, "home"), count: 2 });
    add(game?.away, { logoUrl: extractGameLogo(game, "away"), count: 2 });
  }

  for (const historyEntry of Array.isArray(planHistory) ? planHistory : []) {
    for (const game of Array.isArray(historyEntry?.games) ? historyEntry.games : []) {
      add(game?.home, { logoUrl: extractGameLogo(game, "home") });
      add(game?.away, { logoUrl: extractGameLogo(game, "away") });
    }
  }

  return [...lookup.values()].sort((left, right) => {
    const countDelta = Number(right.count || 0) - Number(left.count || 0);
    if (countDelta !== 0) {
      return countDelta;
    }
    return left.name.localeCompare(right.name, "de-DE");
  });
}

function normalizeDominantFoot(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();

  if (["left", "linksfuss", "linksfuß"].includes(text)) {
    return "left";
  }
  if (["both", "beidfussig", "beidfüßig", "beidfuessig"].includes(text)) {
    return "both";
  }
  if (["right", "rechtsfuss", "rechtsfuß"].includes(text)) {
    return "right";
  }
  return "";
}

function dominantFootLabel(value) {
  const key = normalizeDominantFoot(value);
  return DOMINANT_FOOT_LABELS[key] || "-";
}

function isDataImageUrl(value) {
  return /^data:image\//.test(String(value || "").trim());
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = dataUrl;
  });
}

async function toProfileImageDataUrl(file) {
  const originalDataUrl = await readFileAsDataUrl(file);

  if (typeof document === "undefined") {
    return originalDataUrl;
  }

  const image = await loadImage(originalDataUrl);
  const sourceWidth = Number(image.naturalWidth || image.width || 0);
  const sourceHeight = Number(image.naturalHeight || image.height || 0);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    return originalDataUrl;
  }

  const ratio = Math.min(1, MAX_PROFILE_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * ratio));
  const targetHeight = Math.max(1, Math.round(sourceHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function nameInitials(value) {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return "??";
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return `${tokens[0][0] || ""}${tokens[1][0] || ""}`.toUpperCase();
}

function readPlayerSheets() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.playerSheets);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || ""),
        createdAt: String(item.createdAt || ""),
        updatedAt: String(item.updatedAt || item.createdAt || ""),
        name: String(item.name || "").trim(),
        club: String(item.club || "").trim(),
        birthDate: String(item.birthDate || "").trim(),
        jerseyNumber: normalizeJerseyNumber(item.jerseyNumber),
        dominantFoot: normalizeDominantFoot(item.dominantFoot),
        position: String(item.position || "").trim(),
        strengths: String(item.strengths || "").trim(),
        profileImage: isDataImageUrl(item.profileImage) ? String(item.profileImage) : "",
      }))
      .filter((item) => item.id && item.name)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  } catch {
    return [];
  }
}

function toInputDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return "";
}

function toDateLabel(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "-";
  }

  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateTimeLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeJerseyNumber(value) {
  const text = String(value || "").trim();
  if (!/^\d{1,3}$/.test(text)) {
    return "";
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
    return "";
  }

  return String(parsed);
}

function emptyForm() {
  return {
    id: "",
    name: "",
    club: "",
    birthDate: "",
    jerseyNumber: "",
    dominantFoot: "",
    position: "",
    strengths: "",
    profileImage: "",
  };
}

export function ScoutSheetPage() {
  const { isMobile, games, planHistory, activeTeams, favorites, adapterEndpoint, adapterToken } = useScoutX();
  const [entries, setEntries] = useState(() => readPlayerSheets());
  const [form, setForm] = useState(() => emptyForm());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [clubInputFocused, setClubInputFocused] = useState(false);
  const [clubLookupLoading, setClubLookupLoading] = useState(false);
  const [remoteClubSuggestions, setRemoteClubSuggestions] = useState([]);
  const [clubLogoCache, setClubLogoCache] = useState(() => readClubLogoCache());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.playerSheets, JSON.stringify(entries));
    } catch {
      // Ignore optional localStorage write errors.
    }
  }, [entries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(CLUB_LOGO_CACHE_KEY, JSON.stringify(clubLogoCache));
    } catch {
      // Ignore optional localStorage write errors.
    }
  }, [clubLogoCache]);

  const isEditing = Boolean(form.id);

  const playerCountLabel = useMemo(() => {
    const count = entries.length;
    if (count === 1) {
      return "1 Spieler";
    }
    return `${count} Spieler`;
  }, [entries.length]);

  const clubCatalog = useMemo(
    () => buildClubCatalog({ entries, games, planHistory, activeTeams, favorites, logoCache: clubLogoCache }),
    [entries, games, planHistory, activeTeams, favorites, clubLogoCache],
  );

  const clubQuery = String(form.club || "").trim();
  const clubQueryKey = toLookupKey(clubQuery);

  useEffect(() => {
    const normalizedQuery = clubQuery.replace(/\s+/g, " ");
    if (normalizedQuery.length < 3) {
      setRemoteClubSuggestions([]);
      setClubLookupLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setClubLookupLoading(true);

      try {
        const clubs = await fetchClubSuggestions(adapterEndpoint, adapterToken, normalizedQuery, 8);
        if (cancelled) {
          return;
        }
        setRemoteClubSuggestions(clubs);
        setClubLogoCache((prev) => mergeClubLogoCache(prev, clubs));
      } catch {
        if (!cancelled) {
          setRemoteClubSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setClubLookupLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clubQuery, adapterEndpoint, adapterToken]);

  const clubSuggestions = useMemo(() => {
    if (!clubQueryKey) {
      return [];
    }

    const merged = new Map();

    const addSuggestion = (item, isRemote = false) => {
      const name = String(item?.name || "").trim();
      if (!name) {
        return;
      }

      const key = toLookupKey(name);
      if (!key || !key.includes(clubQueryKey)) {
        return;
      }

      const logoUrl = normalizeLogoUrl(item?.logoUrl) || "";
      const existing = merged.get(key);
      if (existing) {
        existing.count = Math.max(existing.count, Number(item?.count) || 0);
        existing.isRemote = existing.isRemote || isRemote;
        if (!existing.logoUrl && logoUrl) {
          existing.logoUrl = logoUrl;
        }
        if (!existing.location && item?.location) {
          existing.location = String(item.location).trim();
        }
        if (!existing.link && item?.link) {
          existing.link = String(item.link).trim();
        }
        return;
      }

      merged.set(key, {
        key,
        name,
        count: Number(item?.count) || 0,
        logoUrl,
        location: String(item?.location || "").trim(),
        link: String(item?.link || "").trim(),
        isRemote,
      });
    };

    for (const item of clubCatalog) {
      addSuggestion(item, false);
    }
    for (const item of remoteClubSuggestions) {
      addSuggestion(item, true);
    }

    const values = [...merged.values()];
    values.sort((left, right) => {
      const leftStarts = toLookupKey(left.name).startsWith(clubQueryKey) ? 1 : 0;
      const rightStarts = toLookupKey(right.name).startsWith(clubQueryKey) ? 1 : 0;

      if (leftStarts !== rightStarts) {
        return rightStarts - leftStarts;
      }

      if (left.isRemote !== right.isRemote) {
        return right.isRemote ? 1 : -1;
      }

      const countDelta = Number(right.count || 0) - Number(left.count || 0);
      if (countDelta !== 0) {
        return countDelta;
      }

      return left.name.localeCompare(right.name, "de-DE");
    });

    return values.slice(0, 8);
  }, [clubCatalog, remoteClubSuggestions, clubQueryKey]);

  const showClubSuggestions = clubInputFocused && clubQueryKey.length >= 2 && (clubSuggestions.length > 0 || clubLookupLoading);

  const onSelectClubSuggestion = (suggestion) => {
    const name = String(suggestion?.name || "").trim();
    if (!name) {
      return;
    }

    setForm((prev) => ({ ...prev, club: name }));
    setClubInputFocused(false);
    setError("");
  };

  const handleSubmit = () => {
    const name = String(form.name || "").trim();
    const club = String(form.club || "").trim();
    const birthDate = toInputDate(form.birthDate);
    const jerseyNumber = normalizeJerseyNumber(form.jerseyNumber);
    const dominantFoot = normalizeDominantFoot(form.dominantFoot);
    const position = String(form.position || "").trim();
    const strengths = String(form.strengths || "").trim();
    const profileImage = isDataImageUrl(form.profileImage) ? form.profileImage : "";

    if (!name) {
      setError("Bitte einen Spielernamen eintragen.");
      return;
    }
    if (!club) {
      setError("Bitte den aktuellen Verein eintragen.");
      return;
    }
    if (!birthDate) {
      setError("Bitte ein gültiges Geburtsdatum wählen.");
      return;
    }
    if (!jerseyNumber) {
      setError("Bitte eine gültige Trikotnummer eintragen.");
      return;
    }
    if (!dominantFoot) {
      setError("Bitte den starken Fuß auswählen.");
      return;
    }
    if (!position) {
      setError("Bitte eine Position eintragen.");
      return;
    }
    if (!strengths) {
      setError("Bitte die Stärken des Spielers beschreiben.");
      return;
    }

    const nowIso = new Date().toISOString();

    if (isEditing) {
      setEntries((prev) =>
        prev
          .map((entry) =>
            entry.id === form.id
              ? {
                  ...entry,
                  name,
                  club,
                  birthDate,
                  jerseyNumber,
                  dominantFoot,
                  position,
                  strengths,
                  profileImage,
                  updatedAt: nowIso,
                }
              : entry,
          )
          .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))),
      );
      setNotice("Spielerbewertung wurde aktualisiert.");
    } else {
      const nextEntry = {
        id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        name,
        club,
        birthDate,
        jerseyNumber,
        dominantFoot,
        position,
        strengths,
        profileImage,
      };

      setEntries((prev) => [nextEntry, ...prev]);
      setNotice("Spieler wurde im Bewertungsbogen angelegt.");
    }

    setError("");
    setForm(emptyForm());
  };

  const onEdit = (entry) => {
    setForm({
      id: entry.id,
      name: entry.name,
      club: entry.club,
      birthDate: toInputDate(entry.birthDate),
      jerseyNumber: normalizeJerseyNumber(entry.jerseyNumber),
      dominantFoot: normalizeDominantFoot(entry.dominantFoot),
      position: entry.position,
      strengths: entry.strengths,
      profileImage: isDataImageUrl(entry.profileImage) ? entry.profileImage : "",
    });
    setError("");
    setNotice("");
  };

  const onDelete = (entryId) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    setForm((prev) => (prev.id === entryId ? emptyForm() : prev));
    setError("");
    setNotice("Spieler wurde aus dem Bewertungsbogen entfernt.");
  };

  const onSelectProfileImage = async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      setError("Bitte eine gültige Bilddatei auswählen.");
      return;
    }

    setImageProcessing(true);
    setError("");

    try {
      const dataUrl = await toProfileImageDataUrl(file);
      if (!isDataImageUrl(dataUrl)) {
        throw new Error("Ungültiges Bildformat");
      }
      setForm((prev) => ({ ...prev, profileImage: dataUrl }));
      setNotice("Profilbild wurde übernommen.");
    } catch {
      setError("Profilbild konnte nicht verarbeitet werden.");
    } finally {
      setImageProcessing(false);
    }
  };

  return (
    <div className="fu">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: C.white, fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: "-0.4px" }}>
          Scout-Bewertungsbogen
        </h1>
        <p style={{ margin: "8px 0 0", color: C.gray, fontSize: 13, lineHeight: 1.5, maxWidth: 900 }}>
          Lege Spieler an und dokumentiere strukturiert Name, Verein, Geburtsdatum, Trikotnummer, starken Fuß,
          Position und deine manuelle Stärken-Einschätzung. Die Einträge werden lokal auf deinem Gerät gespeichert.
        </p>
      </div>

      {error ? (
        <div
          style={{
            border: `1px solid rgba(239,68,68,0.24)`,
            background: C.errorDim,
            color: "#fca5a5",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          style={{
            border: `1px solid ${C.greenBorder}`,
            background: C.greenDim,
            color: C.greenLight,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {notice}
        </div>
      ) : null}

      <section
        className="fu2"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          background: C.surface,
          padding: isMobile ? 12 : 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Spielername</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="z. B. Max Mustermann"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Aktueller Verein</span>
            <input
              type="text"
              value={form.club}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, club: event.target.value }));
                setClubInputFocused(true);
              }}
              onFocus={() => setClubInputFocused(true)}
              onBlur={() => {
                setTimeout(() => setClubInputFocused(false), 120);
              }}
              autoComplete="off"
              placeholder="z. B. SF Hamborn 07"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />

            {showClubSuggestions ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  borderRadius: 10,
                  border: `1px solid ${C.borderHi}`,
                  background: C.surface,
                  boxShadow: "0 14px 28px rgba(0,0,0,0.35)",
                  zIndex: 40,
                  overflow: "hidden",
                }}
              >
                {clubSuggestions.length === 0 ? (
                  <div style={{ padding: "10px 12px", color: C.gray, fontSize: 12 }}>Vereine werden geladen...</div>
                ) : (
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    {clubSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onSelectClubSuggestion(suggestion);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 10px",
                          border: "none",
                          borderBottom: `1px solid ${C.border}`,
                          background: "transparent",
                          color: C.offWhite,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: `1px solid ${C.border}`,
                            background: "rgba(255,255,255,0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: C.grayLight,
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {suggestion.logoUrl ? (
                            <img
                              src={suggestion.logoUrl}
                              alt={`Logo ${suggestion.name}`}
                              loading="lazy"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            nameInitials(suggestion.name)
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: C.offWhite, lineHeight: 1.2 }}>{suggestion.name}</div>
                          {suggestion.location ? (
                            <div style={{ marginTop: 2, fontSize: 11, color: C.gray }}>{suggestion.location}</div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </label>
        </div>

        <div
          style={{
            marginTop: 10,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            padding: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              border: `1px solid ${C.borderHi}`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
              color: C.grayLight,
              fontSize: 16,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {isDataImageUrl(form.profileImage) ? (
              <img
                src={form.profileImage}
                alt="Profilbild Vorschau"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              nameInitials(form.name || "Spieler")
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Profilbild
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  minHeight: 34,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: C.offWhite,
                  background: "rgba(255,255,255,0.03)",
                  cursor: imageProcessing ? "progress" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void onSelectProfileImage(event)}
                  style={{ display: "none" }}
                  disabled={imageProcessing}
                />
                {imageProcessing ? "Bild wird verarbeitet..." : "Bild hochladen"}
              </label>

              {isDataImageUrl(form.profileImage) ? (
                <GhostButton
                  onClick={() => setForm((prev) => ({ ...prev, profileImage: "" }))}
                  style={{ minHeight: 34, padding: "6px 10px", fontSize: 12 }}
                >
                  Bild entfernen
                </GhostButton>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))",
            marginTop: 10,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Geburtsdatum</span>
            <input
              type="date"
              value={form.birthDate}
              onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Trikotnummer</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="999"
              step="1"
              value={form.jerseyNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, jerseyNumber: event.target.value }))}
              placeholder="z. B. 10"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Position</span>
            <input
              type="text"
              value={form.position}
              onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
              placeholder="z. B. IV, 6er, LA"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Starker Fuß</span>
            <select
              value={form.dominantFoot}
              onChange={(event) => setForm((prev) => ({ ...prev, dominantFoot: event.target.value }))}
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              <option value="">Bitte auswählen</option>
              <option value="left">Linksfuß</option>
              <option value="both">Beidfüßig</option>
              <option value="right">Rechtsfuß</option>
            </select>
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Stärken (manuelle Notiz)</span>
          <textarea
            value={form.strengths}
            onChange={(event) => setForm((prev) => ({ ...prev, strengths: event.target.value }))}
            placeholder="Beschreibe die Stärken des Spielers: Technik, Athletik, Entscheidungsverhalten, Mentalität, etc."
            rows={isMobile ? 6 : 5}
            style={{
              width: "100%",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.offWhite,
              minHeight: isMobile ? 130 : 120,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <PrimaryButton onClick={handleSubmit} style={{ minWidth: isMobile ? "100%" : 220 }}>
            {isEditing ? "Bewertung aktualisieren" : "Spieler anlegen"}
          </PrimaryButton>
          {isEditing ? (
            <GhostButton
              onClick={() => {
                setForm(emptyForm());
                setError("");
              }}
              style={{ minWidth: isMobile ? "100%" : "auto" }}
            >
              Bearbeitung abbrechen
            </GhostButton>
          ) : null}
        </div>
      </section>

      <section
        className="fu3"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          background: C.surface,
          padding: isMobile ? 12 : 16,
        }}
      >
        <div style={{ color: C.offWhite, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          Angelegte Spieler · <span style={{ color: C.grayLight, fontWeight: 600 }}>{playerCountLabel}</span>
        </div>

        {entries.length === 0 ? (
          <div style={{ color: C.gray, fontSize: 13 }}>
            Noch keine Spieler angelegt. Nutze oben das Formular, um den ersten Bewertungsbogen zu erstellen.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {entries.map((entry) => (
              <article
                key={entry.id}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      border: `1px solid ${C.border}`,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255,255,255,0.04)",
                      color: C.grayLight,
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isDataImageUrl(entry.profileImage) ? (
                      <img
                        src={entry.profileImage}
                        alt={`Profilbild von ${entry.name}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      nameInitials(entry.name)
                    )}
                  </div>
                  <div style={{ color: C.white, fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{entry.name}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11 }}>
                  <span
                    style={{
                      border: `1px solid ${C.greenBorder}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.greenLight,
                      background: C.greenDim,
                    }}
                  >
                    Verein: {entry.club || "-"}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Nr.: {normalizeJerseyNumber(entry.jerseyNumber) || "-"}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Geb.: {toDateLabel(entry.birthDate)}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Position: {entry.position || "-"}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Starker Fuß: {dominantFootLabel(entry.dominantFoot)}
                  </span>
                </div>

                <div
                  style={{
                    color: C.offWhite,
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {entry.strengths}
                </div>

                <div style={{ color: C.grayDark, fontSize: 11 }}>
                  Zuletzt geändert: {toDateTimeLabel(entry.updatedAt || entry.createdAt)}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  <GhostButton onClick={() => onEdit(entry)} style={{ minHeight: 36, padding: "6px 12px", fontSize: 12 }}>
                    Bearbeiten
                  </GhostButton>
                  <GhostButton
                    onClick={() => onDelete(entry.id)}
                    style={{
                      minHeight: 36,
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "#fca5a5",
                      borderColor: "rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.08)",
                    }}
                  >
                    Löschen
                  </GhostButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
