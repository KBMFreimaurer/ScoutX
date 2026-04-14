import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GhostButton } from "../components/Buttons";
import { useScoutX } from "../context/ScoutXContext";
import { buildDashboardModel } from "../services/dashboard";
import { C } from "../styles/theme";

function formatNumber(value, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateKey(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "–";
  }

  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return "–";
  }

  return parsed.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeriod(fromDateKey, toDateKey) {
  if (!fromDateKey && !toDateKey) {
    return "–";
  }
  if (fromDateKey && toDateKey && fromDateKey !== toDateKey) {
    return `${formatDateKey(fromDateKey)} bis ${formatDateKey(toDateKey)}`;
  }
  return formatDateKey(fromDateKey || toDateKey);
}

function StatCard({ label, value, hint, tone = "default" }) {
  const valueColor = tone === "ok" ? C.greenLight : tone === "warn" ? C.warn : C.white;

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        background: C.surface,
        borderRadius: 12,
        padding: 14,
        minHeight: 96,
      }}
    >
      <div style={{ fontSize: 10, color: C.gray, letterSpacing: "0.13em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 8, color: valueColor, fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>{value}</div>
      {hint ? <div style={{ marginTop: 6, fontSize: 11, color: C.grayLight }}>{hint}</div> : null}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { planHistory, onOpenPlanHistory, isMobile } = useScoutX();
  const model = useMemo(() => buildDashboardModel(planHistory), [planHistory]);
  const hasReports = model.summary.reportCount > 0;

  const topTeams = model.topTeams.slice(0, 6);
  const weekdayActivity = model.weekdayActivity;
  const monthActivity = model.monthActivity.slice(-6);
  const latestReports = model.latestReports.slice(0, 6);

  const maxTeamCount = Math.max(1, ...topTeams.map((item) => item.count));
  const maxWeekdayCount = Math.max(1, ...weekdayActivity.map((item) => item.count));

  return (
    <div className="fu">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 30, fontWeight: 800, color: C.white, letterSpacing: "-0.6px" }}>Dashboard v1</h1>
        <p style={{ margin: "7px 0 0", color: C.gray, fontSize: 13, lineHeight: 1.5, maxWidth: 860 }}>
          Additive Übersicht aus der Plan-Historie: Aktivität, Team-Abdeckung und Fahrkosten-Trends, ohne den bestehenden Setup/Games/Plan-Flow zu verändern.
        </p>
      </div>

      {!hasReports ? (
        <section
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            background: C.surface,
            padding: 18,
          }}
        >
          <div style={{ color: C.offWhite, fontSize: 16, fontWeight: 700 }}>Noch keine Plan-Historie vorhanden</div>
          <p style={{ margin: "8px 0 14px", color: C.gray, fontSize: 13, lineHeight: 1.5 }}>
            Das Dashboard zeigt Kennzahlen aus bereits erstellten Scout-Plänen. Starte zuerst einen Report in Setup/Games und öffne danach das Dashboard erneut.
          </p>
          <GhostButton onClick={() => navigate("/setup")}>Zur Konfiguration</GhostButton>
        </section>
      ) : (
        <>
          <section
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              marginBottom: 14,
            }}
          >
            <StatCard label="Reports" value={formatNumber(model.summary.reportCount)} hint={`${formatNumber(model.summary.avgGamesPerReport, 1)} Spiele je Report`} />
            <StatCard label="Spiele" value={formatNumber(model.summary.gameCount)} hint={formatPeriod(model.summary.earliestDateKey, model.summary.latestDateKey)} />
            <StatCard label="Teams" value={formatNumber(model.summary.uniqueTeamCount)} hint={`${formatNumber(model.summary.uniqueVenueCount)} Spielorte`} />
            <StatCard
              label="Distanz (Abrechnung)"
              value={`${formatNumber(model.summary.totalDistanceKm, 1)} km`}
              hint={`${formatNumber(model.summary.withDistanceCount)}/${formatNumber(model.summary.gameCount)} Spiele mit Distanz`}
            />
            <StatCard
              label="Geschätzte Kosten"
              value={formatCurrency(model.summary.estimatedCostEur)}
              hint={`Abdeckung ${formatNumber(model.summary.distanceCoveragePct, 1)} %`}
              tone="ok"
            />
          </section>

          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
              marginBottom: 14,
            }}
          >
            <div
              className="fu2"
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                background: C.surface,
                padding: 14,
              }}
            >
              <div style={{ color: C.offWhite, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Aktivität je Wochentag</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weekdayActivity.map((item) => (
                  <div key={item.weekday} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) 32px", gap: 10, alignItems: "center" }}>
                    <span style={{ color: C.grayLight, fontSize: 12 }}>{item.label}</span>
                    <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                      <div
                        style={{
                          width: `${Math.round((item.count / maxWeekdayCount) * 100)}%`,
                          minWidth: item.count > 0 ? 8 : 0,
                          height: "100%",
                          background: "linear-gradient(90deg, rgba(0,200,83,0.85), rgba(105,240,174,0.95))",
                        }}
                      />
                    </div>
                    <span style={{ color: C.offWhite, fontSize: 12, textAlign: "right" }}>{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="fu2"
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                background: C.surface,
                padding: 14,
              }}
            >
              <div style={{ color: C.offWhite, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Top-Teams</div>
              {topTeams.length === 0 ? (
                <div style={{ color: C.gray, fontSize: 12 }}>Keine Teamdaten in der Historie vorhanden.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topTeams.map((item) => (
                    <div key={item.team} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 38px", gap: 10, alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.grayLight, fontSize: 12, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.team}
                        </div>
                        <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                          <div
                            style={{
                              width: `${Math.round((item.count / maxTeamCount) * 100)}%`,
                              minWidth: item.count > 0 ? 8 : 0,
                              height: "100%",
                              background: "linear-gradient(90deg, rgba(129,140,248,0.9), rgba(0,200,83,0.8))",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ color: C.offWhite, fontSize: 12, textAlign: "right" }}>{formatNumber(item.count)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section
            className="fu2"
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              background: C.surface,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div style={{ color: C.offWhite, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Monatsverteilung (letzte 6 Monate)</div>
            {monthActivity.length === 0 ? (
              <div style={{ color: C.gray, fontSize: 12 }}>Keine Datumswerte vorhanden.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {monthActivity.map((item) => {
                  const label = `${item.monthKey.slice(5)}.${item.monthKey.slice(0, 4)}`;
                  return (
                    <div
                      key={item.monthKey}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 999,
                        padding: "6px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <span style={{ color: C.grayLight, fontSize: 11 }}>{label}</span>
                      <span style={{ color: C.offWhite, fontSize: 12, fontWeight: 700 }}>{formatNumber(item.count)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section
            className="fu3"
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              background: C.surface,
              padding: 14,
            }}
          >
            <div style={{ color: C.offWhite, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Letzte Reports</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {latestReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 120px 130px auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.offWhite, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {report.jugendLabel || "Jugend"} · {report.kreisLabel || "Kreis"}
                    </div>
                    <div style={{ color: C.gray, fontSize: 11, marginTop: 2 }}>
                      Zeitraum: {formatPeriod(report.fromDateKey, report.toDateKey)} · erstellt {formatDateKey(report.createdAt.slice(0, 10))}
                    </div>
                  </div>

                  <div style={{ color: C.grayLight, fontSize: 11 }}>{formatNumber(report.gameCount)} Spiele</div>
                  <div style={{ color: C.greenLight, fontSize: 11 }}>{formatCurrency(report.estimatedCostEur)}</div>
                  <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                    <GhostButton onClick={() => onOpenPlanHistory(report.id)} style={{ minHeight: 34, padding: "6px 12px", fontSize: 12 }}>
                      Öffnen
                    </GhostButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
