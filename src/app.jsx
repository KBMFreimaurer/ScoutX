import { Suspense, lazy, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BMGBadge } from "./components/BMGBadge";
import { StepNav } from "./components/StepNav";
import { C, GCSS } from "./styles/theme";
import { ScoutXProvider, useScoutX } from "./context/ScoutXContext";
import { SetupProvider } from "./context/SetupContext";
import { GamesProvider } from "./context/GamesContext";
import { PlanProvider } from "./context/PlanContext";

const SetupPage = lazy(() => import("./pages/SetupPage").then((module) => ({ default: module.SetupPage })));
const GamesPage = lazy(() => import("./pages/GamesPage").then((module) => ({ default: module.GamesPage })));
const PlanPage = lazy(() => import("./pages/PlanPage").then((module) => ({ default: module.PlanPage })));

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
  const { width, isMobile, games, plan, err, loadingGames, enrichingGames, clearErr, onResetSoft } = useScoutX();

  const currentStep = useMemo(() => {
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
    ...(plan ? [{ id: "plan", label: "Scout-Plan", onClick: () => navigate("/plan") }] : []),
  ];

  const liveStatus = err
    ? err
    : loadingGames
      ? "Spiele werden geladen."
      : enrichingGames
        ? "Entfernungen und Wetter werden aktualisiert."
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
            canAccessPlan={Boolean(plan)}
            onStepChange={onStepChange}
            isMobile={isMobile}
          />

          <div className="top-strip-actions">
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
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

          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/games" element={games.length ? <GamesPage /> : <Navigate to="/setup" replace />} />
              <Route
                path="/plan"
                element={plan ? <PlanPage /> : <Navigate to={games.length ? "/games" : "/setup"} replace />}
              />
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
