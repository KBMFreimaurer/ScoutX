import { Suspense, lazy, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BMGBadge } from "./components/BMGBadge";
import { StepNav } from "./components/StepNav";
import { C, GCSS } from "./styles/theme";
import { ScoutXProvider, useScoutX } from "./context/ScoutXContext";
import { SetupProvider } from "./context/SetupContext";
import { GamesProvider } from "./context/GamesContext";
import { PlanProvider } from "./context/PlanContext";
import { useScheduleChangeNotifications } from "./hooks/useScheduleChangeNotifications";

const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));
const GamesPage = lazy(() => import("./pages/GamesPage").then((module) => ({ default: module.GamesPage })));
const PlanPage = lazy(() => import("./pages/PlanPage").then((module) => ({ default: module.PlanPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ScoutSheetPage = lazy(() => import("./pages/ScoutSheetPage").then((module) => ({ default: module.ScoutSheetPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));

const DEFAULT_ADAPTER_ENDPOINT = import.meta.env.VITE_ADAPTER_ENDPOINT || "/api/games";

const RAIL_ICONS = {
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
    kreisId,
    jugendId,
    fromDate,
    toDate,
    kreis,
    jugend,
    clearErr,
    onResetSoft,
  } = useScoutX();
  const hasPlanHistory = Array.isArray(planHistory) && planHistory.length > 0;
  const canAccessPlan = Boolean(plan) || hasPlanHistory;
  const {
    latestNotice: latestScheduleNotice,
    dismissLatestNotice,
    browserSupported,
    browserPermission,
    requestBrowserPermission,
  } = useScheduleChangeNotifications({
    games,
    dataSourceUsed,
    kreisId,
    jugendId,
    fromDate,
    toDate,
    kreisLabel: kreis?.label,
    jugendLabel: jugend?.label,
  });

  const currentStep = useMemo(() => {
    if (location.pathname.startsWith("/scout-sheet")) {
      return "sheet";
    }

    if (location.pathname.startsWith("/dashboard")) {
      return "dashboard";
    }

    if (location.pathname.startsWith("/admin")) {
      return "admin";
    }

    if (location.pathname.startsWith("/games")) {
      return "games";
    }

    if (location.pathname.startsWith("/plan")) {
      return "plan";
    }

    return "setup";
  }, [location.pathname]);

  const isDesktopShell = width >= 1050;
  const onStepChange = (nextStep) => {
    navigate(`/${nextStep}`);
  };

  const railItems = [
    { id: "setup", label: "Konfiguration", onClick: () => navigate("/setup") },
    ...(games.length > 0 ? [{ id: "games", label: "Spiele", onClick: () => navigate("/games") }] : []),
    ...(canAccessPlan ? [{ id: "plan", label: "Scout-Plan", onClick: () => navigate("/plan") }] : []),
    { id: "sheet", label: "Bewertungsbogen", onClick: () => navigate("/scout-sheet") },
    { id: "dashboard", label: "Dashboard", onClick: () => navigate("/dashboard") },
    { id: "admin", label: "Adapter-Admin", onClick: () => navigate("/admin") },
  ];

  const liveStatus = err
    ? err
    : loadingGames
      ? "Spiele werden geladen."
      : enrichingGames
        ? "Entfernungen werden aktualisiert."
        : "";

  return (
    <div
      className="app-shell"
      style={{
        color: C.offWhite,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {isDesktopShell ? (
        <aside className="left-rail">
          <div>
            <div className="left-rail-brand">
              <BMGBadge size={28} />
              <span>
                Scout<span className="brand-accent">X</span>
              </span>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {!isDesktopShell ? <BMGBadge size={26} /> : null}
            <div className="top-strip-title">
              Scout<span style={{ color: C.green }}>X</span>
            </div>
          </div>

          <StepNav
            currentStep={currentStep}
            canAccessGames={games.length > 0}
            canAccessPlan={canAccessPlan}
            onStepChange={onStepChange}
            isMobile={isMobile}
          />

          <div className="top-strip-actions">
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
        </header>

        {!isDesktopShell ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              padding: "10px 12px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(6,6,9,0.85)",
            }}
          >
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
          </div>
        ) : null}

        <main className="workspace">
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
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/games" element={games.length ? <GamesPage /> : <Navigate to="/setup" replace />} />
              <Route
                path="/plan"
                element={canAccessPlan ? <PlanPage /> : <Navigate to={games.length ? "/games" : "/setup"} replace />}
              />
              <Route path="/scout-sheet" element={<ScoutSheetPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/setup" replace />} />
            </Routes>
          </Suspense>
        </main>

        <footer
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: "16px 24px",
            textAlign: "center",
          }}
        >
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
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <style>{GCSS}</style>
      <SetupProvider defaultAdapterEndpoint={DEFAULT_ADAPTER_ENDPOINT}>
        <GamesProvider>
          <PlanProvider>
            <ScoutXProvider>
              <AppLayout />
            </ScoutXProvider>
          </PlanProvider>
        </GamesProvider>
      </SetupProvider>
    </>
  );
}
