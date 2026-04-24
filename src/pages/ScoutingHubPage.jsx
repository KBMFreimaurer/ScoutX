import { useMemo, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { STORAGE_KEYS } from "../config/storage";
import { useScoutX } from "../context/ScoutXContext";
import { useScoutXProduct } from "../context/ScoutXProductContext";
import {
  ASSIGNMENT_STATUSES,
  REPORT_STATUSES,
  REPORT_TYPES,
  ROLES,
  VISIBILITIES,
  WATCHLIST_ENTRY_STATUSES,
  canRole,
  filterVisibleEntities,
} from "../services/scoutxDomain";
import { buildTimeTrackingModel, formatCurrency, formatDuration } from "../services/timeTracking";
import { C } from "../styles/theme";
import { normalizePresenceMinutes } from "../utils/arbeitszeit";

const FIELD_STYLE = {
  width: "100%",
  minHeight: 40,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  color: C.offWhite,
  padding: "9px 10px",
  fontSize: 13,
};

const TEXTAREA_STYLE = {
  ...FIELD_STYLE,
  minHeight: 84,
  resize: "vertical",
  lineHeight: 1.45,
};

const WORKSPACE_TABS = [
  { id: "overview", label: "Heute" },
  { id: "reports", label: "Reports" },
  { id: "shortlists", label: "Shortlists" },
  { id: "planning", label: "Planung" },
  { id: "time", label: "Zeiterfassungen" },
  { id: "profiles", label: "Profile" },
];

const SEARCH_TYPE_LABELS = {
  report: "Report",
  watchlist: "Shortlist",
  assignment: "Aufgabe",
  player: "Spieler",
  game: "Spiel",
  history: "Historie",
};

const STATUS_LABELS = {
  ...REPORT_STATUSES,
  ...ASSIGNMENT_STATUSES,
};

function readPlayerSheets() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.playerSheets) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDateTime(value) {
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

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function splitTags(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toProfileKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function describeFilter(savedFilter) {
  const parts = [];
  if (savedFilter?.query) {
    parts.push(`"${savedFilter.query}"`);
  }
  if (savedFilter?.filters?.type) {
    parts.push(SEARCH_TYPE_LABELS[savedFilter.filters.type] || savedFilter.filters.type);
  }
  if (savedFilter?.filters?.status) {
    parts.push(STATUS_LABELS[savedFilter.filters.status] || savedFilter.filters.status);
  }
  return parts.length ? parts.join(" · ") : "Alle sichtbaren Inhalte";
}

function Panel({ title, action, children, style }) {
  return (
    <section
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        background: C.surface,
        padding: 14,
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: C.offWhite, fontSize: 14, fontWeight: 800 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone = "default" }) {
  const color = tone === "warn" ? C.warn : tone === "ok" ? C.greenLight : C.white;
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: "rgba(255,255,255,0.035)",
        padding: 12,
        minHeight: 78,
      }}
    >
      <div style={{ color: C.gray, fontSize: 10, letterSpacing: 0, textTransform: "uppercase", fontWeight: 800 }}>{label}</div>
      <div style={{ color, marginTop: 8, fontSize: 24, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function Chip({ children, tone = "default" }) {
  const toneMap = {
    default: { border: C.border, bg: "rgba(255,255,255,0.035)", color: C.grayLight },
    green: { border: C.greenBorder, bg: C.greenDim, color: C.greenLight },
    warn: { border: "rgba(251,191,36,0.22)", bg: C.warnDim, color: C.warn },
    accent: { border: "rgba(129,140,248,0.22)", bg: C.accentDim, color: C.accent },
  };
  const next = toneMap[tone] || toneMap.default;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${next.border}`,
        background: next.bg,
        color: next.color,
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function EmptyState({ children }) {
  return <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.5, padding: "8px 0" }}>{children}</div>;
}

function MiniList({ items, renderItem, empty }) {
  if (!items.length) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return <div style={{ display: "grid", gap: 8 }}>{items.map(renderItem)}</div>;
}

function WorkspaceTabs({ active, onChange, isMobile }) {
  return (
    <nav
      aria-label="Cockpit-Arbeitsbereiche"
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(6, minmax(0,1fr))",
        gap: 6,
        marginBottom: 14,
      }}
    >
      {WORKSPACE_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={selected ? "page" : undefined}
            style={{
              border: `1px solid ${selected ? C.greenBorder : C.border}`,
              borderRadius: 8,
              background: selected ? C.greenDim : "rgba(255,255,255,0.03)",
              color: selected ? C.greenLight : C.grayLight,
              minHeight: 40,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function ScoutingHubPage() {
  const { isMobile, games, planHistory, kmPauschale, onUpdatePlanHistoryPresence, onUpdatePlanHistoryGames } = useScoutX();
  const {
    productState,
    activeUser,
    productError,
    analysisStateByReportId,
    onSwitchUser,
    onUpsertReport,
    onAnalyzeReport,
    onUpdateReportStatus,
    onAddReportComment,
    onCreateWatchlist,
    onAddWatchlistEntry,
    onUpdateWatchlistEntry,
    onRemoveWatchlistEntry,
    onCreateAssignment,
    onUpdateAssignmentStatus,
    onMarkNotificationRead,
    onSaveSearchFilter,
    onDeleteSearchFilter,
    getDashboard,
    search,
    getPlayerProfiles,
    getPlayerComparison,
    getCalendar,
    exportSnapshot,
  } = useScoutXProduct();
  const [playerSheets] = useState(() => readPlayerSheets());
  const [query, setQuery] = useState("");
  const [activeWorkspace, setActiveWorkspace] = useState("overview");
  const [showReportForm, setShowReportForm] = useState(false);
  const [showWatchlistForm, setShowWatchlistForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterName, setFilterName] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [compareLeftKey, setCompareLeftKey] = useState("");
  const [compareRightKey, setCompareRightKey] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedProfileKey, setSelectedProfileKey] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedTimeMonthKey, setSelectedTimeMonthKey] = useState("");
  const [reportForm, setReportForm] = useState({
    title: "",
    type: "player",
    visibility: "team",
    playerName: "",
    tags: "",
    overview: "",
    strengths: "",
    risks: "",
    next: "",
    technical: 3,
    tactical: 3,
    physical: 3,
    mentality: 3,
  });
  const [watchlistName, setWatchlistName] = useState("");
  const [watchlistEntry, setWatchlistEntry] = useState({
    watchlistId: "",
    playerName: "",
    club: "",
    priority: 3,
    status: "monitor",
    labels: "",
    note: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    dueAt: todayIso(),
    assigneeId: activeUser.id,
    linkedReportId: "",
    linkedGameId: "",
    description: "",
  });

  const dashboard = useMemo(() => getDashboard(), [getDashboard]);
  const visibleReports = useMemo(
    () => filterVisibleEntities(productState.reports, activeUser),
    [activeUser, productState.reports],
  );
  const visibleWatchlists = useMemo(
    () => filterVisibleEntities(productState.watchlists, activeUser),
    [activeUser, productState.watchlists],
  );
  const visibleAssignments = useMemo(
    () => filterVisibleEntities(productState.assignments, activeUser),
    [activeUser, productState.assignments],
  );
  const searchResults = useMemo(
    () =>
      search({
        query,
        filters: { type: typeFilter, status: statusFilter },
        games,
        playerSheets,
        planHistory,
      }),
    [games, planHistory, playerSheets, query, search, statusFilter, typeFilter],
  );
  const playerProfiles = useMemo(() => getPlayerProfiles({ playerSheets }), [getPlayerProfiles, playerSheets]);
  const playerComparison = useMemo(
    () => getPlayerComparison(playerProfiles, compareLeftKey, compareRightKey),
    [compareLeftKey, compareRightKey, getPlayerComparison, playerProfiles],
  );
  const calendarGroups = useMemo(() => getCalendar(visibleAssignments, { limit: 8 }), [getCalendar, visibleAssignments]);
  const selectedReport = useMemo(
    () => visibleReports.find((report) => report.id === selectedReportId) || visibleReports[0] || null,
    [selectedReportId, visibleReports],
  );
  const selectedProfile = useMemo(
    () => playerProfiles.find((profile) => profile.key === selectedProfileKey) || playerProfiles[0] || null,
    [playerProfiles, selectedProfileKey],
  );
  const selectedAssignment = useMemo(
    () => visibleAssignments.find((assignment) => assignment.id === selectedAssignmentId) || visibleAssignments[0] || null,
    [selectedAssignmentId, visibleAssignments],
  );
  const timeTracking = useMemo(
    () => buildTimeTrackingModel(planHistory, { defaultKmRate: kmPauschale }),
    [kmPauschale, planHistory],
  );
  const activeTimeMonthKey = selectedTimeMonthKey || timeTracking.latestMonthKey;
  const activeTimeMonth = useMemo(
    () => timeTracking.months.find((month) => month.monthKey === activeTimeMonthKey) || timeTracking.months[0] || null,
    [activeTimeMonthKey, timeTracking.months],
  );
  const activeTimeEntries = useMemo(
    () => timeTracking.entries.filter((entry) => !activeTimeMonth?.monthKey || entry.monthKey === activeTimeMonth.monthKey),
    [activeTimeMonth?.monthKey, timeTracking.entries],
  );
  const visibleSavedFilters = useMemo(
    () => (productState.savedFilters || []).filter((filter) => activeUser.role === "admin" || filter.ownerId === activeUser.id),
    [activeUser, productState.savedFilters],
  );
  const exportSummary = useMemo(
    () => ({
      reports: visibleReports.length,
      watchlists: visibleWatchlists.length,
      assignments: visibleAssignments.length,
      profiles: playerProfiles.length,
      games: games.length,
      history: planHistory.length,
    }),
    [games.length, planHistory.length, playerProfiles.length, visibleAssignments.length, visibleReports.length, visibleWatchlists.length],
  );
  const canWrite = canRole(activeUser.role, "create");
  const selectedWatchlistId = watchlistEntry.watchlistId || visibleWatchlists[0]?.id || "";
  const latestGames = games.slice(0, 8);

  const submitReport = () => {
    const title = reportForm.title.trim();
    if (!title) {
      return;
    }
    const sections = [
      { id: "overview", title: "Kurzprofil", prompt: "Position, Rolle, Spielkontext", text: reportForm.overview },
      { id: "strengths", title: "Stärken", prompt: "Was ist klar überdurchschnittlich?", text: reportForm.strengths },
      { id: "risks", title: "Risiken", prompt: "Was braucht weitere Beobachtung?", text: reportForm.risks },
      { id: "next", title: "Nächster Schritt", prompt: "Empfehlung und Follow-up", text: reportForm.next },
    ];
    onUpsertReport({
      type: reportForm.type,
      title,
      visibility: reportForm.visibility,
      status: "draft",
      context: { playerName: reportForm.playerName },
      tags: splitTags(reportForm.tags),
      ratings: {
        technical: reportForm.technical,
        tactical: reportForm.tactical,
        physical: reportForm.physical,
        mentality: reportForm.mentality,
      },
      sections,
    });
    setReportForm((prev) => ({
      ...prev,
      title: "",
      playerName: "",
      tags: "",
      overview: "",
      strengths: "",
      risks: "",
      next: "",
    }));
    setShowReportForm(false);
  };

  const submitWatchlist = () => {
    if (!watchlistName.trim()) {
      return;
    }
    onCreateWatchlist({ name: watchlistName, visibility: "team" });
    setWatchlistName("");
    setShowWatchlistForm(true);
  };

  const submitWatchlistEntry = () => {
    if (!selectedWatchlistId || !watchlistEntry.playerName.trim()) {
      return;
    }
    onAddWatchlistEntry(selectedWatchlistId, {
      ...watchlistEntry,
      labels: splitTags(watchlistEntry.labels),
    });
    setWatchlistEntry((prev) => ({
      ...prev,
      playerName: "",
      club: "",
      labels: "",
      note: "",
    }));
  };

  const submitAssignment = () => {
    if (!assignmentForm.title.trim()) {
      return;
    }
    onCreateAssignment({
      ...assignmentForm,
      type: assignmentForm.linkedGameId ? "match_observation" : assignmentForm.linkedReportId ? "report_review" : "general_task",
      visibility: "team",
    });
    setAssignmentForm((prev) => ({
      ...prev,
      title: "",
      linkedReportId: "",
      linkedGameId: "",
      description: "",
    }));
    setShowAssignmentForm(false);
  };

  const applySavedFilter = (savedFilter) => {
    setQuery(String(savedFilter?.query || ""));
    setTypeFilter(String(savedFilter?.filters?.type || ""));
    setStatusFilter(String(savedFilter?.filters?.status || ""));
  };

  const clearSearchFilters = () => {
    setQuery("");
    setTypeFilter("");
    setStatusFilter("");
  };

  const submitSavedFilter = () => {
    if (!filterName.trim()) {
      return;
    }
    onSaveSearchFilter({
      name: filterName,
      query,
      filters: { type: typeFilter, status: statusFilter },
    });
    setFilterName("");
  };

  const submitReportComment = (reportId) => {
    const body = String(commentDrafts[reportId] || "").trim();
    if (!body) {
      return;
    }
    onAddReportComment(reportId, body);
    setCommentDrafts((prev) => ({ ...prev, [reportId]: "" }));
  };

  const downloadProductExport = () => {
    const content = exportSnapshot({ playerSheets, games, planHistory });
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scoutx-product-${todayIso()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openSearchResult = (result) => {
    if (!result) {
      return;
    }
    if (result.type === "report" && result.entity?.id) {
      setSelectedReportId(result.entity.id);
      setActiveWorkspace("reports");
      return;
    }
    if (result.type === "watchlist") {
      setWatchlistEntry((prev) => ({ ...prev, watchlistId: result.entity?.id || prev.watchlistId }));
      setActiveWorkspace("shortlists");
      return;
    }
    if (result.type === "assignment" || result.type === "game" || result.type === "history") {
      if (result.type === "assignment" && result.entity?.id) {
        setSelectedAssignmentId(result.entity.id);
      }
      if (result.type === "game" && result.entity?.id) {
        setAssignmentForm((prev) => ({ ...prev, linkedGameId: result.entity.id }));
        setShowAssignmentForm(true);
      }
      setActiveWorkspace("planning");
      return;
    }
    if (result.type === "player") {
      setSelectedProfileKey(toProfileKey(result.entity?.name || result.title));
      setActiveWorkspace("profiles");
    }
  };

  const updateTimeEntryDuration = (entry, rawValue) => {
    const historyId = String(entry?.historyId || "").trim();
    const gameId = String(entry?.gameId || "").trim();
    if (!historyId || !gameId) {
      return;
    }

    const historyEntry = planHistory.find((item) => item.id === historyId);
    if (!historyEntry) {
      return;
    }

    const minutes = normalizePresenceMinutes(rawValue);
    const nextPresence = { ...(historyEntry.presenceByGame || {}) };
    if (Number.isFinite(minutes)) {
      nextPresence[gameId] = minutes;
    } else {
      delete nextPresence[gameId];
    }
    onUpdatePlanHistoryPresence(historyId, nextPresence);
  };

  const updateTimeEntryDistance = (entry, rawValue) => {
    const historyId = String(entry?.historyId || "").trim();
    const gameId = String(entry?.gameId || "").trim();
    if (!historyId || !gameId) {
      return;
    }

    const historyEntry = planHistory.find((item) => item.id === historyId);
    const gamesForEntry = Array.isArray(historyEntry?.games) ? historyEntry.games : [];
    if (!gamesForEntry.length) {
      return;
    }

    const parsedDistance = Number.parseFloat(String(rawValue || "").replace(",", "."));
    const nextGames = gamesForEntry.map((game) => {
      if (String(game?.id || "").trim() !== gameId) {
        return game;
      }
      const nextGame = { ...game };
      if (Number.isFinite(parsedDistance) && parsedDistance >= 0) {
        if (Number.isFinite(Number(nextGame.fromStartRouteDistanceKm))) {
          nextGame.fromStartRouteDistanceKm = parsedDistance;
        } else {
          nextGame.distanceKm = parsedDistance;
        }
      } else {
        delete nextGame.fromStartRouteDistanceKm;
        delete nextGame.distanceKm;
      }
      return nextGame;
    });

    onUpdatePlanHistoryGames(historyId, nextGames);
  };

  return (
    <div className="fu">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, color: C.white, fontSize: isMobile ? 25 : 32, letterSpacing: 0 }}>Scouting-Cockpit</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip tone="green">{ROLES[activeUser.role]}</Chip>
            <Chip>{visibleReports.length} Reports</Chip>
            <Chip>{playerProfiles.length} Profile</Chip>
          </div>
        </div>
        <label style={{ display: "grid", gap: 5, minWidth: 220 }}>
          <span style={{ color: C.gray, fontSize: 11, fontWeight: 700 }}>Aktive Rolle</span>
          <select value={activeUser.id} onChange={(event) => onSwitchUser(event.target.value)} style={FIELD_STYLE}>
            {productState.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {ROLES[user.role]}
              </option>
            ))}
          </select>
        </label>
        <GhostButton onClick={downloadProductExport} style={{ minHeight: 40 }}>
          Domain exportieren
        </GhostButton>
      </div>

      {productError ? (
        <div
          role="alert"
          style={{
            border: "1px solid rgba(239,68,68,0.2)",
            background: C.errorDim,
            color: "#fca5a5",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          {productError}
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 14,
        }}
      >
        <Stat label="Reports" value={dashboard.summary.visibleReports} />
        <Stat label="Offene Aufgaben" value={dashboard.summary.openAssignments} tone={dashboard.summary.openAssignments ? "warn" : "default"} />
        <Stat label="Heute fällig" value={dashboard.summary.dueToday} tone={dashboard.summary.dueToday ? "warn" : "ok"} />
        <Stat label="Shortlists" value={dashboard.summary.watchlists} />
        <Stat label="Profile" value={playerProfiles.length} />
        <Stat label="Arbeitszeit" value={formatDuration(timeTracking.summary.totalMinutes)} />
        <Stat label="Ungelesen" value={dashboard.summary.unreadNotifications} tone={dashboard.summary.unreadNotifications ? "warn" : "default"} />
      </section>

      <WorkspaceTabs active={activeWorkspace} onChange={setActiveWorkspace} isMobile={isMobile} />

      {activeWorkspace === "profiles" ? (
      <section style={{ display: "grid", gap: 14, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,0.9fr) minmax(360px,1.1fr)", marginBottom: 14 }}>
        <Panel title="Spielerprofile & Vergleich">
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", marginBottom: 10 }}>
            <select value={compareLeftKey} onChange={(event) => setCompareLeftKey(event.target.value)} style={FIELD_STYLE}>
              <option value="">Spieler A</option>
              {playerProfiles.map((profile) => (
                <option key={profile.key} value={profile.key}>
                  {profile.name}
                </option>
              ))}
            </select>
            <select value={compareRightKey} onChange={(event) => setCompareRightKey(event.target.value)} style={FIELD_STYLE}>
              <option value="">Spieler B</option>
              {playerProfiles.map((profile) => (
                <option key={profile.key} value={profile.key}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
          {playerComparison ? (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 10, background: "rgba(255,255,255,0.025)" }}>
              <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                {playerComparison.left.name} vs {playerComparison.right.name}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {playerComparison.metrics.map((metric) => (
                  <div key={metric.key} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 8, color: C.grayLight, fontSize: 12 }}>
                    <span>{metric.label}</span>
                    <span style={{ color: metric.leader === "left" ? C.greenLight : C.grayLight }}>{metric.leftValue ?? "-"}</span>
                    <span style={{ color: metric.leader === "right" ? C.greenLight : C.grayLight }}>{metric.rightValue ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <MiniList
            items={playerProfiles.slice(0, 6)}
            empty="Noch keine aggregierten Spielerprofile."
            renderItem={(profile) => (
                <div
                  key={profile.key}
                  style={{
                    border: `1px solid ${selectedProfile?.key === profile.key ? C.greenBorder : C.border}`,
                    borderRadius: 8,
                    padding: 10,
                    background: selectedProfile?.key === profile.key ? C.greenDim : "rgba(255,255,255,0.025)",
                  }}
                >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: C.offWhite, fontSize: 13 }}>{profile.name}</strong>
                  <Chip tone={profile.priority >= 4 ? "warn" : "default"}>P{profile.priority || "-"}</Chip>
                </div>
                <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                  {profile.club || "Verein offen"} · {profile.position || "Position offen"} · Rating {profile.averageRating ?? "-"}
                </div>
                <div style={{ color: C.grayDark, fontSize: 11, marginTop: 4 }}>
                  {profile.reportCount} Reports · {profile.watchlistCount} Shortlists · {profile.assignmentCount} Aufgaben
                </div>
                <GhostButton onClick={() => setSelectedProfileKey(profile.key)} style={{ marginTop: 8, minHeight: 30, padding: "4px 8px", fontSize: 12 }}>
                  Öffnen
                </GhostButton>
              </div>
            )}
          />
        </Panel>

        <Panel title="Profil-Detail">
          {selectedProfile ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ color: C.white, fontSize: 18, fontWeight: 900 }}>{selectedProfile.name}</div>
                <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                  {selectedProfile.club || "Verein offen"} · {selectedProfile.position || "Position offen"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <GhostButton onClick={() => setCompareLeftKey(selectedProfile.key)} style={{ minHeight: 32, padding: "5px 9px", fontSize: 12 }}>
                  Als Spieler A
                </GhostButton>
                <GhostButton onClick={() => setCompareRightKey(selectedProfile.key)} style={{ minHeight: 32, padding: "5px 9px", fontSize: 12 }}>
                  Als Spieler B
                </GhostButton>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                <Stat label="Rating" value={selectedProfile.averageRating ?? "-"} tone="ok" />
                <Stat label="Priorität" value={selectedProfile.priority || "-"} tone={selectedProfile.priority >= 4 ? "warn" : "default"} />
                <Stat label="Reports" value={selectedProfile.reportCount} />
                <Stat label="Aufgaben" value={selectedProfile.assignmentCount} />
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Letzte Signale</div>
                <MiniList
                  items={selectedProfile.notes.slice(0, 4)}
                  empty="Keine Profilnotizen vorhanden."
                  renderItem={(note, index) => (
                    <div key={`${selectedProfile.key}-note-${index}`} style={{ color: C.grayLight, fontSize: 12, lineHeight: 1.45 }}>
                      {String(note).slice(0, 220)}
                    </div>
                  )}
                />
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Shortlist-Kontext</div>
                <MiniList
                  items={selectedProfile.watchlistEntries.slice(0, 5)}
                  empty="Nicht auf einer sichtbaren Shortlist."
                  renderItem={(entry) => (
                    <div key={`${entry.watchlistId}-${entry.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, color: C.grayLight, fontSize: 12 }}>
                      <span>{entry.watchlistName} · {WATCHLIST_ENTRY_STATUSES[entry.status]}</span>
                      <Chip tone={entry.priority >= 4 ? "warn" : "default"}>P{entry.priority}</Chip>
                    </div>
                  )}
                />
              </div>
            </div>
          ) : (
            <EmptyState>Kein Spielerprofil ausgewählt.</EmptyState>
          )}
        </Panel>

      </section>
      ) : null}

      {activeWorkspace === "time" ? (
      <section style={{ display: "grid", gap: 14, gridTemplateColumns: isMobile ? "1fr" : "minmax(320px,0.8fr) minmax(0,1.2fr)", marginBottom: 14 }}>
        <Panel title="Monatsübersicht">
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginBottom: 10 }}>
            <Stat label="Einsätze" value={timeTracking.summary.sessionCount} />
            <Stat label="Erfasst" value={timeTracking.summary.trackedCount} tone="ok" />
            <Stat label="Offen" value={timeTracking.summary.openCount} tone={timeTracking.summary.openCount ? "warn" : "default"} />
            <Stat label="Tankgeld" value={formatCurrency(timeTracking.summary.totalFuelEur)} tone="ok" />
          </div>
          {timeTracking.months.length ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>Monat wechseln</span>
                <Chip tone="accent">{timeTracking.months.length} Monate</Chip>
              </div>
              <select
                value={activeTimeMonth?.monthKey || ""}
                onChange={(event) => setSelectedTimeMonthKey(event.target.value)}
                style={{ ...FIELD_STYLE, marginBottom: 10 }}
              >
                {timeTracking.months.map((month) => (
                  <option key={month.monthKey} value={month.monthKey}>
                    {month.monthLabel}
                  </option>
                ))}
              </select>
              <MiniList
                items={timeTracking.months}
                empty="Noch keine Monate vorhanden."
                renderItem={(month) => (
                  <button
                    type="button"
                    key={month.monthKey}
                    onClick={() => setSelectedTimeMonthKey(month.monthKey)}
                    style={{
                      border: `1px solid ${activeTimeMonth?.monthKey === month.monthKey ? C.greenBorder : C.border}`,
                      borderRadius: 8,
                      padding: 10,
                      background: activeTimeMonth?.monthKey === month.monthKey ? C.greenDim : "rgba(255,255,255,0.025)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ color: C.offWhite, fontSize: 13 }}>{month.monthLabel}</strong>
                      <Chip tone={month.openCount ? "warn" : "green"}>{month.trackedCount}/{month.sessionCount} erfasst</Chip>
                    </div>
                    <div style={{ color: C.gray, fontSize: 12, marginTop: 5 }}>
                      {formatDuration(month.totalMinutes)} · {month.totalRoundtripKm.toFixed(1)} km · {formatCurrency(month.totalFuelEur)}
                    </div>
                  </button>
                )}
              />
            </>
          ) : (
            <EmptyState>Noch keine Zeiterfassungen vorhanden.</EmptyState>
          )}
        </Panel>

        <Panel title={activeTimeMonth ? `Abrechnung ${activeTimeMonth.monthLabel}` : "Abrechnung"}>
          {activeTimeMonth ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                <Stat label="Arbeitszeit" value={formatDuration(activeTimeMonth.totalMinutes)} tone="ok" />
                <Stat label="Tankgeld" value={formatCurrency(activeTimeMonth.totalFuelEur)} tone="ok" />
                <Stat label="km" value={`${activeTimeMonth.totalRoundtripKm.toFixed(1)} km`} />
                <Stat label="Fehlende km" value={activeTimeMonth.missingDistanceCount} tone={activeTimeMonth.missingDistanceCount ? "warn" : "default"} />
              </div>
              <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 620 : 760 }}>
                  <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                    <tr>
                      {["Datum", "Spiel", "Dauer", "km einfach", "Tankgeld", "Status"].map((header) => (
                        <th
                          key={header}
                          style={{
                            color: C.gray,
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            textAlign: header === "Spiel" ? "left" : "right",
                            padding: "8px 10px",
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTimeEntries.map((entry, index) => (
                      <tr key={entry.id} style={index % 2 ? { background: "rgba(255,255,255,0.015)" } : undefined}>
                        <td style={{ color: C.grayLight, fontSize: 12, padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {entry.dateLabel}<br />
                          <span style={{ color: C.grayDark }}>{entry.timeLabel}</span>
                        </td>
                        <td style={{ color: C.offWhite, fontSize: 12, padding: "10px" }}>
                          <strong>{entry.matchLabel}</strong>
                          <div style={{ color: C.gray, fontSize: 11, marginTop: 3 }}>
                            {entry.venueLabel} · {entry.jugendLabel || "Jugend offen"} · {entry.kreisLabel || "Kreis offen"}
                          </div>
                        </td>
                        <td style={{ color: C.grayLight, fontSize: 12, padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={Number.isFinite(entry.minutes) ? entry.minutes : ""}
                            onChange={(event) => updateTimeEntryDuration(entry, event.target.value)}
                            aria-label={`Dauer für ${entry.matchLabel}`}
                            style={{ ...FIELD_STYLE, width: 86, minHeight: 32, padding: "5px 7px", textAlign: "right" }}
                          />
                          <div style={{ color: C.grayDark, fontSize: 11, marginTop: 3 }}>{formatDuration(entry.minutes)}</div>
                        </td>
                        <td style={{ color: C.grayLight, fontSize: 12, padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={Number.isFinite(entry.oneWayDistanceKm) ? entry.oneWayDistanceKm : ""}
                            onChange={(event) => updateTimeEntryDistance(entry, event.target.value)}
                            aria-label={`Einfache Kilometer für ${entry.matchLabel}`}
                            style={{ ...FIELD_STYLE, width: 86, minHeight: 32, padding: "5px 7px", textAlign: "right" }}
                          />
                          <div style={{ color: C.grayDark, fontSize: 11, marginTop: 3 }}>
                            {Number.isFinite(entry.roundtripKm) ? `${entry.roundtripKm.toFixed(1)} km hin/rück` : "km fehlen"}
                          </div>
                        </td>
                        <td style={{ color: C.greenLight, fontSize: 12, padding: "10px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 800 }}>
                          {formatCurrency(entry.fuelEur)}
                        </td>
                        <td style={{ padding: "10px", textAlign: "right" }}>
                          <Chip tone={entry.tracked ? "green" : "warn"}>{entry.tracked ? "erfasst" : "offen"}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState>Keine Monatsdaten vorhanden.</EmptyState>
          )}
        </Panel>
      </section>
      ) : null}

      {activeWorkspace === "overview" ? (
      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
          marginBottom: 14,
        }}
      >
        <Panel title="Globale Suche">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Chip tone={query || typeFilter || statusFilter ? "green" : "default"}>{searchResults.length} Treffer</Chip>
            <Chip>{visibleSavedFilters.length} gespeicherte Sichten</Chip>
            {(query || typeFilter || statusFilter) ? (
              <button
                type="button"
                onClick={clearSearchFilters}
                style={{
                  border: `1px solid ${C.border}`,
                  background: "rgba(255,255,255,0.03)",
                  color: C.grayLight,
                  borderRadius: 8,
                  padding: "3px 8px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Filter leeren
              </button>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 160px 160px", marginBottom: 10 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Spieler, Verein, Report, Aufgabe oder Spiel suchen"
              style={FIELD_STYLE}
            />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={FIELD_STYLE}>
              <option value="">Alle Typen</option>
              <option value="report">Reports</option>
              <option value="watchlist">Watchlists</option>
              <option value="assignment">Aufgaben</option>
              <option value="player">Spieler</option>
              <option value="game">Spiele</option>
              <option value="history">Historie</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={FIELD_STYLE}>
              <option value="">Alle Status</option>
              {Object.entries({ ...REPORT_STATUSES, ...ASSIGNMENT_STATUSES }).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto", marginBottom: 10 }}>
            <input
              value={filterName}
              onChange={(event) => setFilterName(event.target.value)}
              placeholder="Aktuelle Suche als Filter speichern"
              disabled={!canWrite}
              style={FIELD_STYLE}
            />
            <GhostButton onClick={submitSavedFilter} disabled={!canWrite || !filterName.trim()} style={{ minHeight: 40 }}>
              Filter speichern
            </GhostButton>
          </div>
          {visibleSavedFilters.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {visibleSavedFilters.slice(0, 8).map((savedFilter) => (
                <span key={savedFilter.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => applySavedFilter(savedFilter)}
                    title={describeFilter(savedFilter)}
                    style={{
                      border: `1px solid ${C.border}`,
                      background: "rgba(255,255,255,0.03)",
                      color: C.grayLight,
                      borderRadius: 8,
                      padding: "5px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {savedFilter.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSearchFilter(savedFilter.id)}
                    disabled={activeUser.role === "readonly"}
                    aria-label={`Filter ${savedFilter.name} löschen`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: C.gray,
                      cursor: activeUser.role === "readonly" ? "default" : "pointer",
                      fontSize: 13,
                    }}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <MiniList
            items={searchResults.slice(0, 10)}
            empty="Noch keine Treffer. Suche oder Filter anpassen."
            renderItem={(result) => (
              <div key={result.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: "rgba(255,255,255,0.025)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: C.offWhite, fontSize: 13 }}>{result.title}</strong>
                  <Chip tone="accent">{SEARCH_TYPE_LABELS[result.type] || result.type}</Chip>
                </div>
                <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>{result.subtitle || "Kein Zusatzkontext"}</div>
                <GhostButton onClick={() => openSearchResult(result)} style={{ marginTop: 8, minHeight: 30, padding: "4px 8px", fontSize: 12 }}>
                  Öffnen
                </GhostButton>
              </div>
            )}
          />
        </Panel>

        <div style={{ display: "grid", gap: 14 }}>
        <Panel title="Benachrichtigungen">
          <MiniList
            items={dashboard.notifications}
            empty="Keine Benachrichtigungen."
            renderItem={(notification) => (
              <div
                key={notification.id}
                style={{
                  border: `1px solid ${notification.readAt ? C.border : C.greenBorder}`,
                  borderRadius: 8,
                  padding: 10,
                  background: notification.readAt ? "rgba(255,255,255,0.02)" : C.greenDim,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ color: C.offWhite, fontSize: 12 }}>{notification.title}</strong>
                  {!notification.readAt ? (
                    <button
                      type="button"
                      onClick={() => onMarkNotificationRead(notification.id)}
                      style={{ border: "none", background: "transparent", color: C.greenLight, cursor: "pointer", fontSize: 11 }}
                    >
                      gelesen
                    </button>
                  ) : null}
                </div>
                <div style={{ color: C.grayLight, fontSize: 12, marginTop: 4 }}>{notification.body}</div>
                <div style={{ color: C.grayDark, fontSize: 11, marginTop: 4 }}>{formatDateTime(notification.createdAt)}</div>
              </div>
            )}
          />
        </Panel>

        <Panel title="Export & Arbeitsset">
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", marginBottom: 10 }}>
            <Stat label="Reports" value={exportSummary.reports} />
            <Stat label="Profile" value={exportSummary.profiles} />
            <Stat label="Spiele" value={exportSummary.games} />
          </div>
          <div style={{ color: C.grayLight, fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
            Exportiert werden nur Inhalte, die für die aktive Rolle sichtbar sind: {exportSummary.watchlists} Shortlists, {exportSummary.assignments} Aufgaben und {exportSummary.history} Planhistorien.
          </div>
          <GhostButton onClick={downloadProductExport} style={{ minHeight: 36 }}>
            Sichtbaren Datensatz exportieren
          </GhostButton>
        </Panel>
        </div>
      </section>
      ) : null}

      {activeWorkspace === "reports" ? (
      <section style={{ display: "grid", gap: 14, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,0.85fr) minmax(380px,1.15fr)", marginBottom: 14 }}>
        <Panel
          title="Report erfassen"
          style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}
          action={
            <GhostButton onClick={() => setShowReportForm((value) => !value)} disabled={!canWrite} style={{ minHeight: 32, padding: "5px 10px", fontSize: 12 }}>
              {showReportForm ? "Schließen" : "Neu"}
            </GhostButton>
          }
        >
          {showReportForm ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 150px 140px" }}>
              <input
                value={reportForm.title}
                onChange={(event) => setReportForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Report-Titel"
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
              <select
                value={reportForm.type}
                onChange={(event) => setReportForm((prev) => ({ ...prev, type: event.target.value }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              >
                {Object.entries(REPORT_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={reportForm.visibility}
                onChange={(event) => setReportForm((prev) => ({ ...prev, visibility: event.target.value }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              >
                {Object.entries(VISIBILITIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
              <input
                value={reportForm.playerName}
                onChange={(event) => setReportForm((prev) => ({ ...prev, playerName: event.target.value }))}
                placeholder="Spieler / Kontext"
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
              <input
                value={reportForm.tags}
                onChange={(event) => setReportForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Tags, getrennt mit Komma"
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
            </div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              {[
                ["technical", "Technik"],
                ["tactical", "Taktik"],
                ["physical", "Physis"],
                ["mentality", "Mentalität"],
              ].map(([key, label]) => (
                <label key={key} style={{ color: C.gray, fontSize: 11 }}>
                  {label}
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={reportForm[key]}
                    onChange={(event) => setReportForm((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                    disabled={!canWrite}
                    style={{ ...FIELD_STYLE, marginTop: 4 }}
                  />
                </label>
              ))}
            </div>
            <textarea
              value={reportForm.overview}
              onChange={(event) => setReportForm((prev) => ({ ...prev, overview: event.target.value }))}
              placeholder="Kurzprofil / Kontext"
              disabled={!canWrite}
              style={TEXTAREA_STYLE}
            />
            <textarea
              value={reportForm.strengths}
              onChange={(event) => setReportForm((prev) => ({ ...prev, strengths: event.target.value }))}
              placeholder="Stärken"
              disabled={!canWrite}
              style={TEXTAREA_STYLE}
            />
            <textarea
              value={reportForm.risks}
              onChange={(event) => setReportForm((prev) => ({ ...prev, risks: event.target.value }))}
              placeholder="Risiken / offene Fragen"
              disabled={!canWrite}
              style={TEXTAREA_STYLE}
            />
            <textarea
              value={reportForm.next}
              onChange={(event) => setReportForm((prev) => ({ ...prev, next: event.target.value }))}
              placeholder="Nächster Schritt"
              disabled={!canWrite}
              style={TEXTAREA_STYLE}
            />
            <PrimaryButton onClick={submitReport} disabled={!canWrite || !reportForm.title.trim()} style={{ justifySelf: "start" }}>
              Report speichern
            </PrimaryButton>
          </div>
          ) : (
            <MiniList
              items={dashboard.recentReports.slice(0, 5)}
              empty="Keine Reports im aktuellen Sichtbereich."
              renderItem={(report) => (
                <div key={report.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: "rgba(255,255,255,0.025)" }}>
                  <strong style={{ color: C.offWhite, fontSize: 13 }}>{report.title}</strong>
                  <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                    {REPORT_TYPES[report.type]} · {REPORT_STATUSES[report.status]}
                  </div>
                </div>
              )}
            />
          )}
        </Panel>

        <Panel title="Report-Liste">
          <MiniList
            items={visibleReports.slice(0, 10)}
            empty="Noch keine sichtbaren Reports."
            renderItem={(report) => (
              <div
                key={report.id}
                style={{
                  border: `1px solid ${selectedReport?.id === report.id ? C.greenBorder : C.border}`,
                  borderRadius: 8,
                  padding: 10,
                  background: selectedReport?.id === report.id ? C.greenDim : "rgba(255,255,255,0.025)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: C.offWhite, fontSize: 13 }}>{report.title}</strong>
                  <Chip tone={report.status === "in_review" ? "warn" : "green"}>{REPORT_STATUSES[report.status]}</Chip>
                </div>
                <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                  {REPORT_TYPES[report.type]} · {report.context?.playerName || "ohne Spielerbezug"}
                </div>
                <GhostButton onClick={() => setSelectedReportId(report.id)} style={{ marginTop: 8, minHeight: 30, padding: "4px 8px", fontSize: 12 }}>
                  Öffnen
                </GhostButton>
              </div>
            )}
          />
        </Panel>

        <Panel title="Report-Detail">
          {selectedReport ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: C.white, fontSize: 18, fontWeight: 900 }}>{selectedReport.title}</div>
                    <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                      {REPORT_TYPES[selectedReport.type]} · {selectedReport.context?.playerName || "ohne Spielerbezug"} · {formatDateTime(selectedReport.updatedAt)}
                    </div>
                  </div>
                  <Chip>{VISIBILITIES[selectedReport.visibility]}</Chip>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(REPORT_STATUSES).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onUpdateReportStatus(selectedReport.id, key)}
                    disabled={activeUser.role === "readonly" || selectedReport.status === key}
                    style={{
                      border: `1px solid ${selectedReport.status === key ? C.greenBorder : C.border}`,
                      background: selectedReport.status === key ? C.greenDim : "rgba(255,255,255,0.03)",
                      color: selectedReport.status === key ? C.greenLight : C.grayLight,
                      borderRadius: 8,
                      padding: "5px 8px",
                      fontSize: 11,
                      cursor: activeUser.role === "readonly" || selectedReport.status === key ? "default" : "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))" }}>
                {Object.entries(selectedReport.ratings || {}).map(([key, value]) => (
                  <Stat key={key} label={key} value={value} />
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "grid", gap: 8 }}>
                {(selectedReport.sections || []).map((section) => (
                  <div key={section.id}>
                    <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800 }}>{section.title}</div>
                    <div style={{ color: C.grayLight, fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>{section.text || "-"}</div>
                  </div>
                ))}
              </div>
              {selectedReport.ai ? (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800, marginBottom: 4 }}>KI-Assist</div>
                  <div style={{ color: C.grayLight, fontSize: 12, lineHeight: 1.45 }}>{selectedReport.ai.summary}</div>
                  {selectedReport.ai.contradictions.length ? (
                    <div style={{ marginTop: 6, color: C.warn, fontSize: 12 }}>{selectedReport.ai.contradictions[0]}</div>
                  ) : null}
                </div>
              ) : null}
              {analysisStateByReportId[selectedReport.id]?.status === "error" ? (
                <div style={{ color: "#fca5a5", fontSize: 12 }}>{analysisStateByReportId[selectedReport.id].error}</div>
              ) : null}
              <GhostButton
                onClick={() => onAnalyzeReport(selectedReport.id)}
                disabled={analysisStateByReportId[selectedReport.id]?.status === "loading" || activeUser.role === "readonly"}
                style={{ minHeight: 34, padding: "6px 10px", fontSize: 12, justifySelf: "start" }}
              >
                {analysisStateByReportId[selectedReport.id]?.status === "loading" ? "Analyse läuft..." : selectedReport.ai ? "Analyse erneuern" : "KI-Assist auswerten"}
              </GhostButton>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "grid", gap: 6 }}>
                <input
                  value={commentDrafts[selectedReport.id] || ""}
                  onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [selectedReport.id]: event.target.value }))}
                  placeholder="Review-Kommentar"
                  disabled={activeUser.role === "readonly"}
                  style={{ ...FIELD_STYLE, minHeight: 34, padding: "6px 8px" }}
                />
                <GhostButton
                  onClick={() => submitReportComment(selectedReport.id)}
                  disabled={activeUser.role === "readonly" || !String(commentDrafts[selectedReport.id] || "").trim()}
                  style={{ minHeight: 32, padding: "5px 9px", fontSize: 12, justifySelf: "start" }}
                >
                  Kommentar speichern
                </GhostButton>
                {(selectedReport.comments || []).slice(0, 5).map((comment) => (
                  <div key={comment.id} style={{ color: C.gray, fontSize: 11 }}>
                    {comment.body} · {formatDateTime(comment.createdAt)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState>Kein Report ausgewählt.</EmptyState>
          )}
        </Panel>
      </section>
      ) : null}

      {activeWorkspace === "shortlists" || activeWorkspace === "planning" ? (
      <section style={{ display: "grid", gap: 14, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", marginBottom: 14 }}>
        {activeWorkspace === "shortlists" ? (
        <Panel
          title="Watchlists / Shortlists"
          action={
            <GhostButton onClick={() => setShowWatchlistForm((value) => !value)} disabled={!canWrite} style={{ minHeight: 32, padding: "5px 10px", fontSize: 12 }}>
              {showWatchlistForm ? "Schließen" : "Bearbeiten"}
            </GhostButton>
          }
        >
          {showWatchlistForm ? (
          <>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto", marginBottom: 10 }}>
            <input
              value={watchlistName}
              onChange={(event) => setWatchlistName(event.target.value)}
              placeholder="Neue Watchlist"
              disabled={!canWrite}
              style={FIELD_STYLE}
            />
            <GhostButton onClick={submitWatchlist} disabled={!canWrite || !watchlistName.trim()} style={{ minHeight: 40 }}>
              Anlegen
            </GhostButton>
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <select
              value={selectedWatchlistId}
              onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, watchlistId: event.target.value }))}
              disabled={!canWrite || visibleWatchlists.length === 0}
              style={FIELD_STYLE}
            >
              {visibleWatchlists.map((watchlist) => (
                <option key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </option>
              ))}
            </select>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
              <input
                value={watchlistEntry.playerName}
                onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, playerName: event.target.value }))}
                placeholder="Spielername"
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
              <input
                value={watchlistEntry.club}
                onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, club: event.target.value }))}
                placeholder="Verein"
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
            </div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "110px minmax(0,1fr) minmax(0,1fr)" }}>
              <input
                type="number"
                min="1"
                max="5"
                value={watchlistEntry.priority}
                onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, priority: Number(event.target.value) }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
              <select
                value={watchlistEntry.status}
                onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, status: event.target.value }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              >
                {Object.entries(WATCHLIST_ENTRY_STATUSES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={watchlistEntry.labels}
                onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, labels: event.target.value }))}
                placeholder="Labels"
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
            </div>
            <textarea
              value={watchlistEntry.note}
              onChange={(event) => setWatchlistEntry((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Interne Notiz"
              disabled={!canWrite}
              style={TEXTAREA_STYLE}
            />
            <PrimaryButton
              onClick={submitWatchlistEntry}
              disabled={!canWrite || !selectedWatchlistId || !watchlistEntry.playerName.trim()}
              style={{ justifySelf: "start" }}
            >
              Spieler hinzufügen
            </PrimaryButton>
          </div>
          </>
          ) : null}
          <MiniList
            items={visibleWatchlists}
            empty="Noch keine Watchlists."
            renderItem={(watchlist) => (
              <div key={watchlist.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: "rgba(255,255,255,0.025)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: C.offWhite, fontSize: 13 }}>{watchlist.name}</strong>
                  <Chip>{watchlist.entries.length} Spieler</Chip>
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {watchlist.entries.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "grid",
                        gap: 6,
                        gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 74px 130px auto",
                        alignItems: "center",
                        color: C.grayLight,
                        fontSize: 12,
                      }}
                    >
                      <span>{entry.playerName} · {entry.club || "Verein offen"}</span>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={entry.priority}
                        disabled={activeUser.role === "readonly"}
                        onChange={(event) =>
                          onUpdateWatchlistEntry(watchlist.id, entry.id, {
                            priority: Number(event.target.value),
                          })
                        }
                        aria-label={`Priorität für ${entry.playerName}`}
                        style={{ ...FIELD_STYLE, minHeight: 32, padding: "5px 7px" }}
                      />
                      <select
                        value={entry.status}
                        disabled={activeUser.role === "readonly"}
                        onChange={(event) =>
                          onUpdateWatchlistEntry(watchlist.id, entry.id, {
                            status: event.target.value,
                          })
                        }
                        aria-label={`Status für ${entry.playerName}`}
                        style={{ ...FIELD_STYLE, minHeight: 32, padding: "5px 7px" }}
                      >
                        {Object.entries(WATCHLIST_ENTRY_STATUSES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemoveWatchlistEntry(watchlist.id, entry.id)}
                        disabled={activeUser.role === "readonly"}
                        style={{
                          border: `1px solid ${C.border}`,
                          background: "rgba(255,255,255,0.03)",
                          color: "#fca5a5",
                          borderRadius: 8,
                          padding: "5px 8px",
                          fontSize: 11,
                          cursor: activeUser.role === "readonly" ? "default" : "pointer",
                        }}
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          />
        </Panel>
        ) : null}

        {activeWorkspace === "planning" ? (
        <Panel
          title="Kalender / Aufgaben / Zuweisungen"
          action={
            <GhostButton onClick={() => setShowAssignmentForm((value) => !value)} disabled={!canWrite} style={{ minHeight: 32, padding: "5px 10px", fontSize: 12 }}>
              {showAssignmentForm ? "Schließen" : "Neu"}
            </GhostButton>
          }
        >
          <div style={{ marginBottom: 10 }}>
            <MiniList
            items={calendarGroups}
            empty="Noch keine datierten Aufgaben."
            renderItem={(group) => (
                <div key={group.dateKey} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: "rgba(255,255,255,0.025)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: C.offWhite, fontSize: 13 }}>{group.dateKey === "ohne-datum" ? "Ohne Datum" : group.dateKey}</strong>
                    <Chip tone={group.openCount ? "warn" : "green"}>{group.openCount} offen</Chip>
                  </div>
                  <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                    {group.items.slice(0, 4).map((assignment) => (
                      <button
                        type="button"
                        key={assignment.id}
                        onClick={() => setSelectedAssignmentId(assignment.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: selectedAssignment?.id === assignment.id ? C.greenLight : C.grayLight,
                          fontSize: 12,
                          textAlign: "left",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        {assignment.title} · {ASSIGNMENT_STATUSES[assignment.status]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />
          </div>
          {showAssignmentForm ? (
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <input
              value={assignmentForm.title}
              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Aufgabe / Beobachtung"
              disabled={!canWrite}
              style={FIELD_STYLE}
            />
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "150px minmax(0,1fr)" }}>
              <input
                type="date"
                value={assignmentForm.dueAt}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, dueAt: event.target.value }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              />
              <select
                value={assignmentForm.assigneeId}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, assigneeId: event.target.value }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              >
                {productState.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {ROLES[user.role]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
              <select
                value={assignmentForm.linkedReportId}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, linkedReportId: event.target.value }))}
                disabled={!canWrite}
                style={FIELD_STYLE}
              >
                <option value="">Report verknüpfen</option>
                {visibleReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title}
                  </option>
                ))}
              </select>
              <select
                value={assignmentForm.linkedGameId}
                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, linkedGameId: event.target.value }))}
                disabled={!canWrite || latestGames.length === 0}
                style={FIELD_STYLE}
              >
                <option value="">Spiel verknüpfen</option>
                {latestGames.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.home} vs {game.away}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={assignmentForm.description}
              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Notiz / Ziel der Beobachtung"
              disabled={!canWrite}
              style={TEXTAREA_STYLE}
            />
            <PrimaryButton onClick={submitAssignment} disabled={!canWrite || !assignmentForm.title.trim()} style={{ justifySelf: "start" }}>
              Aufgabe anlegen
            </PrimaryButton>
          </div>
          ) : null}
          <MiniList
            items={visibleAssignments.slice(0, 8)}
            empty="Noch keine Aufgaben."
            renderItem={(assignment) => (
              <div
                key={assignment.id}
                style={{
                  border: `1px solid ${selectedAssignment?.id === assignment.id ? C.greenBorder : C.border}`,
                  borderRadius: 8,
                  padding: 10,
                  background: selectedAssignment?.id === assignment.id ? C.greenDim : "rgba(255,255,255,0.025)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: C.offWhite, fontSize: 13 }}>{assignment.title}</strong>
                  <Chip tone={assignment.status === "open" ? "warn" : "green"}>{ASSIGNMENT_STATUSES[assignment.status]}</Chip>
                </div>
                <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                  Fällig: {assignment.dueAt || "-"} · Assignee: {productState.users.find((user) => user.id === assignment.assigneeId)?.name || "-"}
                </div>
                <GhostButton onClick={() => setSelectedAssignmentId(assignment.id)} style={{ marginTop: 8, minHeight: 30, padding: "4px 8px", fontSize: 12 }}>
                  Öffnen
                </GhostButton>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {Object.entries(ASSIGNMENT_STATUSES).map(([key, label]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => onUpdateAssignmentStatus(assignment.id, key)}
                      disabled={activeUser.role === "readonly" || assignment.status === key}
                      style={{
                        border: `1px solid ${assignment.status === key ? C.greenBorder : C.border}`,
                        background: assignment.status === key ? C.greenDim : "rgba(255,255,255,0.03)",
                        color: assignment.status === key ? C.greenLight : C.grayLight,
                        borderRadius: 8,
                        padding: "5px 8px",
                        fontSize: 11,
                        cursor: activeUser.role === "readonly" || assignment.status === key ? "default" : "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />
        </Panel>
        ) : null}

        {activeWorkspace === "planning" ? (
        <Panel title="Aufgaben-Detail">
          {selectedAssignment ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: C.white, fontSize: 18, fontWeight: 900 }}>{selectedAssignment.title}</div>
                    <div style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
                      Fällig: {selectedAssignment.dueAt || "-"} · {productState.users.find((user) => user.id === selectedAssignment.assigneeId)?.name || "-"}
                    </div>
                  </div>
                  <Chip tone={selectedAssignment.status === "open" || selectedAssignment.status === "planned" ? "warn" : "green"}>
                    {ASSIGNMENT_STATUSES[selectedAssignment.status]}
                  </Chip>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(ASSIGNMENT_STATUSES).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onUpdateAssignmentStatus(selectedAssignment.id, key)}
                    disabled={activeUser.role === "readonly" || selectedAssignment.status === key}
                    style={{
                      border: `1px solid ${selectedAssignment.status === key ? C.greenBorder : C.border}`,
                      background: selectedAssignment.status === key ? C.greenDim : "rgba(255,255,255,0.03)",
                      color: selectedAssignment.status === key ? C.greenLight : C.grayLight,
                      borderRadius: 8,
                      padding: "5px 8px",
                      fontSize: 11,
                      cursor: activeUser.role === "readonly" || selectedAssignment.status === key ? "default" : "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                <Stat label="Typ" value={selectedAssignment.type === "match_observation" ? "Match" : selectedAssignment.type === "report_review" ? "Review" : "Task"} />
                <Stat label="Sichtbarkeit" value={VISIBILITIES[selectedAssignment.visibility] || "-"} />
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Kontext</div>
                {selectedAssignment.linkedReportId ? (
                  <div style={{ color: C.grayLight, fontSize: 12, marginBottom: 5 }}>
                    Report: {visibleReports.find((report) => report.id === selectedAssignment.linkedReportId)?.title || selectedAssignment.linkedReportId}
                  </div>
                ) : null}
                {selectedAssignment.linkedGameId ? (
                  <div style={{ color: C.grayLight, fontSize: 12, marginBottom: 5 }}>
                    Spiel: {(() => {
                      const game = games.find((item) => item.id === selectedAssignment.linkedGameId);
                      return game ? `${game.home} vs ${game.away} · ${game.dateLabel || "-"} · ${game.venue || "Ort offen"}` : selectedAssignment.linkedGameId;
                    })()}
                  </div>
                ) : null}
                {!selectedAssignment.linkedReportId && !selectedAssignment.linkedGameId ? (
                  <div style={{ color: C.gray, fontSize: 12 }}>Keine Verknüpfung gesetzt.</div>
                ) : null}
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Arbeitsnotiz</div>
                <div style={{ color: C.grayLight, fontSize: 12, lineHeight: 1.45 }}>{selectedAssignment.description || "Keine Beschreibung hinterlegt."}</div>
              </div>
            </div>
          ) : (
            <EmptyState>Keine Aufgabe ausgewählt.</EmptyState>
          )}
        </Panel>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}
