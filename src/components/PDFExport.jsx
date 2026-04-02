import { C } from "../styles/theme";

function exportToPDF(games, plan, cfg) {
  const topGames = [...games].sort((a, b) => b.priority - a.priority).slice(0, 5);
  const isTurnier = games.some((game) => game.turnier);
  const popup = window.open("", "_blank");

  if (!popup) {
    alert("Pop-up blockiert - bitte erlauben.");
    return;
  }

  popup.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>Scout Spielplan · ${cfg.kreisLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'IBM Plex Sans',sans-serif;color:#0a1020;background:#fff;padding:40px;font-size:13px}
h1{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;margin-bottom:4px}
.sub{font-size:12px;color:#1a6a2a;font-family:'IBM Plex Mono',monospace;margin-bottom:4px}
.meta{color:#667;font-size:11px;margin-bottom:26px;letter-spacing:1px;text-transform:uppercase}
h2{font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#1a6a2a;border-bottom:1px solid #c0e8c8;padding-bottom:5px;margin:22px 0 10px}
table{width:100%;border-collapse:collapse}th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#889;text-align:left;padding:0 10px 7px 0}
td{padding:7px 10px 7px 0;border-top:1px solid #eef;font-size:12px;vertical-align:top}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;background:#e8f8ec;color:#1a6a2a}
.plan{white-space:pre-wrap;line-height:1.75;font-size:12px;background:#f4fff6;padding:16px;border-left:3px solid #1a9a3a;border-radius:4px;font-family:'IBM Plex Mono',monospace}
.footer{margin-top:36px;font-size:10px;color:#aaa;text-align:center}
@media print{body{padding:24px}}
</style></head><body>
<h1>⚽ Scout Spielplan · Niederrhein</h1>
<div class="sub">${cfg.kreisLabel} · ${cfg.jugendLabel} (${cfg.jugendAlter} Jahre)${isTurnier ? " · Turnier" : ""}</div>
<div class="meta">Erstellt: ${new Date().toLocaleString("de-DE")} · ab ${cfg.fromDate}${cfg.focus ? ` · ${cfg.focus}` : ""}</div>
<h2>Top-Empfehlungen</h2>
<table><tr><th>#</th><th>Begegnung</th><th>Datum</th><th>Anstoß</th><th>Spielort</th><th>km</th></tr>
${topGames
  .map(
    (game, index) =>
      `<tr><td>${index + 1}</td><td><strong>${game.home}</strong> vs ${game.away}</td><td>${game.dateLabel}</td><td>${game.time} Uhr</td><td>${game.venue}</td><td><span class="badge">${game.km} km</span></td></tr>`,
  )
  .join("")}
</table>
<h2>Kompletter Spielplan (${games.length} Spiele)</h2>
<table><tr><th>#</th><th>Begegnung</th><th>Datum</th><th>Anstoß</th><th>Spielort</th><th>km</th></tr>
${games
  .map(
    (game, index) =>
      `<tr><td style="color:#999">${index + 1}</td><td>${game.home} vs ${game.away}</td><td>${game.dateLabel}</td><td>${game.time} Uhr</td><td>${game.venue}</td><td>${game.km} km</td></tr>`,
  )
  .join("")}
</table>
${plan ? `<h2>KI Scout-Analyse</h2><div class="plan">${plan}</div>` : ""}
<div class="footer">ScoutPlan · FVN ${cfg.kreisLabel} · ${cfg.jugendLabel}</div>
</body></html>`);

  popup.document.close();
  setTimeout(() => popup.print(), 600);
}

export function PDFExport({ games, plan = "", cfg, label = "↓ PDF", variant = "ghost", style = {} }) {
  const isPrimary = variant === "primary";

  return (
    <button
      onClick={() => exportToPDF(games, plan, cfg)}
      style={
        isPrimary
          ? {
              fontSize: 12,
              padding: "9px 18px",
              borderRadius: 5,
              border: "none",
              background: C.green,
              color: C.white,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 44,
              textTransform: "uppercase",
              ...style,
            }
          : {
              padding: "8px 16px",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              color: C.gray,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 13,
              cursor: "pointer",
              minHeight: 44,
              fontWeight: 500,
              ...style,
            }
      }
    >
      {label}
    </button>
  );
}
