import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWindowWidth } from "../hooks/useWindowWidth";
import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { STORAGE_KEYS } from "../config/storage";
import { geocodeAddress, reverseGeocode } from "../utils/geo";
import { getWeekRange, normalizeAdapterEndpoint, normalizeTeamParameters } from "./shared";

const SetupContext = createContext(null);
const ROMAN_SUBLEVELS = ["I", "II", "III", "IV"];
const HARD_CODED_ADAPTER_TOKEN = "scoutx-internal-2026";
const ROMAN_TO_ARABIC = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
};
const KNOWN_KREIS_IDS = new Set(KREISE.map((item) => String(item.id || "").trim()).filter(Boolean));

function normalizeKreisIds(values) {
  const list = Array.isArray(values) ? values : [values];
  const ids = [];
  const seen = new Set();

  for (const value of list) {
    const id = String(value || "").trim();
    if (!id || !KNOWN_KREIS_IDS.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return KREISE.map((item) => item.id).filter((id) => ids.includes(id));
}

function buildKreisLabel(kreise) {
  const labels = (Array.isArray(kreise) ? kreise : [])
    .map((item) => String(item?.label || "").trim())
    .filter(Boolean);

  if (labels.length === 0) {
    return "";
  }

  return labels.join(", ");
}

function humanizeGeolocationError(error) {
  const code = Number(error?.code);
  const rawMessage = String(error?.message || "").trim();
  const lower = rawMessage.toLowerCase();

  if (code === 1 || /permission|denied|not have permission|forbidden/.test(lower)) {
    return "Standortzugriff wurde blockiert. Bitte Standortfreigabe im Browser erlauben.";
  }

  if (code === 2 || /position unavailable|unavailable/.test(lower)) {
    return "Standort konnte derzeit nicht bestimmt werden. Bitte erneut versuchen.";
  }

  if (code === 3 || /timeout|timed out/.test(lower)) {
    return "Standortabfrage hat zu lange gedauert. Bitte erneut versuchen.";
  }

  if (/secure context|only secure origins|https/.test(lower)) {
    return "Standortzugriff funktioniert nur über HTTPS oder localhost.";
  }

  return "Aktueller Standort konnte nicht verwendet werden.";
}

function isBambiniJugend(jugend) {
  return (
    String(jugend?.id || "")
      .trim()
      .toLowerCase() === "bambini"
  );
}

function buildJugendSubLevelOptions(jugend) {
  if (!jugend || isBambiniJugend(jugend)) {
    return [];
  }

  const prefix = String(jugend.kurz || "")
    .trim()
    .toUpperCase();
  if (!prefix || prefix.length > 2) {
    return [];
  }

  return ROMAN_SUBLEVELS.map((roman) => `${prefix} ${roman}`);
}

function buildJugendSubLevelHints(values) {
  const hints = [];

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
    if (!normalized) {
      continue;
    }

    hints.push(normalized);
    const match = normalized.match(/^([A-Z]{1,2})\s+(I|II|III|IV)$/);
    if (match) {
      const prefix = match[1];
      const roman = match[2];
      const arabic = ROMAN_TO_ARABIC[roman];
      if (arabic) {
        hints.push(`${prefix}${arabic}`);
      }
    }
  }

  return normalizeTeamParameters(hints);
}

function parseIsoDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sanitizeStartLocation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const lat = Number(value.lat);
  const lon = Number(value.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    label: String(value.label || "").trim() || `Startpunkt (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
  };
}

function readSetupStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.setup);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function SetupProvider({ children, defaultAdapterEndpoint }) {
  const [setupDefaults] = useState(() => {
    const todayIso = toIsoDate(new Date());
    const initialRange = getWeekRange(todayIso);
    const persisted = readSetupStorage();

    const persistedFromDate = parseIsoDate(persisted?.fromDate);
    const normalizedFromDate = persistedFromDate ? toIsoDate(persistedFromDate) : initialRange.fromDate;
    const normalizedFromDateParsed = parseIsoDate(normalizedFromDate);
    const persistedToDate = parseIsoDate(persisted?.toDate);
    const normalizedToDate =
      persistedToDate && normalizedFromDateParsed && persistedToDate.getTime() >= normalizedFromDateParsed.getTime()
        ? toIsoDate(persistedToDate)
        : normalizedFromDate;

    const normalizedKreisIds = normalizeKreisIds(
      persisted?.kreisIds ||
        persisted?.kreise ||
        String(persisted?.kreisId || "").trim() ||
        String(persisted?.kreis || "").trim(),
    );

    return {
      kreisIds: normalizedKreisIds,
      kreisId: normalizedKreisIds[0] || "",
      jugendId: String(persisted?.jugendId || "").trim(),
      selTeams: normalizeTeamParameters(persisted?.selTeams),
      fromDate: normalizedFromDate,
      toDate: normalizedToDate,
      jugendSubLevels: normalizeTeamParameters(persisted?.jugendSubLevels),
      startLocation: sanitizeStartLocation(persisted?.startLocation),
      favorites: normalizeTeamParameters(persisted?.favorites),
      todayIso,
    };
  });

  const width = useWindowWidth();
  const isMobile = width < 600;

  const [kreisIds, setKreisIds] = useState(() => normalizeKreisIds(setupDefaults.kreisIds || setupDefaults.kreisId));
  const [jugendId, setJugendId] = useState(setupDefaults.jugendId);
  const [selectedTeams, setSelectedTeams] = useState(() => normalizeTeamParameters(setupDefaults.selTeams));
  const [teamDraft, setTeamDraft] = useState("");
  const [teamValidation, setTeamValidation] = useState(null);
  const [fromDate, setFromDate] = useState(setupDefaults.fromDate);
  const [toDate, setToDate] = useState(setupDefaults.toDate);
  const [jugendSubLevels, setJugendSubLevels] = useState(() => normalizeTeamParameters(setupDefaults.jugendSubLevels));
  const adapterEndpoint = useMemo(
    () => normalizeAdapterEndpoint(defaultAdapterEndpoint, "/api/games"),
    [defaultAdapterEndpoint],
  );
  const adapterTokenDefault = String(import.meta.env?.VITE_ADAPTER_TOKEN || HARD_CODED_ADAPTER_TOKEN).trim();
  const [adapterToken, setAdapterToken] = useState(adapterTokenDefault);
  const [startLocation, setStartLocation] = useState(setupDefaults.startLocation);
  const [locationDraft, setLocationDraft] = useState(setupDefaults.startLocation?.label || "");
  const [locationError, setLocationError] = useState("");
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [favoriteTeams, setFavoriteTeams] = useState(() => normalizeTeamParameters(setupDefaults.favorites));
  const [favoriteDraft, setFavoriteDraft] = useState("");
  const [err, setErr] = useState("");
  const [abrechnungMeta, setAbrechnungMetaRaw] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.abrechnungMeta);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          scoutName: String(parsed?.scoutName || "").trim(),
          kmPauschale: Number(parsed?.kmPauschale) > 0 ? Number(parsed.kmPauschale) : 0.3,
        };
      }
    } catch {
      // localStorage kann im Browser-Kontext blockiert sein.
    }
    return { scoutName: "", kmPauschale: 0.3 };
  });

  const setAbrechnungMeta = useCallback((partial) => {
    setAbrechnungMetaRaw((prev) => {
      const next = { ...prev, ...partial };
      try {
        window.localStorage.setItem(STORAGE_KEYS.abrechnungMeta, JSON.stringify(next));
      } catch {
        // Persistenzfehler sollen den Setup-Flow nicht unterbrechen.
      }
      return next;
    });
  }, []);

  const kreisId = useMemo(() => (Array.isArray(kreisIds) && kreisIds.length > 0 ? kreisIds[0] : ""), [kreisIds]);
  const kreise = useMemo(
    () =>
      (Array.isArray(kreisIds) ? kreisIds : [])
        .map((id) => KREISE.find((item) => item.id === id))
        .filter(Boolean),
    [kreisIds],
  );
  const kreis = useMemo(() => (kreise.length > 0 ? kreise[0] : null), [kreise]);
  const kreisLabel = useMemo(() => buildKreisLabel(kreise), [kreise]);
  const jugend = useMemo(() => JUGEND_KLASSEN.find((item) => item.id === jugendId), [jugendId]);
  const availableJugendSubLevels = useMemo(() => buildJugendSubLevelOptions(jugend), [jugend]);
  const jugendSubLevelHints = useMemo(() => buildJugendSubLevelHints(jugendSubLevels), [jugendSubLevels]);
  const activeTeams = useMemo(
    () => normalizeTeamParameters([...selectedTeams, ...jugendSubLevelHints]),
    [selectedTeams, jugendSubLevelHints],
  );
  const favorites = useMemo(() => normalizeTeamParameters(favoriteTeams), [favoriteTeams]);
  const canBuild = Boolean(kreisIds.length > 0 && jugendId);
  const hasLocation = Boolean(
    startLocation && Number.isFinite(startLocation.lat) && Number.isFinite(startLocation.lon),
  );

  const clearErr = useCallback(() => setErr(""), []);

  const onSelectKreis = useCallback((id) => {
    const nextId = String(id || "").trim();
    if (!nextId || !KNOWN_KREIS_IDS.has(nextId)) {
      return;
    }

    setKreisIds((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const next = current.includes(nextId) ? current.filter((value) => value !== nextId) : [...current, nextId];
      return normalizeKreisIds(next);
    });
    setSelectedTeams([]);
    setTeamDraft("");
    setTeamValidation(null);
    setErr("");
  }, []);

  const onSelectJugend = useCallback((id) => {
    setJugendId(id);
    setJugendSubLevels([]);
    setTeamValidation(null);
    setErr("");
  }, []);

  const onToggleJugendSubLevel = useCallback(
    (value) => {
      const subLevel = String(value || "")
        .trim()
        .toUpperCase();
      if (!subLevel) {
        return;
      }

      setJugendSubLevels((prev) => {
        const exists = prev.includes(subLevel);
        const next = exists ? prev.filter((item) => item !== subLevel) : [...prev, subLevel];
        const orderMap = new Map(availableJugendSubLevels.map((item, index) => [item, index]));

        return normalizeTeamParameters(next).sort((left, right) => {
          const leftRank = Number.isFinite(orderMap.get(left)) ? orderMap.get(left) : Number.MAX_SAFE_INTEGER;
          const rightRank = Number.isFinite(orderMap.get(right)) ? orderMap.get(right) : Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
          return left.localeCompare(right, "de");
        });
      });
      setTeamValidation(null);
    },
    [availableJugendSubLevels],
  );

  const onClearJugendSubLevels = useCallback(() => {
    setJugendSubLevels([]);
    setTeamValidation(null);
  }, []);

  const onClearAllTeams = useCallback(() => {
    setSelectedTeams([]);
    setTeamValidation(null);
  }, []);

  const onSetFromDate = useCallback((value) => {
    const normalized = String(value || "").trim();
    setFromDate(normalized);

    const fromParsed = parseIsoDate(normalized);
    if (!fromParsed) {
      return;
    }

    setToDate((prevToDate) => {
      const prevParsed = parseIsoDate(prevToDate);
      if (!prevParsed || prevParsed.getTime() < fromParsed.getTime()) {
        return toIsoDate(fromParsed);
      }
      return prevToDate;
    });
  }, []);

  const onSetToDate = useCallback(
    (value) => {
      const normalized = String(value || "").trim();
      const toParsed = parseIsoDate(normalized);
      if (!toParsed) {
        setToDate(normalized);
        return;
      }

      const fromParsed = parseIsoDate(fromDate);
      if (fromParsed && toParsed.getTime() < fromParsed.getTime()) {
        setToDate(toIsoDate(fromParsed));
        return;
      }

      setToDate(normalized);
    },
    [fromDate],
  );

  const onAddTeamField = useCallback(
    (value = teamDraft) => {
      const team = String(value || "").trim();
      if (!team) {
        return;
      }

      setSelectedTeams((prev) => normalizeTeamParameters([...prev, team]));
      setTeamDraft("");
      setTeamValidation(null);
    },
    [teamDraft],
  );

  const onUpdateTeamField = useCallback((index, value) => {
    setSelectedTeams((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setTeamValidation(null);
  }, []);

  const onNormalizeTeamField = useCallback(() => {
    setSelectedTeams((prev) => normalizeTeamParameters([...prev]));
    setTeamValidation(null);
  }, []);

  const onRemoveTeamField = useCallback((index) => {
    setSelectedTeams((prev) => prev.filter((_, idx) => idx !== index));
    setTeamValidation(null);
  }, []);

  const onResolveLocation = useCallback(
    async (value = locationDraft) => {
      const query = String(value || "").trim();
      if (!query) {
        setStartLocation(null);
        setLocationError("");
        return;
      }

      setResolvingLocation(true);
      setLocationError("");

      try {
        const result = await geocodeAddress(query, { kreisId });
        if (!result) {
          throw new Error("Adresse konnte nicht aufgelöst werden.");
        }

        setStartLocation(result);
        setLocationDraft(result.label || query);
      } catch (error) {
        setLocationError(error?.message || "Startort konnte nicht bestimmt werden.");
      } finally {
        setResolvingLocation(false);
      }
    },
    [kreisId, locationDraft],
  );

  const onUseCurrentLocation = useCallback(async () => {
    if (!navigator?.geolocation) {
      setLocationError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }

    setResolvingLocation(true);
    setLocationError("");

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 120000,
        });
      });

      const lat = Number(position?.coords?.latitude);
      const lon = Number(position?.coords?.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("Ungültige Standortdaten empfangen.");
      }

      const reverse = await reverseGeocode(lat, lon).catch(() => null);
      const location = {
        lat,
        lon,
        label: reverse?.label || `Aktueller Standort (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      };

      setStartLocation(location);
      setLocationDraft(location.label);
    } catch (error) {
      setLocationError(humanizeGeolocationError(error));
    } finally {
      setResolvingLocation(false);
    }
  }, []);

  const onClearLocation = useCallback(() => {
    setStartLocation(null);
    setLocationDraft("");
    setLocationError("");
  }, []);

  const onAddFavoriteTeam = useCallback(
    (value = favoriteDraft) => {
      const team = String(value || "").trim();
      if (!team) {
        return;
      }

      setFavoriteTeams((prev) => normalizeTeamParameters([...prev, team]));
      setFavoriteDraft("");
    },
    [favoriteDraft],
  );

  const onRemoveFavoriteTeam = useCallback((index) => {
    setFavoriteTeams((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const onClearFavoriteTeams = useCallback(() => {
    setFavoriteTeams([]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedKreisIds = normalizeKreisIds(kreisIds);
    const payload = {
      kreisIds: normalizedKreisIds,
      kreisId: normalizedKreisIds[0] || "",
      jugendId,
      selTeams: normalizeTeamParameters(selectedTeams),
      fromDate,
      toDate,
      jugendSubLevels: normalizeTeamParameters(jugendSubLevels),
      startLocation: sanitizeStartLocation(startLocation),
      favorites: normalizeTeamParameters(favoriteTeams),
    };

    try {
      window.localStorage.setItem(STORAGE_KEYS.setup, JSON.stringify(payload));
    } catch {
      // Persistenzfehler sollen den Setup-Flow nicht unterbrechen.
    }
  }, [kreisId, kreisIds, jugendId, selectedTeams, fromDate, toDate, jugendSubLevels, startLocation, favoriteTeams]);

  const resetSetupState = useCallback(() => {
    setKreisIds([]);
    setJugendId("");
    setSelectedTeams([]);
    setTeamDraft("");
    setTeamValidation(null);
    setJugendSubLevels([]);
    setAdapterToken(adapterTokenDefault);
    setFromDate(setupDefaults.fromDate);
    setToDate(setupDefaults.toDate);
    setStartLocation(null);
    setLocationDraft("");
    setLocationError("");
    setResolvingLocation(false);
    setFavoriteTeams([]);
    setFavoriteDraft("");
    setAbrechnungMetaRaw({ scoutName: "", kmPauschale: 0.3 });
    try {
      window.localStorage.removeItem(STORAGE_KEYS.abrechnungMeta);
      window.localStorage.removeItem(STORAGE_KEYS.setup);
    } catch {
      // Falls localStorage blockiert ist, bleibt nur der In-Memory-Reset aktiv.
    }
    setErr("");
  }, [adapterTokenDefault, setupDefaults.fromDate, setupDefaults.toDate]);

  const value = useMemo(
    () => ({
      isMobile,
      width,
      kreisIds,
      kreisId,
      kreise,
      jugendId,
      kreis,
      kreisLabel,
      jugend,
      selectedTeams,
      activeTeams,
      teamDraft,
      teamValidation,
      fromDate,
      toDate,
      jugendSubLevels,
      availableJugendSubLevels,
      adapterEndpoint,
      adapterToken,
      startLocation,
      locationDraft,
      locationError,
      resolvingLocation,
      hasLocation,
      scoutName: abrechnungMeta.scoutName,
      kmPauschale: abrechnungMeta.kmPauschale,
      favorites,
      favoriteDraft,
      canBuild,
      err,
      setErr,
      clearErr,
      setTeamValidation,
      onSelectKreis,
      onSelectJugend,
      onToggleJugendSubLevel,
      onClearJugendSubLevels,
      onAddTeamField,
      onUpdateTeamField,
      onNormalizeTeamField,
      onRemoveTeamField,
      onSetTeamDraft: setTeamDraft,
      onClearAllTeams,
      onSetFromDate,
      onSetToDate,
      onSetLocationDraft: setLocationDraft,
      onResolveLocation,
      onUseCurrentLocation,
      onClearLocation,
      onSetScoutName: (val) => setAbrechnungMeta({ scoutName: String(val || "") }),
      onSetKmPauschale: (val) => {
        const n = Number(val);
        if (n > 0) {
          setAbrechnungMeta({ kmPauschale: n });
        }
      },
      onSetFavoriteDraft: setFavoriteDraft,
      onAddFavoriteTeam,
      onRemoveFavoriteTeam,
      onClearFavoriteTeams,
      resetSetupState,
    }),
    [
      isMobile,
      width,
      kreisIds,
      kreisId,
      kreise,
      jugendId,
      kreis,
      kreisLabel,
      jugend,
      selectedTeams,
      activeTeams,
      teamDraft,
      teamValidation,
      fromDate,
      toDate,
      jugendSubLevels,
      availableJugendSubLevels,
      adapterEndpoint,
      adapterToken,
      startLocation,
      locationDraft,
      locationError,
      resolvingLocation,
      hasLocation,
      abrechnungMeta,
      favorites,
      favoriteDraft,
      canBuild,
      err,
      clearErr,
      onSelectKreis,
      onSelectJugend,
      onToggleJugendSubLevel,
      onClearJugendSubLevels,
      onAddTeamField,
      onUpdateTeamField,
      onNormalizeTeamField,
      onRemoveTeamField,
      onClearAllTeams,
      onSetFromDate,
      onSetToDate,
      onResolveLocation,
      onUseCurrentLocation,
      onClearLocation,
      setAbrechnungMeta,
      onAddFavoriteTeam,
      onRemoveFavoriteTeam,
      onClearFavoriteTeams,
      resetSetupState,
    ],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup muss innerhalb von SetupProvider verwendet werden.");
  }
  return context;
}
