import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWindowWidth } from "../hooks/useWindowWidth";
import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { STORAGE_KEYS } from "../config/storage";
import { geocodeAddress, reverseGeocode } from "../utils/geo";
import { normalizeAdapterEndpoint, normalizeTeamParameters } from "./shared";

const SetupContext = createContext(null);
const ROMAN_SUBLEVELS = ["I", "II", "III", "IV"];
const ROMAN_TO_ARABIC = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
};

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

export function SetupProvider({ children, defaultAdapterEndpoint }) {
  const [setupDefaults] = useState(() => {
    const todayIso = new Date().toISOString().split("T")[0];

    return {
      kreisId: "",
      jugendId: "",
      selTeams: [],
      fromDate: todayIso,
      focus: "",
      jugendSubLevels: [],
      startLocation: null,
      favorites: [],
      todayIso,
    };
  });

  const width = useWindowWidth();
  const isMobile = width < 600;

  const [kreisId, setKreisId] = useState(setupDefaults.kreisId);
  const [jugendId, setJugendId] = useState(setupDefaults.jugendId);
  const [selectedTeams, setSelectedTeams] = useState(() => normalizeTeamParameters(setupDefaults.selTeams));
  const [teamDraft, setTeamDraft] = useState("");
  const [teamValidation, setTeamValidation] = useState(null);
  const [fromDate, setFromDate] = useState(setupDefaults.fromDate);
  const [focus, setFocus] = useState(setupDefaults.focus);
  const [jugendSubLevels, setJugendSubLevels] = useState(() => normalizeTeamParameters(setupDefaults.jugendSubLevels));
  const adapterEndpoint = useMemo(
    () => normalizeAdapterEndpoint(defaultAdapterEndpoint, "/api/games"),
    [defaultAdapterEndpoint],
  );
  const adapterTokenDefault = String(import.meta.env?.VITE_ADAPTER_TOKEN || "").trim();
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

  const kreis = useMemo(() => KREISE.find((item) => item.id === kreisId), [kreisId]);
  const jugend = useMemo(() => JUGEND_KLASSEN.find((item) => item.id === jugendId), [jugendId]);
  const availableJugendSubLevels = useMemo(() => buildJugendSubLevelOptions(jugend), [jugend]);
  const jugendSubLevelHints = useMemo(() => buildJugendSubLevelHints(jugendSubLevels), [jugendSubLevels]);
  const activeTeams = useMemo(
    () => normalizeTeamParameters([...selectedTeams, ...jugendSubLevelHints]),
    [selectedTeams, jugendSubLevelHints],
  );
  const favorites = useMemo(() => normalizeTeamParameters(favoriteTeams), [favoriteTeams]);
  const canBuild = Boolean(kreisId && jugendId);
  const hasLocation = Boolean(
    startLocation && Number.isFinite(startLocation.lat) && Number.isFinite(startLocation.lon),
  );

  const clearErr = useCallback(() => setErr(""), []);

  const onSelectKreis = useCallback((id) => {
    setKreisId(id);
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
        const result = await geocodeAddress(query);
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
    [locationDraft],
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

  const resetSetupState = useCallback(() => {
    setKreisId("");
    setJugendId("");
    setSelectedTeams([]);
    setTeamDraft("");
    setTeamValidation(null);
    setJugendSubLevels([]);
    setAdapterToken(adapterTokenDefault);
    setFromDate(setupDefaults.todayIso);
    setFocus("");
    setStartLocation(null);
    setLocationDraft("");
    setLocationError("");
    setResolvingLocation(false);
    setFavoriteTeams([]);
    setFavoriteDraft("");
    setAbrechnungMetaRaw({ scoutName: "", kmPauschale: 0.3 });
    try {
      window.localStorage.removeItem(STORAGE_KEYS.abrechnungMeta);
    } catch {
      // Falls localStorage blockiert ist, bleibt nur der In-Memory-Reset aktiv.
    }
    setErr("");
  }, [adapterTokenDefault, setupDefaults.todayIso]);

  const value = useMemo(
    () => ({
      isMobile,
      width,
      kreisId,
      jugendId,
      kreis,
      jugend,
      selectedTeams,
      activeTeams,
      teamDraft,
      teamValidation,
      fromDate,
      focus,
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
      onSetFromDate: setFromDate,
      onSetFocus: setFocus,
      onAdapterTokenChange: setAdapterToken,
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
      kreisId,
      jugendId,
      kreis,
      jugend,
      selectedTeams,
      activeTeams,
      teamDraft,
      teamValidation,
      fromDate,
      focus,
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
