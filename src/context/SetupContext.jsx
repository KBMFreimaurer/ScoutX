import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWindowWidth } from "../hooks/useWindowWidth";
import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { STORAGE_KEYS } from "../config/storage";
import { geocodeAddress, reverseGeocode } from "../utils/geo";
import { normalizeAdapterEndpoint, normalizeTeamParameters, readStorage } from "./shared";

const SetupContext = createContext(null);

function sanitizeLocation(value) {
  const lat = Number(value?.lat);
  const lon = Number(value?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    label: String(value?.label || "").trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
  };
}

function sanitizeIsoDate(value, fallbackIso) {
  const iso = String(value || "").trim();
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return fallbackIso;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return fallbackIso;
  }

  return iso;
}

export function SetupProvider({ children, defaultAdapterEndpoint }) {
  const [setupDefaults] = useState(() => {
    const todayIso = new Date().toISOString().split("T")[0];
    const storedSetup = readStorage(STORAGE_KEYS.setup, {});
    const storedLocation = sanitizeLocation(readStorage(STORAGE_KEYS.location, {}));
    const storedFavorites = readStorage(STORAGE_KEYS.favorites, { teams: [] });
    const storedKreisId = KREISE.some((item) => item.id === storedSetup?.kreisId) ? storedSetup.kreisId : "";
    const storedJugendId = JUGEND_KLASSEN.some((item) => item.id === storedSetup?.jugendId) ? storedSetup.jugendId : "";

    return {
      kreisId: storedKreisId,
      jugendId: storedJugendId,
      selTeams: normalizeTeamParameters(storedSetup?.selTeams),
      fromDate: sanitizeIsoDate(storedSetup?.fromDate, todayIso),
      focus: String(storedSetup?.focus || "").trim(),
      adapterEndpoint: normalizeAdapterEndpoint(storedSetup?.adapterEndpoint, defaultAdapterEndpoint),
      startLocation: storedLocation,
      favorites: normalizeTeamParameters(storedFavorites?.teams),
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
  const [adapterEndpoint, setAdapterEndpoint] = useState(setupDefaults.adapterEndpoint);
  const [adapterToken, setAdapterToken] = useState("");
  const [startLocation, setStartLocation] = useState(setupDefaults.startLocation);
  const [locationDraft, setLocationDraft] = useState(setupDefaults.startLocation?.label || "");
  const [locationError, setLocationError] = useState("");
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [favoriteTeams, setFavoriteTeams] = useState(() => normalizeTeamParameters(setupDefaults.favorites));
  const [favoriteDraft, setFavoriteDraft] = useState("");
  const [err, setErr] = useState("");

  const kreis = useMemo(() => KREISE.find((item) => item.id === kreisId), [kreisId]);
  const jugend = useMemo(() => JUGEND_KLASSEN.find((item) => item.id === jugendId), [jugendId]);
  const activeTeams = useMemo(() => normalizeTeamParameters(selectedTeams), [selectedTeams]);
  const favorites = useMemo(() => normalizeTeamParameters(favoriteTeams), [favoriteTeams]);
  const canBuild = Boolean(kreisId && jugendId);
  const hasLocation = Boolean(startLocation && Number.isFinite(startLocation.lat) && Number.isFinite(startLocation.lon));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEYS.setup,
        JSON.stringify({
          kreisId,
          jugendId,
          selTeams: activeTeams,
          fromDate: sanitizeIsoDate(fromDate, setupDefaults.todayIso),
          focus,
          adapterEndpoint,
        }),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [kreisId, jugendId, activeTeams, fromDate, focus, adapterEndpoint, setupDefaults.todayIso]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (startLocation) {
        window.localStorage.setItem(STORAGE_KEYS.location, JSON.stringify(startLocation));
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.location);
      }
    } catch {
      // Ignore localStorage write errors.
    }
  }, [startLocation]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify({ teams: favorites }));
    } catch {
      // Ignore localStorage write errors.
    }
  }, [favorites]);

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
    setTeamValidation(null);
    setErr("");
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
      setLocationError(error?.message || "Aktueller Standort konnte nicht verwendet werden.");
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
    setAdapterEndpoint(normalizeAdapterEndpoint(defaultAdapterEndpoint, defaultAdapterEndpoint));
    setAdapterToken("");
    setFromDate(setupDefaults.todayIso);
    setFocus("");
    setErr("");
  }, [defaultAdapterEndpoint, setupDefaults.todayIso]);

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
      adapterEndpoint,
      adapterToken,
      startLocation,
      locationDraft,
      locationError,
      resolvingLocation,
      hasLocation,
      favorites,
      favoriteDraft,
      canBuild,
      err,
      setErr,
      clearErr,
      setTeamValidation,
      onSelectKreis,
      onSelectJugend,
      onAddTeamField,
      onUpdateTeamField,
      onNormalizeTeamField,
      onRemoveTeamField,
      onSetTeamDraft: setTeamDraft,
      onClearAllTeams,
      onSetFromDate: setFromDate,
      onSetFocus: setFocus,
      onAdapterEndpointChange: setAdapterEndpoint,
      onAdapterTokenChange: setAdapterToken,
      onSetLocationDraft: setLocationDraft,
      onResolveLocation,
      onUseCurrentLocation,
      onClearLocation,
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
      adapterEndpoint,
      adapterToken,
      startLocation,
      locationDraft,
      locationError,
      resolvingLocation,
      hasLocation,
      favorites,
      favoriteDraft,
      canBuild,
      err,
      clearErr,
      onSelectKreis,
      onSelectJugend,
      onAddTeamField,
      onUpdateTeamField,
      onNormalizeTeamField,
      onRemoveTeamField,
      onClearAllTeams,
      onResolveLocation,
      onUseCurrentLocation,
      onClearLocation,
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
