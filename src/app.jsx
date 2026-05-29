import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BMGBadge } from "./components/BMGBadge";
import { StepNav } from "./components/StepNav";
import { TeamAuthGate } from "./components/TeamAuthGate";
import { C, GCSS } from "./styles/theme";
import { ADAPTER_ENDPOINT } from "./config/adapter";
import { ENABLE_ADMIN_SURFACE, PRIVACY_POLICY_URL, SUPPORT_URL } from "./config/release";
import { ScoutXProvider, useScoutX } from "./context/ScoutXContext";
import { ScoutXProductProvider, useScoutXProduct } from "./context/ScoutXProductContext";
import { SetupProvider } from "./context/SetupContext";
import { GamesProvider } from "./context/GamesContext";
import { PlanProvider } from "./context/PlanContext";
import { useScheduleChangeNotifications } from "./hooks/useScheduleChangeNotifications";
import { isNativeCapacitorRuntime, resolveScoutxDeepLink } from "./native/deepLinks";

const ScoutingHubPage = lazy(() => import("./pages/ScoutingHubPage").then((module) => ({ default: module.ScoutingHubPage })));
const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));
const GamesPage = lazy(() => import("./pages/GamesPage").then((module) => ({ default: module.GamesPage })));
const PlanPage = lazy(() => import("./pages/PlanPage").then((module) => ({ default: module.PlanPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ScoutSheetPage = lazy(() => import("./pages/ScoutSheetPage").then((module) => ({ default: module.ScoutSheetPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const SupportPage = lazy(() => import("./pages/SupportPage").then((module) => ({ default: module.SupportPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })));

const DEFAULT_ADAPTER_ENDPOINT = ADAPTER_ENDPOINT;
const REGISTRATION_TEAMS = [{ key: "borussia-moenchengladbach", label: "Borussia Mönchengladbach" }];

function hasTestAuthBypass() {
  if (import.meta.env?.MODE !== "test" || typeof window === "undefined") {
    return false;
  }

  return window.localStorage?.getItem("scoutx.test.authenticated") === "true";
}

const RAIL_ICONS = {
  hub: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12h6l2-7 4 14 2-7h4" />
      <circle cx="12" cy="12" r="10" opacity="0.35" />
    </svg>
  ),
  setup: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.36-5.36l-4.24 4.24m-4.24-4.24L3.64 3.64m16.72 16.72l-4.24-4.24m-4.24 4.24l-4.24 4.24" />
    </svg>
  ),
  games: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  plan: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  dashboard: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  sheet: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
      <line x1="9" y1="9" x2="10" y2="9" />
    </svg>
  ),
  admin: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

function RouteFallback() {
  return (
    <div
      style={{
        padding: "24px 0",
        color: C.gray,
        fontSize: 13,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      Seite wird geladen...
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    width,
    isMobile,
    games,
    plan,
    planHistory,
    err,
    loadingGames,
    enrichingGames,
    dataSourceUsed,
    kreisIds,
    kreisId,
    jugendId,
    fromDate,
    toDate,
    kreis,
    kreisLabel,
    jugend,
    clearErr,
    onResetSoft,
  } = useScoutX();
  const hasPlanHistory = Array.isArray(planHistory) && planHistory.length > 0;
  const canAccessPlan = Boolean(plan) || hasPlanHistory;
  const adminEnabled = ENABLE_ADMIN_SURFACE;
  const {
    latestNotice: latestScheduleNotice,
    dismissLatestNotice,
    browserSupported,
    browserPermission,
    requestBrowserPermission,
  } = useScheduleChangeNotifications({
    games,
    dataSourceUsed,
    kreisIds,
    kreisId,
    jugendId,
    fromDate,
    toDate,
    kreisLabel: kreisLabel || kreis?.label,
    jugendLabel: jugend?.label,
  });

  const currentStep = useMemo(() => {
    if (location.pathname.startsWith("/hub") || location.pathname === "/") {
      return "hub";
    }

    if (location.pathname.startsWith("/scout-sheet")) {
      return "sheet";
    }

    if (location.pathname.startsWith("/dashboard")) {
      return "dashboard";
    }

    if (adminEnabled && location.pathname.startsWith("/admin")) {
      return "admin";
    }

    if (location.pathname.startsWith("/support")) {
      return "support";
    }

    if (location.pathname.startsWith("/privacy")) {
      return "privacy";
    }

    if (location.pathname.startsWith("/games")) {
      return "games";
    }

    if (location.pathname.startsWith("/plan")) {
      return "plan";
    }

    return "setup";
  }, [adminEnabled, location.pathname]);

  useEffect(() => {
    if (!isNativeCapacitorRuntime()) {
      return undefined;
    }

    let disposeListener = null;
    let disposed = false;

    const attach = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const launchUrl = await App.getLaunchUrl();
        const launchTarget = resolveScoutxDeepLink(launchUrl?.url);
        if (!disposed && launchTarget) {
          navigate(launchTarget, { replace: true });
        }

        const handle = await App.addListener("appUrlOpen", ({ url }) => {
          const target = resolveScoutxDeepLink(url);
          if (target) {
            navigate(target);
          }
        });

        if (!disposed) {
          disposeListener = () => {
            handle.remove();
          };
        }
      } catch {
        // Native URL-Handoff ist optional; Fehler dürfen den App-Start nicht blockieren.
      }
    };

    void attach();

    return () => {
      disposed = true;
      disposeListener?.();
    };
  }, [navigate]);

  const isDesktopShell = width >= 1050;
  const isNativeApp = isNativeCapacitorRuntime();
  const useNativeBottomTabs = isNativeApp && !isDesktopShell;
  const routeUsesPinnedActionDock = currentStep === "setup" || currentStep === "games" || currentStep === "plan";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.setAttribute("data-native-bottom-tabs", useNativeBottomTabs ? "true" : "false");
  }, [useNativeBottomTabs]);

  const onStepChange = (nextStep) => {
    navigate(`/${nextStep}`);
  };

  const railItems = [
    { id: "hub", label: "Cockpit", onClick: () => navigate("/hub") },
    { id: "setup", label: "Konfiguration", onClick: () => navigate("/setup") },
    ...(games.length > 0 ? [{ id: "games", label: "Spiele", onClick: () => navigate("/games") }] : []),
    ...(canAccessPlan ? [{ id: "plan", label: "Scout-Plan", onClick: () => navigate("/plan") }] : []),
    { id: "sheet", label: "Bewertungsbogen", onClick: () => navigate("/scout-sheet") },
    { id: "dashboard", label: "Dashboard", onClick: () => navigate("/dashboard") },
    ...(adminEnabled ? [{ id: "admin", label: "Adapter-Admin", onClick: () => navigate("/admin") }] : []),
  ];

  const liveStatus = err
    ? err
    : loadingGames
      ? "Spiele werden geladen."
      : enrichingGames
        ? "Entfernungen werden aktualisiert."
        : "";

  const nativeBottomTabs = [
    {
      id: "hub",
      label: "Cockpit",
      icon: RAIL_ICONS.hub,
      onClick: () => navigate("/hub"),
      enabled: true,
    },
    {
      id: "games",
      label: "Spiele",
      icon: RAIL_ICONS.games,
      onClick: () => navigate("/games"),
      enabled: games.length > 0,
    },
    {
      id: "setup",
      label: "Konfiguration",
      icon: (
        <span className="native-bottom-tab-center-icon" aria-hidden="true">
          <BMGBadge size={30} variant="full" />
        </span>
      ),
      onClick: () => navigate("/setup"),
      enabled: true,
      center: true,
    },
    {
      id: "plan",
      label: "Plan",
      icon: RAIL_ICONS.plan,
      onClick: () => navigate("/plan"),
      enabled: canAccessPlan,
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: RAIL_ICONS.dashboard,
      onClick: () => navigate("/dashboard"),
      enabled: true,
    },
  ];

  return (
    <div
      className="app-shell"
      style={{
        color: C.offWhite,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <div className="statusbar-shield" aria-hidden="true" />
      {isDesktopShell ? (
        <aside className="left-rail">
          <div>
            <div className="left-rail-brand">
              <BMGBadge size={56} variant="full" />
            </div>
            <div className="left-rail-sub" style={{ marginTop: 4 }}>
              Scouting-Cockpit FVN Niederrhein
            </div>
          </div>

          <nav className="left-menu">
            {railItems.map((item) => {
              const active = currentStep === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`left-menu-item${active ? " active" : ""}`}
                  onClick={() => item.onClick?.()}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  style={{ cursor: "pointer" }}
                >
                  {RAIL_ICONS[item.id]}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button type="button" className="left-rail-cta" onClick={onResetSoft} aria-label="Neuen Report starten">
            + Neuer Report
          </button>
        </aside>
      ) : null}

      <div className="content-shell">
        <header className="top-strip">
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            {isDesktopShell ? (
              <div className="top-strip-title">
                Scout<span style={{ color: C.green }}>X</span>
              </div>
            ) : null}
          </div>

          {!isMobile && !useNativeBottomTabs ? (
            <StepNav
              currentStep={currentStep}
              canAccessGames={games.length > 0}
              canAccessPlan={canAccessPlan}
              onStepChange={onStepChange}
              isMobile={false}
            />
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {!isNativeApp ? (
            <div className="top-strip-actions">
              {adminEnabled ? (
                <button
                  type="button"
                  className="icon-dot"
                  onClick={() => navigate("/admin")}
                  aria-label="Adapter-Admin öffnen"
                  style={{
                    color: currentStep === "admin" ? C.green : C.gray,
                    borderColor: currentStep === "admin" ? C.greenBorder : undefined,
                    background: currentStep === "admin" ? C.greenDim : undefined,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              ) : null}
              <div className="icon-dot">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={C.gray}
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
            </div>
          ) : null}
        </header>

        {!isDesktopShell && !useNativeBottomTabs ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: "10px 12px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(6,6,9,0.85)",
            }}
          >
            <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
              <StepNav
                currentStep={currentStep}
                canAccessGames={games.length > 0}
                canAccessPlan={canAccessPlan}
                onStepChange={onStepChange}
                isMobile
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate("/hub")}
              style={{
                border: currentStep === "hub" ? `1px solid ${C.greenBorder}` : `1px solid ${C.border}`,
                borderRadius: 8,
                minHeight: 34,
                padding: "6px 10px",
                fontSize: 12,
                background: currentStep === "hub" ? C.greenDim : "rgba(255,255,255,0.03)",
                color: currentStep === "hub" ? C.greenLight : C.offWhite,
              }}
            >
              Cockpit
            </button>
            <button
              type="button"
              onClick={() => navigate("/scout-sheet")}
              style={{
                border: currentStep === "sheet" ? `1px solid ${C.greenBorder}` : `1px solid ${C.border}`,
                borderRadius: 8,
                minHeight: 34,
                padding: "6px 10px",
                fontSize: 12,
                background: currentStep === "sheet" ? C.greenDim : "rgba(255,255,255,0.03)",
                color: currentStep === "sheet" ? C.greenLight : C.offWhite,
              }}
            >
              Bewertungsbogen
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              style={{
                border: currentStep === "dashboard" ? `1px solid ${C.greenBorder}` : `1px solid ${C.border}`,
                borderRadius: 8,
                minHeight: 34,
                padding: "6px 10px",
                fontSize: 12,
                background: currentStep === "dashboard" ? C.greenDim : "rgba(255,255,255,0.03)",
                color: currentStep === "dashboard" ? C.greenLight : C.offWhite,
              }}
            >
              Dashboard
            </button>
            {adminEnabled ? (
              <button
                type="button"
                onClick={() => navigate("/admin")}
                style={{
                  border: currentStep === "admin" ? `1px solid ${C.greenBorder}` : `1px solid ${C.border}`,
                  borderRadius: 8,
                  minHeight: 34,
                  padding: "6px 10px",
                  fontSize: 12,
                  background: currentStep === "admin" ? C.greenDim : "rgba(255,255,255,0.03)",
                  color: currentStep === "admin" ? C.greenLight : C.offWhite,
                }}
              >
                Admin
              </button>
            ) : null}
            </div>
          </div>
        ) : null}

        <main
          className="workspace"
          style={{
            paddingBottom: useNativeBottomTabs
              ? routeUsesPinnedActionDock
                ? "calc(12px + var(--safe-bottom))"
                : "calc(108px + var(--safe-bottom))"
              : undefined,
          }}
        >
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {liveStatus}
          </div>
          {err ? (
            <div
              className="fu"
              style={{
                background: C.errorDim,
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 12,
                padding: "12px 16px",
                color: "#fca5a5",
                fontSize: 13,
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{err}</span>
              </div>
              <button
                type="button"
                onClick={clearErr}
                aria-label="Fehlermeldung schließen"
                style={{
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  color: C.gray,
                  padding: 4,
                  border: "none",
                  background: "transparent",
                }}
              >
                x
              </button>
            </div>
          ) : null}

          {latestScheduleNotice ? (
            <div
              className="fu2"
              style={{
                background: C.warnDim,
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: 12,
                padding: "12px 14px",
                color: C.offWhite,
                fontSize: 12,
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: C.warn, fontWeight: 700, marginBottom: 2 }}>Spielplanänderung erkannt</div>
                <div style={{ color: C.offWhite }}>{latestScheduleNotice.message}</div>
                <div style={{ color: C.grayLight, marginTop: 2 }}>{latestScheduleNotice.detail}</div>
                {browserSupported && browserPermission === "default" ? (
                  <button
                    type="button"
                    onClick={() => void requestBrowserPermission()}
                    style={{
                      marginTop: 8,
                      border: `1px solid ${C.borderHi}`,
                      borderRadius: 8,
                      minHeight: 32,
                      padding: "4px 10px",
                      fontSize: 11,
                      background: "rgba(255,255,255,0.06)",
                      color: C.offWhite,
                      cursor: "pointer",
                    }}
                  >
                    Browser-Benachrichtigungen aktivieren
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={dismissLatestNotice}
                aria-label="Hinweis schließen"
                style={{
                  border: "none",
                  background: "transparent",
                  color: C.gray,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                x
              </button>
            </div>
          ) : null}

          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/hub" element={<ScoutingHubPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/games" element={games.length ? <GamesPage /> : <Navigate to="/setup" replace />} />
              <Route
                path="/plan"
                element={canAccessPlan ? <PlanPage /> : <Navigate to={games.length ? "/games" : "/setup"} replace />}
              />
              <Route path="/scout-sheet" element={<ScoutSheetPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/admin" element={adminEnabled ? <AdminPage /> : <Navigate to="/hub" replace />} />
              <Route path="*" element={<Navigate to="/hub" replace />} />
            </Routes>
          </Suspense>
        </main>

        {useNativeBottomTabs ? (
          <nav
            aria-label="App-Hauptnavigation"
            className="native-bottom-tabs"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              borderTop: `1px solid ${C.border}`,
              background: "rgba(6,6,9,0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: "8px 12px calc(10px + var(--safe-bottom))",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
              {nativeBottomTabs.map((tab) => {
                const active = currentStep === tab.id;
                const disabled = !tab.enabled;

                return (
                  <button
                    type="button"
                    key={tab.id}
                    className={`native-bottom-tab-btn${tab.center ? " native-bottom-tab-btn-center" : ""}`}
                    onClick={() => !disabled && tab.onClick()}
                    disabled={disabled}
                    aria-current={active ? "page" : undefined}
                    aria-label={tab.label}
                    style={{
                      minHeight: tab.center ? 56 : 50,
                      borderRadius: 12,
                      border: active ? `1px solid ${C.greenBorder}` : `1px solid transparent`,
                      background: active ? C.greenDim : "transparent",
                      color: active ? C.green : disabled ? C.grayDark : C.grayLight,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0,
                      cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.45 : 1,
                      padding: 0,
                    }}
                  >
                    <span
                      className={`native-bottom-tab-icon${tab.center ? " native-bottom-tab-icon-center" : ""}`}
                      style={{ display: "inline-flex" }}
                      aria-hidden="true"
                    >
                      {tab.icon}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        {!useNativeBottomTabs ? (
          <footer
            style={{
              borderTop: `1px solid ${C.border}`,
              padding: `16px calc(24px + var(--safe-right)) calc(16px + var(--safe-bottom)) calc(24px + var(--safe-left))`,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate("/support")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: C.greenLight,
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Support
              </button>
              <button
                type="button"
                onClick={() => navigate("/privacy")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: C.greenLight,
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Datenschutz
              </button>
              {SUPPORT_URL.startsWith("/") || PRIVACY_POLICY_URL.startsWith("/") ? null : (
                <>
                  <a href={SUPPORT_URL} target="_blank" rel="noreferrer" style={{ color: C.grayLight, fontSize: 12 }}>
                    Support URL
                  </a>
                  <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" style={{ color: C.grayLight, fontSize: 12 }}>
                    Privacy URL
                  </a>
                </>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                color: C.grayDark,
                letterSpacing: "0.5px",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontWeight: 500,
              }}
            >
              ScoutX v1.0
            </span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function AppAuthGate({ children }) {
  const { isMobile } = useScoutX();
  const {
    activeUser,
    teamBackendState,
    onLoginTeamBackend,
    onRegisterTeamBackend,
    onSwitchUser,
  } = useScoutXProduct();
  const [teamLoginPassword, setTeamLoginPassword] = useState("");
  const [teamLoginUserId, setTeamLoginUserId] = useState("");
  const [teamRegisterName, setTeamRegisterName] = useState("");
  const [teamRegisterKey, setTeamRegisterKey] = useState(REGISTRATION_TEAMS[0].key);
  const [teamAuthMode, setTeamAuthMode] = useState("login");
  const [teamLoginBusy, setTeamLoginBusy] = useState(false);
  const authRequired = teamBackendState.status !== "connected" && !hasTestAuthBypass();

  const submitTeamBackendLogin = async (event) => {
    event.preventDefault();
    if (!teamLoginPassword.trim() || teamLoginBusy) {
      return;
    }
    setTeamLoginBusy(true);
    try {
      const userId = teamLoginUserId.trim() || activeUser.id;
      if (teamAuthMode === "register") {
        await onRegisterTeamBackend(userId, teamRegisterName.trim(), teamLoginPassword, teamRegisterKey);
      } else {
        await onLoginTeamBackend(userId, teamLoginPassword);
      }
      if (userId && userId !== activeUser.id) {
        onSwitchUser(userId);
      }
      setTeamRegisterName("");
      setTeamLoginPassword("");
    } finally {
      setTeamLoginBusy(false);
    }
  };

  if (!authRequired) {
    return children;
  }

  return (
    <TeamAuthGate
      isOpen
      isMobile={isMobile}
      mode={teamAuthMode}
      busy={teamLoginBusy}
      status={teamBackendState.status === "auth_error" ? "auth_error" : "auth_required"}
      statusMessage={teamBackendState.error || "Bitte anmelden, bevor du ScoutX nutzt."}
      activeUserId={activeUser.id}
      userId={teamLoginUserId}
      password={teamLoginPassword}
      registerName={teamRegisterName}
      registerTeamKey={teamRegisterKey}
      registerTeams={REGISTRATION_TEAMS}
      onModeChange={setTeamAuthMode}
      onUserIdChange={setTeamLoginUserId}
      onPasswordChange={setTeamLoginPassword}
      onRegisterNameChange={setTeamRegisterName}
      onRegisterTeamKeyChange={setTeamRegisterKey}
      onSubmit={submitTeamBackendLogin}
    />
  );
}

export default function App() {
  return (
    <>
      <style>{GCSS}</style>
      <SetupProvider defaultAdapterEndpoint={DEFAULT_ADAPTER_ENDPOINT}>
        <GamesProvider>
          <PlanProvider>
            <ScoutXProductProvider>
              <ScoutXProvider>
                <AppAuthGate>
                  <AppLayout />
                </AppAuthGate>
              </ScoutXProvider>
            </ScoutXProductProvider>
          </PlanProvider>
        </GamesProvider>
      </SetupProvider>
    </>
  );
}
