function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGameRows(games, { highlightKm = false } = {}) {
  if (!games.length) {
    return `<tr><td colspan="6" class="empty-row">Keine Spiele im aktuellen Datensatz.</td></tr>`;
  }

  return games
    .map((game, index) => {
      const home = escapeHtml(game.home);
      const away = escapeHtml(game.away);
      const dateLabel = escapeHtml(game.dateLabel);
      const timeLabel = escapeHtml(game.time);
      const venue = escapeHtml(game.venue);
      const km = escapeHtml(game.km);

      return `<tr><td class="index-cell">${index + 1}</td><td><strong>${home}</strong> vs ${away}</td><td>${dateLabel}</td><td>${timeLabel} Uhr</td><td>${venue}</td><td>${
        highlightKm ? `<span class="badge">${km} km</span>` : `${km} km`
      }</td></tr>`;
    })
    .join("");
}

function buildScoutHtml(games, plan, cfg) {
  const safeGames = Array.isArray(games) ? games : [];
  const topGames = [...safeGames].sort((a, b) => b.priority - a.priority).slice(0, 5);
  const isTurnier = safeGames.some((game) => game.turnier);
  const safeCfg = cfg || {};
  const focusText = safeCfg.focus ? ` · ${escapeHtml(safeCfg.focus)}` : "";
  const safePlan = String(plan || "").trim();
  const titleKreis = escapeHtml(safeCfg.kreisLabel || "ScoutX");
  const kreisLabel = escapeHtml(safeCfg.kreisLabel || "-");
  const jugendLabel = escapeHtml(safeCfg.jugendLabel || "-");
  const jugendAlter = escapeHtml(safeCfg.jugendAlter || "-");
  const fromDate = escapeHtml(safeCfg.fromDate || "-");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ScoutX · ${titleKreis}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;color:#0a1020;background:#fff;padding:30px;font-size:13px}
h1{font-size:22px;font-weight:800;margin-bottom:4px;letter-spacing:-0.3px}
.sub{font-size:12px;color:#00873e;font-weight:600;margin-bottom:4px}
.meta{color:#667;font-size:11px;margin-bottom:18px;letter-spacing:0.5px;text-transform:uppercase}
.actions{margin-bottom:14px}
.actions button{border:1px solid #00b351;background:#e8f8ec;color:#087038;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer}
h2{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#00873e;border-bottom:1px solid #c0e8c8;padding-bottom:5px;margin:20px 0 10px;font-weight:700}
table{width:100%;border-collapse:collapse}
th{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#889;text-align:left;padding:0 10px 7px 0;font-weight:600}
td{padding:7px 10px 7px 0;border-top:1px solid #eef;font-size:12px;vertical-align:top}
.index-cell{color:#999}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;background:#e8f8ec;color:#00873e;font-weight:600}
.plan{white-space:pre-wrap;line-height:1.7;font-size:12px;background:#f4fff6;padding:16px;border-left:3px solid #00c853;border-radius:8px}
.empty-row{color:#667;font-style:italic;padding:10px 0}
.footer{margin-top:28px;font-size:10px;color:#999;text-align:center}
@media print{body{padding:22px}.actions{display:none}}
</style>
</head>
<body>
<div class="actions"><button type="button" onclick="window.print()">Drucken / Als PDF speichern</button></div>
<h1>ScoutX · Spielplan</h1>
<div class="sub">${kreisLabel} · ${jugendLabel} (${jugendAlter} Jahre)${isTurnier ? " · Turnier" : ""}</div>
<div class="meta">Erstellt: ${escapeHtml(new Date().toLocaleString("de-DE"))} · ab ${fromDate}${focusText}</div>
<h2>Top-Empfehlungen</h2>
<table>
<tr><th>#</th><th>Begegnung</th><th>Datum</th><th>Anstoß</th><th>Spielort</th><th>km</th></tr>
${formatGameRows(topGames, { highlightKm: true })}
</table>
<h2>Kompletter Spielplan (${safeGames.length} Spiele)</h2>
<table>
<tr><th>#</th><th>Begegnung</th><th>Datum</th><th>Anstoß</th><th>Spielort</th><th>km</th></tr>
${formatGameRows(safeGames)}
</table>
${safePlan ? `<h2>KI Scout-Analyse</h2><div class="plan">${escapeHtml(safePlan)}</div>` : ""}
<div class="footer">ScoutX · FVN ${kreisLabel} · ${jugendLabel}</div>
</body>
</html>`;
}

export function openScoutPdf(games, plan, cfg, popupWindow = null) {
  const popup = popupWindow || window.open("", "_blank");

  if (!popup) {
    alert("Pop-up blockiert - bitte erlauben.");
    return;
  }

  const html = buildScoutHtml(games, plan, cfg);
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}
