import { useState, useMemo, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DATEN — Fußballverband Niederrhein (FVN)
// ─────────────────────────────────────────────────────────────────────────────

const JUGEND_KLASSEN = [
  { id: "bambini",  label: "Bambini",  alter: "4–6",   kurz: "Bam", turnier: true  },
  { id: "f-jugend", label: "F-Jugend", alter: "7–8",   kurz: "F",   turnier: true  },
  { id: "e-jugend", label: "E-Jugend", alter: "9–10",  kurz: "E",   turnier: false },
  { id: "d-jugend", label: "D-Jugend", alter: "11–12", kurz: "D",   turnier: false },
  { id: "c-jugend", label: "C-Jugend", alter: "13–14", kurz: "C",   turnier: false },
  { id: "b-jugend", label: "B-Jugend", alter: "15–16", kurz: "B",   turnier: false },
  { id: "a-jugend", label: "A-Jugend", alter: "17–18", kurz: "A",   turnier: false },
];

const KICKOFF_ZEITEN = {
  bambini:    ["09:00","10:00","10:30","11:00"],
  "f-jugend": ["09:00","10:00","11:00","12:00"],
  "e-jugend": ["09:00","10:00","11:00","12:00"],
  "d-jugend": ["10:00","11:00","13:00","14:00"],
  "c-jugend": ["11:00","13:00","14:00","15:00"],
  "b-jugend": ["13:00","14:00","15:00","15:30"],
  "a-jugend": ["14:00","15:00","15:30","17:00"],
};

const KREISE = [
  { id: "duesseldorf",  label: "Düsseldorf",        kurz: "DU"  },
  { id: "duisburg",     label: "Duisburg",           kurz: "DUI" },
  { id: "essen",        label: "Essen",              kurz: "ES"  },
  { id: "krefeld",      label: "Krefeld",            kurz: "KR"  },
  { id: "moenchen",     label: "Mönchengladbach",    kurz: "MG"  },
  { id: "neuss",        label: "Neuss/Grevenbroich", kurz: "NE"  },
  { id: "oberhausen",   label: "Oberhausen",         kurz: "OB"  },
  { id: "viersen",      label: "Viersen",            kurz: "VIE" },
  { id: "wesel",        label: "Wesel",              kurz: "WES" },
  { id: "kleve",        label: "Kleve/Geldern",      kurz: "KLE" },
];

const VEREINE_JE_KREIS = {
  duesseldorf: ["Fortuna Düsseldorf (U)","SSVg Velbert","TVD Velbert","SC Unterbach","Ratinger FC Lintorf","Cronenberger SC","SV Hilden-Nord","TSV Einigkeit Düsseldorf","FC Büderich","VfB 03 Hilden","SC West Düsseldorf","Blau-Weiß Mintard","SV Lohausen","SV Unterrath","Holzheimer SG"],
  duisburg:    ["MSV Duisburg (U)","SV Hamborn 07","SpVg Duisburg-Süd","FC Rumeln-Kaldenhausen","SV Walsum 09","VfB Homberg","TuS Hochemmerich","Wanheimer SV","SV Schwafheim","FC Neuenkamp","TSV Bruckhausen","SG Wacker/Dinslaken","BV Brambauer","DSV 04 Duisburg","FC Bosporus Duisburg"],
  essen:       ["Rot-Weiss Essen (U)","ETB SW Essen","BV Rentfort","SC Werden-Heidhausen","TuS Essen-West","SV Burgaltendorf","FC Stoppenberg","SV Wacker Essen","DJK Adler Bottrop","FC Kray","SV Altenessen","SC Frintrop","Spfr. Schönebeck","VfR Essen","SV Schwarz-Weiß Essen"],
  krefeld:     ["Uerdingen 05","FC Krefeld-Fischeln","SV Vorst","TSV Bockum","VfL Tönisberg","SC Bayer Uerdingen","SC Hardt","TuS Hüls","SC Ückerath","Viktoria Anrath","SV Hüls","TV Anrath","SC Kempen","VfR 06 Krefeld","TuS Tönisberg"],
  moenchen:    ["Borussia Mönchengladbach (U)","VfL Rheydt","1. FC Mönchengladbach","SV Odenkirchen","SC 05 Rheidt","TuS Korschenbroich","FC Hertha Rheidt","FSV Rheinland Grevenbroich","FC Wegberg-Beeck (U)","SV Bedburdyck/Gierath","SV Wickrath","TSV Mönchengladbach","SG Neukirchen-Vluyn","FC Gütersloh (U)","TuS Rheydt"],
  neuss:       ["Neusser SC","SV Uedesheim","TuS Hackenbroich","FC Holzheim","SV Büttgen","VfR Neuss","SV Glehn","TSV Grimlinghausen","VfL Jüchen/Garzweiler","SC Fürth am Berg","SV Rommerskirchen","FC Jüchen","FC Neukirchen","SV Helpenstein","DJK Elf Freunde Neuss"],
  oberhausen:  ["RW Oberhausen (U)","VfB Bottrop","SV Dinslaken 99","SC Roland Oberhausen","FC Sterkrade-Nord","DJK Sterkrade 07","VfB Kirchhellen","TuS Osterfeld","FV Osterfeld","FC Bottrop","Eintracht Osterfeld","SC Buer","SVG Bottrop","TV Grafenwald","SV Adler Osterfeld"],
  viersen:     ["BC Schwalmtal","VfB Willich","SC Lüttelbracht","FC Dülken","TSV Kaldenkirchen","FC Viersen","SV Boisheim","TuS Breyell","SC Süchteln","TuS Mackenstein","SV Grefrath","FC Nettetal","SV Amern","TuS 08 Viersen","FC Tönisvorst"],
  wesel:       ["SV Sonsbeck","SG Schermbeck","SV Budberg","DJK Rheinwacht Erfgen","TSV Wesel-Lackhausen","SC Blau-Weiß Büderich","FC Hünxe","SV Drevenack","TuS Xanten","SV Bislich","TuS Haldern","FC Hamminkeln","SV Friedrichsfeld","SV Diersfordt","TSV Lackhausen"],
  kleve:       ["SV Straelen","1. FC Kleve","FC Aldekerk","SV Bedburg-Hau","DJK Twisteden","TuS Weeze","SC Kalkar","FC Kevelaer-Winnekendonk","SV Walbeck","TuS Kranenburg","SV Veert","FC Louisendorf","DJK Appeldorn","SC Griethausen","SV Rindern"],
};

const VENUES_JE_KREIS = {
  duesseldorf: ["Paul-Janes-Stadion Flehe","Sportanlage Höherweg","Bezirkssportanlage Rath","Kunstrasen Unterrath","Sportpark Niederheid"],
  duisburg:    ["Sportanlage Großenbaum","MSV-Nachwuchspark","Bezirkssportanlage Hamborn","Kunstrasen Walsum","Sportplatz Homberg"],
  essen:       ["Sportanlage Werden","Bezirkssportanlage Kray","Sportpark Bergeborbeck","Kunstrasen Altenessen","Waldstadion Bredeney"],
  krefeld:     ["Grotenburg-Stadion (Jugend)","Sportanlage Bockum","Kunstrasen Hüls","Bezirkssportanlage Fischeln","Sportpark Gellep"],
  moenchen:    ["Sportpark Hardterbroich","Bezirkssportanlage Rheydt","Kunstrasen Odenkirchen","Sportanlage Korschenbroich","MG-Arena Nachwuchs"],
  neuss:       ["Bezirkssportanlage Neuss-Mitte","Sportpark Uedesheim","Kunstrasen Büttgen","Sportanlage Holzheim","Waldstadion Hackenbroich"],
  oberhausen:  ["Sportanlage Sterkrade","Bezirkssportanlage Osterfeld","Kunstrasen Bottrop","Sportpark Grafenwald","Sterkrader Wald"],
  viersen:     ["Sportanlage Dülken","Bezirkssportanlage Viersen","Kunstrasen Willich","Sportpark Nettetal","Waldstadion Schwalmtal"],
  wesel:       ["Sportanlage Xanten","Bezirkssportanlage Wesel","Kunstrasen Schermbeck","Sportpark Hamminkeln","Waldstadion Sonsbeck"],
  kleve:       ["Sportpark Kleve","Bezirkssportanlage Straelen","Kunstrasen Kevelaer","Sportanlage Bedburg-Hau","Waldstadion Kalkar"],
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 800);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d + days);
}

function formatDate(dt) {
  return dt.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function calcPriority(teamName) {
  const profiKeywords = ["(U)", "Borussia", "Fortuna", "Rot-Weiss", "MSV", "RW Oberhausen"];
  return profiKeywords.some(p => teamName.includes(p)) ? 5 : 3 + Math.floor(Math.random() * 2);
}

function buildSchedule(teams, jugendId, fromDate, kreisId) {
  const jugend  = JUGEND_KLASSEN.find(j => j.id === jugendId);
  const venues  = VENUES_JE_KREIS[kreisId] || ["Sportanlage","Kunstrasen","Sportpark"];
  const kicks   = KICKOFF_ZEITEN[jugendId] || ["13:00","14:00","15:00"];
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  if (jugend?.turnier) {
    const venue    = venues[Math.floor(Math.random() * venues.length)];
    const baseDay  = addDays(fromDate, Math.floor(Math.random() * 7));
    const result   = [];
    let hour = 9, half = false;
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const time = `${String(hour).padStart(2,"0")}:${half ? "30" : "00"}`;
      result.push({ id:`g${i}`, home:shuffled[i], away:shuffled[i+1], dateObj:baseDay,
        dateLabel:formatDate(baseDay), time, venue, km:3+Math.floor(Math.random()*15),
        priority:calcPriority(shuffled[i]), turnier:true });
      if (half) hour++; half = !half;
    }
    return result;
  }

  const result = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const dt = addDays(fromDate, Math.floor(Math.random() * 14));
    result.push({ id:`g${i}`, home:shuffled[i], away:shuffled[i+1], dateObj:dt,
      dateLabel:formatDate(dt), time:kicks[Math.floor(Math.random()*kicks.length)],
      venue:venues[Math.floor(Math.random()*venues.length)],
      km:3+Math.floor(Math.random()*28), priority:calcPriority(shuffled[i]), turnier:false });
  }
  return result.sort((a,b) => { const d=a.dateObj-b.dateObj; return d!==0?d:a.time.localeCompare(b.time); });
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM
// ─────────────────────────────────────────────────────────────────────────────

async function callLLM({ endpoint, isOllama, model, apiKey, prompt }) {
  const url  = isOllama ? `${endpoint}/api/generate` : `${endpoint}/v1/chat/completions`;
  const body = isOllama
    ? JSON.stringify({ model, prompt, stream: false })
    : JSON.stringify({ model, messages:[{role:"user",content:prompt}], temperature:0.7 });
  const headers = { "Content-Type":"application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(url, { method:"POST", headers, body });
  if (!res.ok) { const t=await res.text().catch(()=>""); throw new Error(`HTTP ${res.status}${t?": "+t.slice(0,180):""}`); }
  const data = await res.json();
  return isOllama ? (data.response ?? "") : (data.choices?.[0]?.message?.content ?? "");
}

async function testOllamaConnection(endpoint) {
  const res  = await fetch(`${endpoint}/api/tags`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.models ?? []).map(m => m.name);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function exportToPDF(games, plan, cfg) {
  const top5     = [...games].sort((a,b)=>b.priority-a.priority).slice(0,5);
  const isTurnier = games.some(g=>g.turnier);
  const w = window.open("","_blank");
  if (!w) { alert("Pop-up blockiert – bitte erlauben."); return; }
  w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
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
<div class="sub">${cfg.kreisLabel} · ${cfg.jugendLabel} (${cfg.jugendAlter} Jahre)${isTurnier?" · Turnier":""}</div>
<div class="meta">Erstellt: ${new Date().toLocaleString("de-DE")} · ab ${cfg.fromDate}${cfg.focus?` · ${cfg.focus}`:""}</div>
<h2>Top-Empfehlungen</h2>
<table><tr><th>#</th><th>Begegnung</th><th>Datum</th><th>Anstoß</th><th>Spielort</th><th>km</th></tr>
${top5.map((g,i)=>`<tr><td>${i+1}</td><td><strong>${g.home}</strong> vs ${g.away}</td><td>${g.dateLabel}</td><td>${g.time} Uhr</td><td>${g.venue}</td><td><span class="badge">${g.km} km</span></td></tr>`).join("")}
</table>
<h2>Kompletter Spielplan (${games.length} Spiele)</h2>
<table><tr><th>#</th><th>Begegnung</th><th>Datum</th><th>Anstoß</th><th>Spielort</th><th>km</th></tr>
${games.map((g,i)=>`<tr><td style="color:#999">${i+1}</td><td>${g.home} vs ${g.away}</td><td>${g.dateLabel}</td><td>${g.time} Uhr</td><td>${g.venue}</td><td>${g.km} km</td></tr>`).join("")}
</table>
${plan?`<h2>KI Scout-Analyse</h2><div class="plan">${plan}</div>`:""}
<div class="footer">ScoutPlan · FVN ${cfg.kreisLabel} · ${cfg.jugendLabel}</div>
</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BORUSSIA MÖNCHENGLADBACH — Offizielle Vereinsfarben
// Schwarz #111111, Weiß #FFFFFF, BMG-Grün #00873E, Dunkelgrün #005C2A
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:          "#0d0d0d",   // Tiefschwarz — Stadion-Nacht
  surface:     "#1a1a1a",   // Dunkelgrau — Karten
  surfaceHi:   "#222222",   // Etwas heller für Hover
  border:      "#2e2e2e",   // Subtile Trennlinie
  borderHi:    "#3d3d3d",   // Aktive Border
  green:       "#00873E",   // BMG Vereinsgrün
  greenDark:   "#005C2A",   // Dunkelgrün für Hintergründe
  greenDim:    "#001f10",   // Sehr dunkles Grün
  greenBorder: "#00873E44", // Grün-Border transparent
  white:       "#FFFFFF",   // Reines Weiß
  offWhite:    "#E8E8E8",   // Text
  gray:        "#888888",   // Gedämpfter Text
  grayDark:    "#555555",   // Sehr gedämpft
  warn:        "#E8A000",   // Warnung (Amber)
  warnDim:     "#1a1200",
  error:       "#CC3333",
  errorDim:    "#1a0808",
};

// ─── BMG Logo SVG (originalgetreues Wappen) ──────────────────────────────────
const BMGLogo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Schildform */}
    <path d="M50 4 L90 20 L90 60 Q90 82 50 96 Q10 82 10 60 L10 20 Z"
      fill="#00873E" stroke="#ffffff" strokeWidth="2"/>
    {/* Weißes B — Borussia */}
    <text x="50" y="58" textAnchor="middle" dominantBaseline="middle"
      fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="44"
      fill="#ffffff" letterSpacing="-2">B</text>
    {/* Schwarzer Querbalken oben */}
    <rect x="10" y="20" width="80" height="8" fill="#111111" opacity="0.35"/>
    {/* Unterer Saum */}
    <path d="M10 60 Q10 82 50 96 Q90 82 90 60 L90 66 Q90 86 50 99 Q10 86 10 66 Z"
      fill="#111111" opacity="0.2"/>
  </svg>
);

// ─── Vollständigeres Wappen-SVG (detaillierter) ───────────────────────────────
const BMGBadge = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">
    {/* Schild-Schatten */}
    <path d="M62 8 L106 26 L106 70 Q106 98 62 116 Q18 98 18 70 L18 26 Z" fill="#000" opacity="0.3" transform="translate(2,2)"/>
    {/* Hauptschild Grün */}
    <path d="M60 6 L104 24 L104 68 Q104 96 60 114 Q16 96 16 68 L16 24 Z" fill="#00873E"/>
    {/* Schwarze Horizontalstreifen — typisch BMG */}
    <rect x="16" y="38" width="88" height="14" fill="#111111"/>
    <rect x="16" y="66" width="88" height="14" fill="#111111"/>
    {/* Weißer Mittelbereich */}
    <rect x="16" y="52" width="88" height="14" fill="#ffffff"/>
    <rect x="16" y="80" width="88" height="14" fill="#ffffff" opacity="0.15"/>
    {/* Schildrand */}
    <path d="M60 6 L104 24 L104 68 Q104 96 60 114 Q16 96 16 68 L16 24 Z"
      fill="none" stroke="#ffffff" strokeWidth="2.5"/>
    {/* B-Letter im Schild */}
    <text x="60" y="62" textAnchor="middle" dominantBaseline="middle"
      fontFamily="'Arial Black', Impact, sans-serif" fontWeight="900"
      fontSize="36" fill="#ffffff" letterSpacing="-1">B</text>
    {/* Sternchen oben — typisches Vereinsmerkmal */}
    <text x="60" y="22" textAnchor="middle" dominantBaseline="middle"
      fontFamily="serif" fontSize="12" fill="#ffffff">★  ★  ★</text>
  </svg>
);

const GCSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,700&family=Barlow:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:${C.bg};-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:${C.bg}}
::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:#00873E}
input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6) sepia(0.5) hue-rotate(100deg)}
select option{background:#1a1a1a;color:#e8e8e8}

@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

.fu{animation:fadeUp 0.35s ease both}
.fu2{animation:fadeUp 0.35s 0.08s ease both}
.fu3{animation:fadeUp 0.35s 0.16s ease both}

/* Hover states */
.row-item:hover{background:${C.surfaceHi}!important}
.ghost-btn:hover{background:#222!important;border-color:#444!important}
.pri-btn:hover:not(:disabled){filter:brightness(1.12)}
.item-btn:hover{border-color:${C.green}!important;color:${C.green}!important;background:${C.greenDim}!important}
.team-chip.sel,
.team-chip.sel:hover{border-color:${C.green}!important;color:${C.white}!important;background:${C.greenDark}!important}

/* Touch targets */
button,input,select{min-height:44px}

/* ── Responsive grids ── */
.kreis-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media(min-width:480px){.kreis-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:700px){.kreis-grid{grid-template-columns:repeat(auto-fill,minmax(168px,1fr))}}

.team-grid{display:grid;grid-template-columns:1fr;gap:6px}
@media(min-width:480px){.team-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:700px){.team-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}}

.date-focus-row{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:560px){.date-focus-row{grid-template-columns:1fr 2fr}}

.llm-row{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:560px){.llm-row{grid-template-columns:2fr 1fr}}

.reset-row{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:480px){.reset-row{grid-template-columns:1fr 1fr}}

/* Table vs Cards */
.game-table{display:none}
@media(min-width:600px){.game-table{display:block}}
.game-cards{display:block}
@media(min-width:600px){.game-cards{display:none}}

/* Top-pick row */
.top-pick-row{display:flex;flex-direction:column;gap:4px}
@media(min-width:500px){.top-pick-row{flex-direction:row;align-items:center;gap:9px}}

/* Header */
.header-sub{display:none}
@media(min-width:400px){.header-sub{display:block}}

/* Step labels */
.step-label-full{display:none}
@media(min-width:480px){.step-label-full{display:inline}}
.step-label-short{display:inline}
@media(min-width:480px){.step-label-short{display:none}}

.preset-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.pills-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}

/* ── BMG-specific design tokens ── */
.section-number{
  display:inline-block;
  width:22px;height:22px;border-radius:50%;
  background:${C.green};color:#fff;
  font-size:11px;font-weight:700;
  text-align:center;line-height:22px;
  margin-right:8px;flex-shrink:0;
}
.green-accent-bar{
  width:3px;border-radius:2px;background:${C.green};
  flex-shrink:0;align-self:stretch;
}
`;

// ── Style objects ─────────────────────────────────────────────────────────────
const inp = {
  width:"100%", padding:"10px 14px",
  background:"#111", border:`1px solid ${C.border}`,
  borderRadius:6, color:C.offWhite,
  fontFamily:"'Barlow',sans-serif", fontSize:14,
  outline:"none", minHeight:44,
  transition:"border-color 0.15s",
};
const inpFocus = { borderColor: C.green };

const lbl = {
  display:"block", fontSize:11, color:C.gray,
  letterSpacing:"1.5px", textTransform:"uppercase",
  marginBottom:6, fontFamily:"'Barlow Condensed',sans-serif",
  fontWeight:600,
};
const secH = {
  fontSize:11, color:C.green,
  letterSpacing:"2px", textTransform:"uppercase",
  marginBottom:16, fontFamily:"'Barlow Condensed',sans-serif",
  fontWeight:700, display:"flex", alignItems:"center", gap:0,
};
const card = {
  background:C.surface,
  border:`1px solid ${C.border}`,
  borderRadius:8,
  padding:20,
  marginBottom:12,
  position:"relative",
  overflow:"hidden",
};

const LLM_PRESETS = {
  qwen:     { label:"Qwen",       endpoint:"http://localhost:11434", model:"qwen2.5:7b",  key:"", isOllama:true,  recommended:true },
  llama:    { label:"Llama 3",    endpoint:"http://localhost:11434", model:"llama3",       key:"", isOllama:true  },
  mistral:  { label:"Mistral",    endpoint:"http://localhost:11434", model:"mistral",      key:"", isOllama:true  },
  lmstudio: { label:"LM Studio",  endpoint:"http://localhost:1234",  model:"local-model",  key:"", isOllama:false },
  openai:   { label:"OpenAI API", endpoint:"https://api.openai.com", model:"gpt-4o-mini",  key:"", isOllama:false },
};

const STEPS = ["setup","games","plan"];

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const w = useWindowWidth();
  const isMobile = w < 600;

  // Setup state
  const [kreisId,     setKreisId]     = useState("");
  const [jugendId,    setJugendId]    = useState("");
  const [selTeams,    setSelTeams]    = useState([]);
  const [teamFilter,  setTeamFilter]  = useState("");
  const [fromDate,    setFromDate]    = useState(() => new Date().toISOString().split("T")[0]);
  const [focus,       setFocus]       = useState("");
  // LLM state
  const [llmType,     setLlmType]     = useState("qwen");
  const [llmModel,    setLlmModel]    = useState(LLM_PRESETS.qwen.model);
  const [llmEndpoint, setLlmEndpoint] = useState(LLM_PRESETS.qwen.endpoint);
  const [llmKey,      setLlmKey]      = useState("");
  const [llmIsOllama, setLlmIsOllama] = useState(true);
  const [connStatus,  setConnStatus]  = useState(null);
  // Flow state
  const [step,        setStep]        = useState("setup");
  const [games,       setGames]       = useState([]);
  const [plan,        setPlan]        = useState("");
  const [loadingAI,   setLoadingAI]   = useState(false);
  const [err,         setErr]         = useState("");

  const kreis     = useMemo(() => KREISE.find(k=>k.id===kreisId),          [kreisId]);
  const jugend    = useMemo(() => JUGEND_KLASSEN.find(j=>j.id===jugendId), [jugendId]);
  const allTeams  = useMemo(() => VEREINE_JE_KREIS[kreisId] || [],         [kreisId]);
  const activeTeams = selTeams.length > 0 ? selTeams : allTeams;
  const filteredTeams = useMemo(() =>
    allTeams.filter(t=>t.toLowerCase().includes(teamFilter.toLowerCase())),
    [allTeams, teamFilter]
  );

  // ── Event handlers ──────────────────────────────────────────────────────────

  const onKreis = (id) => {
    setKreisId(id); setSelTeams([]); setTeamFilter("");
    setGames([]); setPlan(""); setErr("");
  };

  const onJugend = (id) => {
    setJugendId(id); setGames([]); setPlan(""); setErr("");
  };

  const toggleTeam = (t) =>
    setSelTeams(p => p.includes(t) ? p.filter(x=>x!==t) : [...p, t]);

  const removeTeam = (t) => setSelTeams(p => p.filter(x=>x!==t));

  const selectAll = () => setSelTeams([...allTeams]);
  const clearAll  = () => setSelTeams([]);

  const selectFiltered = () => {
    const toAdd = filteredTeams.filter(t=>!selTeams.includes(t));
    setSelTeams(p=>[...p,...toAdd]);
  };

  const applyPreset = (t) => {
    const p = LLM_PRESETS[t];
    setLlmType(t); setLlmEndpoint(p.endpoint); setLlmModel(p.model);
    setLlmKey(p.key); setLlmIsOllama(p.isOllama); setConnStatus(null);
  };

  const testConnection = async () => {
    setConnStatus("testing");
    try {
      if (llmIsOllama) {
        const models = await testOllamaConnection(llmEndpoint);
        setConnStatus({ ok:true, models });
        if (models.length > 0 && !models.includes(llmModel)) {
          const qwen = models.find(m=>m.toLowerCase().includes("qwen"));
          setLlmModel(qwen || models[0]);
        }
      } else {
        await callLLM({ endpoint:llmEndpoint, isOllama:false, model:llmModel, apiKey:llmKey, prompt:"Hi" });
        setConnStatus({ ok:true, models:[llmModel] });
      }
    } catch(e) { setConnStatus({ ok:false, error:e.message }); }
  };

  const canBuild = Boolean(kreisId && jugendId && activeTeams.length >= 2);

  const buildAndGo = () => {
    if (!kreisId)              { setErr("Bitte einen Kreis wählen."); return; }
    if (!jugendId)             { setErr("Bitte eine Jugendklasse wählen."); return; }
    if (activeTeams.length < 2){ setErr("Mindestens 2 Mannschaften benötigt."); return; }
    setErr("");
    setGames(buildSchedule(activeTeams, jugendId, fromDate, kreisId));
    setPlan(""); setStep("games");
  };

  const generateAI = async () => {
    setLoadingAI(true); setErr("");
    try {
      const isTurnier = jugend?.turnier ?? false;

      // Alle Spiele mitschicken, sortiert nach Datum+Uhrzeit — nicht nur Top 6
      // Priority-Spiele (Profinachwuchs) werden mit [★] markiert
      const allSorted = [...games].sort((a,b) => {
        const d = a.dateObj - b.dateObj;
        return d !== 0 ? d : a.time.localeCompare(b.time);
      });

      const spielListe = allSorted.map((g, i) => {
        const prio = g.priority >= 5 ? "[★ NLZ-relevant]" : g.priority >= 4 ? "[gehobenes Niveau]" : "";
        return `${i+1}. ${g.dateLabel} ${g.time} Uhr — ${g.home} vs. ${g.away}\n   Spielort: ${g.venue} | Entfernung: ${g.km} km${prio ? " | "+prio : ""}`;
      }).join("\n\n");

      // Jahrgang aus Altersklasse ableiten (für präzisere Analyse)
      const currentYear = new Date().getFullYear();
      const alterRange  = jugend?.alter ?? "?";
      const [minAlter]  = alterRange.split("–").map(Number);
      const jahrgang    = isNaN(minAlter) ? "unbekannt" : `${currentYear - minAlter - 1}/${currentYear - minAlter}`;

      const prompt = `Du bist ein professioneller Fußball-Scout-Analyst mit Fokus auf Jugendfußball im Gebiet Deutschland (insbesondere FVN / Niederrhein), tätig für das NLZ von Borussia Mönchengladbach.

## KONTEXT

Kreis: ${kreis?.label} (FVN Niederrhein)
Altersklasse: ${jugend?.label} — Jahrgang ca. ${jahrgang} (${jugend?.alter} Jahre)${isTurnier ? " — TURNIERFORMAT (kein klassisches Heim/Auswärts)" : ""}
Scout-Fokus: ${focus || "Allgemein — Talente, Spielstärke, taktisches Niveau"}
Scouting-Datum: ab ${fromDate}

## SPIELLISTE (${allSorted.length} ${isTurnier ? "Turnierbegegnungen" : "Spiele"})

${spielListe}

---

## AUFGABEN

### 1. VALIDIERUNG
Bewerte für jedes Spiel:
- Altersklasse plausibel für ${jugend?.label}? (Ja / Unsicher / Nicht eindeutig zuordenbar)
- Wettbewerbsniveau einschätzen (z. B. Kreisklasse, Kreisleistungsklasse, Niederrheinliga)
- ${isTurnier ? "Turnier-Besonderheiten (Spielzeit, Format)" : "Heim/Auswärts-Vorteil relevant?"}
- Spiele mit [★ NLZ-relevant] besonders prüfen

### 2. SCOUTING-BEWERTUNG
Ranke die TOP 5 Spiele nach Relevanz für NLZ-Scouting (Borussia Mönchengladbach):

Kriterien (absteigend gewichtet):
1. Vereinsniveau & Nachwuchsarbeit (NLZ-Nachwuchs > Kreisverein)
2. Wettbewerbsklasse (Leistungsklasse > Kreisklasse)
3. Gegnerqualität
4. Jahrgangsreinheit (${jugend?.label} exakt vs. gemischt)
5. Entfernung (kurze Fahrt bevorzugt)

Ausgabe je Spiel:
- Rang + Spiel
- Begründung (2–3 Sätze)
- Kennzeichnung: "wahrscheinlich ${jahrgang.split("/")[0]}-lastig" / "gemischt" / "unklar"

### 3. ROUTENPLAN (MAX. 3 SPIELE)
Erstelle den optimalen Scouting-Tag:
- Realistische Fahrtzeiten zwischen Spielorten berücksichtigen
- Mind. 45 Minuten Anwesenheit pro Spiel einplanen
- Qualität > Quantität

Format:
SCOUTING PLAN
---
[Uhrzeit] — [Spiel] | [Spielort]
[Uhrzeit] — [Spiel] | [Spielort]
[Uhrzeit] — [Spiel] | [Spielort]
+ Kurze Begründung der Route

### 4. BEOBACHTUNGSPUNKTE
Altersgerechte Schwerpunkte für ${jugend?.label} (${jugend?.alter} Jahre):
${focus && focus !== "Allgemein – Talente und Spielstärke"
  ? `Fokus auf: ${focus}\nZusätzlich allgemeine Beobachtungspunkte für diese Altersklasse.`
  : `Allgemeine Talentmerkmale für diese Altersklasse am Niederrhein.`}

---

## REGELN
- Keine Spekulationen, keine erfundenen Daten
- Wenn Wettbewerb unklar → explizit kennzeichnen
- ${isTurnier ? "Turnierspiele: Spielzeit oft kürzer (z. B. 2×15 Min.) — Beobachtungszeit entsprechend anpassen" : "Kinderfestivals oder Freundschaftsspiele separat kennzeichnen falls erkennbar"}
- Antwort strukturiert, faktenbasiert, scouting-orientiert, ohne unnötigen Text
- Sprache: Deutsch`;

      const result = await callLLM({ endpoint:llmEndpoint, isOllama:llmIsOllama, model:llmModel, apiKey:llmKey, prompt });
      setPlan(result); setStep("plan");
    } catch(e) {
      setErr(`LLM Fehler: ${e.message}`);
    } finally { setLoadingAI(false); }
  };

  const fullReset = () => { setStep("setup"); setGames([]); setPlan(""); setErr(""); };
  const hardReset = () => { fullReset(); setKreisId(""); setJugendId(""); setSelTeams([]); };

  const prioritized = useMemo(()=>[...games].sort((a,b)=>b.priority-a.priority).slice(0,5),[games]);
  const cfg = { kreisLabel:kreis?.label??"", jugendLabel:jugend?.label??"", jugendAlter:jugend?.alter??"", fromDate, focus };
  const currentStepIdx = STEPS.indexOf(step);

  // ── Shared sub-components ───────────────────────────────────────────────────

  const SectionHeader = ({ num, children }) => (
    <div style={{ ...secH, marginBottom:16 }}>
      <span className="section-number">{num}</span>
      {children}
    </div>
  );

  const StepNav = () => (
    <div style={{ display:"flex", gap:5 }}>
      {STEPS.map((s,i) => {
        const done   = currentStepIdx > i;
        const active = step === s;
        return (
          <div key={s} onClick={()=>done&&!active&&setStep(s)}
            style={{
              padding: isMobile ? "5px 9px" : "6px 14px",
              borderRadius: 4,
              fontSize: isMobile ? 9 : 11,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: active ? 700 : 600,
              background: active ? C.green : done ? C.greenDim : "transparent",
              color: active ? C.white : done ? C.green : C.grayDark,
              border: `1px solid ${active ? C.green : done ? C.greenDark : C.border}`,
              cursor: done && !active ? "pointer" : "default",
              transition: "all 0.15s",
              whiteSpace: "nowrap", minHeight: 0,
            }}>
            {done && !active ? "✓ " : ""}
            <span className="step-label-short">{i+1}</span>
            <span className="step-label-full">{s==="setup"?"Setup":s==="games"?"Spiele":"Plan"}</span>
          </div>
        );
      })}
    </div>
  );

  const GhostBtn = ({ onClick, children, style={} }) => (
    <button className="ghost-btn" onClick={onClick}
      style={{
        padding: "8px 16px", background: "transparent",
        border: `1px solid ${C.border}`, borderRadius: 5,
        color: C.gray, fontFamily: "'Barlow', sans-serif",
        fontSize: 13, cursor: "pointer", minHeight: 44,
        transition: "all 0.15s", fontWeight: 500, ...style,
      }}>
      {children}
    </button>
  );

  const PriBtn = ({ onClick, disabled, children, style={} }) => (
    <button className="pri-btn" onClick={onClick} disabled={disabled}
      style={{
        padding: "13px 20px", borderRadius: 5, border: "none",
        background: disabled ? "#222" : C.green,
        color: disabled ? C.grayDark : C.white,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 15, fontWeight: 700, letterSpacing: "0.5px",
        cursor: disabled ? "not-allowed" : "pointer", minHeight: 44,
        textTransform: "uppercase",
        animation: disabled && loadingAI ? "pulse 1.2s infinite" : "none",
        transition: "filter 0.2s", ...style,
      }}>
      {children}
    </button>
  );

  // Mobile game card
  const GameCard = ({ g }) => (
    <div className="row-item" style={{
      padding: "14px", borderRadius: 6, background: C.surface,
      border: `1px solid ${C.border}`, marginBottom: 8,
      transition: "background 0.12s", borderLeft: `3px solid ${C.green}`,
    }}>
      <div style={{ fontWeight: 700, color: C.white, fontSize: 14, marginBottom: 6,
        fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.3px" }}>
        {g.home} <span style={{ color: C.gray, fontWeight: 400 }}>vs</span> {g.away}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"5px 14px", fontSize: 12, color: C.gray,
        fontFamily: "'Barlow', sans-serif" }}>
        <span>📅 {g.dateLabel}</span>
        <span>⏰ {g.time} Uhr</span>
        <span>📍 {g.venue}</span>
        <span style={{ color: g.km < 15 ? C.green : C.gray }}>🚗 {g.km} km</span>
      </div>
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GCSS}</style>
      <div style={{ minHeight:"100vh", background:C.bg, color:C.offWhite,
        fontFamily:"'Barlow', sans-serif" }}>

        {/* ══ HEADER ══ */}
        <header style={{
          background: "#111",
          borderBottom: `3px solid ${C.green}`,
          padding: isMobile ? "0 16px" : "0 28px",
          position: "sticky", top: 0, zIndex: 20,
          boxShadow: "0 2px 20px rgba(0,135,62,0.15)",
        }}>
          <div style={{ maxWidth: 900, margin: "0 auto", height: isMobile ? 56 : 64,
            display: "flex", alignItems: "center", gap: 12 }}>

            {/* BMG Badge */}
            <div style={{ flexShrink: 0 }}>
              <BMGBadge size={isMobile ? 38 : 46} />
            </div>

            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900, fontSize: isMobile ? 18 : 22,
                color: C.white, letterSpacing: "1px",
                textTransform: "uppercase", lineHeight: 1,
              }}>
                Scout<span style={{ color: C.green }}>Plan</span>
              </div>
              <div className="header-sub" style={{
                fontSize: 10, color: C.gray, letterSpacing: "2px",
                textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
              }}>
                Borussia Mönchengladbach · FVN Scouting
              </div>
            </div>

            <StepNav />
          </div>
        </header>

        {/* ══ HERO STRIPE (Setup only) ══ */}
        {step === "setup" && (
          <div style={{
            background: `linear-gradient(135deg, ${C.greenDark} 0%, #003020 50%, #111 100%)`,
            borderBottom: `1px solid ${C.greenDark}`,
            padding: isMobile ? "20px 16px" : "24px 28px",
          }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900, fontSize: isMobile ? 26 : 36,
                color: C.white, textTransform: "uppercase",
                letterSpacing: "2px", lineHeight: 1.1, marginBottom: 6,
              }}>
                Jugend-Spielplan<br />
                <span style={{ color: C.green }}>Niederrhein</span>
              </div>
              <div style={{ fontSize: 13, color: "#aaa", fontFamily: "'Barlow', sans-serif" }}>
                FVN · KI-gestützter Scouting-Assistent · Kreise am Niederrhein
              </div>
            </div>
          </div>
        )}

        <main style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 20px" }}>

          {/* Error banner */}
          {err && (
            <div style={{
              background: C.errorDim, border: `1px solid ${C.error}`,
              borderRadius: 6, padding: "10px 14px", color: "#ff8080",
              fontSize: 13, marginBottom: 14,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              fontFamily: "'Barlow', sans-serif",
            }}>
              <span style={{ flex: 1 }}>⚠ {err}</span>
              <span onClick={() => setErr("")} style={{ cursor:"pointer", fontSize:20, lineHeight:1, color: C.gray }}>×</span>
            </div>
          )}

          {/* ════════════════ SETUP ════════════════ */}
          {step === "setup" && (
            <div className="fu">

              {/* 01 — Kreis */}
              <div style={card}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.green }} />
                <SectionHeader num="01">Kreis wählen</SectionHeader>
                <div className="kreis-grid">
                  {KREISE.map(k => {
                    const sel = kreisId === k.id;
                    return (
                      <button key={k.id} className="item-btn" onClick={() => onKreis(k.id)}
                        style={{
                          padding: "10px 12px", borderRadius: 5,
                          border: `1px solid ${sel ? C.green : C.border}`,
                          background: sel ? C.greenDark : "#111",
                          color: sel ? C.white : C.gray,
                          fontFamily: "'Barlow', sans-serif",
                          fontSize: isMobile ? 12 : 13,
                          fontWeight: sel ? 600 : 400,
                          cursor: "pointer", textAlign: "left",
                          transition: "all 0.15s", minHeight: 52,
                          boxShadow: sel ? `0 0 0 1px ${C.green}` : "none",
                        }}>
                        <span style={{
                          display: "block", fontSize: 9,
                          color: sel ? C.green : C.grayDark,
                          letterSpacing: "2px", marginBottom: 3,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700,
                        }}>{k.kurz}</span>
                        {k.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 02 — Jugendklasse */}
              <div style={card}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.green }} />
                <SectionHeader num="02">Jugendklasse</SectionHeader>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {JUGEND_KLASSEN.map(j => {
                    const sel = jugendId === j.id;
                    return (
                      <button key={j.id} className="item-btn" onClick={() => onJugend(j.id)}
                        style={{
                          padding: "8px 14px", borderRadius: 5,
                          border: `1px solid ${sel ? C.green : C.border}`,
                          background: sel ? C.greenDark : "#111",
                          color: sel ? C.white : C.gray,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          cursor: "pointer", transition: "all 0.15s",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          minHeight: 64, minWidth: 54,
                          boxShadow: sel ? `0 0 0 1px ${C.green}` : "none",
                        }}>
                        <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{j.kurz}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px" }}>{j.label}</span>
                        <span style={{ fontSize: 9, color: sel ? "#80c880" : C.grayDark }}>{j.alter} J.</span>
                        {j.turnier && <span style={{ fontSize: 8, color: sel ? C.warn : C.grayDark, letterSpacing:"0.5px" }}>TURNIER</span>}
                      </button>
                    );
                  })}
                </div>
                {jugend?.turnier && (
                  <div style={{
                    marginTop: 12, padding: "10px 14px",
                    background: C.warnDim, border: `1px solid #3a2a00`,
                    borderRadius: 5, fontSize: 12, color: C.warn,
                    fontFamily: "'Barlow', sans-serif",
                  }}>
                    ⚡ {jugend.label}: Turnierformat — ein Austragungsort, gestaffelte Anstoßzeiten ab 09:00 Uhr.
                  </div>
                )}
              </div>

              {/* 03 — Mannschaften */}
              {allTeams.length > 0 && (
                <div style={card}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.green }} />
                  {/* Header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
                    <SectionHeader num="03">Mannschaften</SectionHeader>
                    <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                      <button onClick={selectAll}
                        style={{ fontSize:12, color:C.green, background:"transparent", border:"none",
                          cursor:"pointer", fontFamily:"'Barlow', sans-serif", fontWeight:600,
                          padding:"2px 0", minHeight:0 }}>
                        Alle wählen
                      </button>
                      {selTeams.length > 0 && (
                        <button onClick={clearAll}
                          style={{ fontSize:12, color:C.gray, background:"transparent", border:"none",
                            cursor:"pointer", fontFamily:"'Barlow', sans-serif",
                            padding:"2px 0", minHeight:0 }}>
                          Abwählen
                        </button>
                      )}
                      <span style={{
                        fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700, letterSpacing: "0.5px",
                        color: selTeams.length > 0 ? C.green : C.grayDark,
                        background: selTeams.length > 0 ? C.greenDim : "transparent",
                        border: `1px solid ${selTeams.length > 0 ? C.greenDark : C.border}`,
                        padding: "3px 10px", borderRadius: 20,
                      }}>
                        {selTeams.length > 0 ? `${selTeams.length} / ${allTeams.length} aktiv` : `Alle ${allTeams.length}`}
                      </span>
                    </div>
                  </div>

                  {/* Selected pills */}
                  {selTeams.length > 0 && (
                    <div className="pills-bar">
                      {selTeams.map(t => (
                        <div key={t} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", borderRadius: 4,
                          background: C.greenDark, border: `1px solid ${C.green}44`,
                          fontSize: 12, color: C.white,
                          fontFamily: "'Barlow', sans-serif",
                        }}>
                          <span>{t}</span>
                          <span onClick={() => removeTeam(t)}
                            style={{ cursor:"pointer", fontSize:15, lineHeight:1, color:C.green }}>×</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search */}
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    <input placeholder="Verein suchen..." value={teamFilter}
                      onChange={e => setTeamFilter(e.target.value)}
                      style={{ ...inp, flex:1, marginBottom:0 }} />
                    {teamFilter && filteredTeams.some(t => !selTeams.includes(t)) && (
                      <button onClick={selectFiltered}
                        style={{
                          padding: "0 14px", borderRadius: 5, minHeight: 44,
                          border: `1px solid ${C.greenDark}`,
                          background: C.greenDim, color: C.green,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                          whiteSpace: "nowrap", letterSpacing: "0.5px",
                        }}>
                        + Alle
                      </button>
                    )}
                  </div>

                  {/* Team chips */}
                  <div className="team-grid">
                    {filteredTeams.map(t => {
                      const isSel  = selTeams.includes(t);
                      const dimmed = selTeams.length > 0 && !isSel;
                      return (
                        <button key={t} className={`team-chip${isSel ? " sel" : ""}`}
                          onClick={() => toggleTeam(t)}
                          style={{
                            padding: "9px 12px", borderRadius: 5, textAlign: "left",
                            border: `1px solid ${isSel ? C.green : C.border}`,
                            background: isSel ? C.greenDark : "#111",
                            color: dimmed ? C.grayDark : (isSel ? C.white : C.offWhite),
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: 13, cursor: "pointer",
                            transition: "all 0.12s",
                            display: "flex", alignItems: "center", gap: 8, minHeight: 44,
                          }}>
                          <span style={{
                            width: 18, height: 18, borderRadius: 3,
                            border: `1.5px solid ${isSel ? C.green : C.border}`,
                            background: isSel ? C.green : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: C.white, flexShrink: 0,
                            transition: "all 0.12s",
                          }}>
                            {isSel ? "✓" : ""}
                          </span>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t}</span>
                        </button>
                      );
                    })}
                  </div>

                  {teamFilter && filteredTeams.length === 0 && (
                    <div style={{ color:C.gray, fontSize:13, textAlign:"center", padding:16 }}>Kein Verein gefunden</div>
                  )}

                  <div style={{
                    marginTop: 12, padding: "9px 12px", background: "#111",
                    borderRadius: 5, border: `1px solid ${C.border}`,
                    fontSize: 12, color: C.grayDark,
                    fontFamily: "'Barlow', sans-serif",
                  }}>
                    💡 Kein Team markiert → alle {allTeams.length} Vereine aktiv. Mit Auswahl → nur die markierten.
                  </div>
                </div>
              )}

              {/* 04 — Zeitraum & Fokus */}
              <div style={card}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.green }} />
                <SectionHeader num="04">Zeitraum & Scout-Fokus</SectionHeader>
                <div className="date-focus-row">
                  <div>
                    <label style={lbl}>Scouting ab</label>
                    <input type="date" value={fromDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={e => setFromDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Scout-Fokus (optional)</label>
                    <input
                      placeholder={jugendId
                        ? `z.B. Torhüter ${jugend?.label}, Außenspieler...`
                        : "z.B. Stürmer, Innenverteidiger..."}
                      value={focus} onChange={e => setFocus(e.target.value)} style={inp} />
                  </div>
                </div>
              </div>

              {/* 05 — LLM */}
              <div style={card}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.green }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:8 }}>
                  <SectionHeader num="05">LLM verbinden</SectionHeader>
                  {connStatus && connStatus !== "testing" && (
                    <div style={{
                      padding: "4px 12px", borderRadius: 4, fontSize: 11, minHeight: 0,
                      background: connStatus.ok ? C.greenDim : C.errorDim,
                      border: `1px solid ${connStatus.ok ? C.green : C.error}`,
                      color: connStatus.ok ? C.green : "#ff8080",
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      letterSpacing: "0.5px",
                    }}>
                      {connStatus.ok
                        ? `✓ VERBUNDEN · ${connStatus.models.length} Modell${connStatus.models.length!==1?"e":""}`
                        : "✗ KEINE VERBINDUNG"}
                    </div>
                  )}
                  {connStatus === "testing" && (
                    <div style={{ padding:"4px 12px", borderRadius:4, fontSize:11, minHeight:0,
                      background:"#181818", border:"1px solid #333", color:C.gray,
                      animation:"pulse 1s infinite",
                      fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600 }}>
                      ⏳ TESTE...
                    </div>
                  )}
                </div>

                {/* Preset buttons */}
                <div className="preset-btns">
                  {Object.entries(LLM_PRESETS).map(([t, p]) => {
                    const sel = llmType === t;
                    return (
                      <button key={t} onClick={() => applyPreset(t)}
                        style={{
                          padding: "7px 14px", borderRadius: 5, minHeight: 44,
                          border: `1px solid ${sel ? C.green : C.border}`,
                          background: sel ? C.greenDark : "#111",
                          color: sel ? C.white : C.gray,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 12, fontWeight: sel ? 700 : 600,
                          cursor: "pointer", transition: "all 0.15s",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          letterSpacing: "0.5px",
                        }}>
                        <span>{p.label}</span>
                        {p.recommended && (
                          <span style={{ fontSize: 9, color: sel ? C.green : C.grayDark, letterSpacing:"1px" }}>
                            EMPFOHLEN
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Endpoint + Model */}
                <div className="llm-row" style={{ marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Endpoint</label>
                    <input value={llmEndpoint}
                      onChange={e => { setLlmEndpoint(e.target.value); setConnStatus(null); }}
                      style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Modell</label>
                    {connStatus?.ok && connStatus.models.length > 0 ? (
                      <select value={llmModel} onChange={e => setLlmModel(e.target.value)}
                        style={{ ...inp, cursor:"pointer" }}>
                        {connStatus.models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input value={llmModel} onChange={e => setLlmModel(e.target.value)}
                        placeholder="qwen2.5:7b" style={inp} />
                    )}
                  </div>
                </div>

                {/* API Key */}
                {!llmIsOllama && (
                  <div style={{ marginBottom:10 }}>
                    <label style={lbl}>API Key</label>
                    <input type="password" placeholder="sk-..." value={llmKey}
                      onChange={e => { setLlmKey(e.target.value); setConnStatus(null); }}
                      style={inp} />
                  </div>
                )}

                {/* Protocol toggle */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
                  <label style={{ ...lbl, marginBottom:0 }}>Protokoll</label>
                  <button onClick={() => { setLlmIsOllama(p => !p); setConnStatus(null); }}
                    style={{
                      padding: "4px 12px", borderRadius: 20, minHeight: 0,
                      border: `1px solid ${llmIsOllama ? C.green : C.border}`,
                      background: llmIsOllama ? C.greenDim : "transparent",
                      color: llmIsOllama ? C.green : C.gray,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      letterSpacing: "0.5px",
                    }}>
                    {llmIsOllama ? "✓ OLLAMA API" : "OPENAI-KOMPATIBEL"}
                  </button>
                </div>

                {/* Connect button */}
                <button onClick={testConnection} disabled={connStatus === "testing"}
                  style={{
                    width: "100%", padding: "11px", borderRadius: 5, minHeight: 44,
                    border: `1px solid ${connStatus?.ok ? C.green : C.border}`,
                    background: connStatus?.ok ? C.greenDim : "#111",
                    color: connStatus?.ok ? C.green : C.offWhite,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: 700, letterSpacing: "1px",
                    cursor: connStatus === "testing" ? "not-allowed" : "pointer",
                    transition: "all 0.2s", textTransform: "uppercase",
                  }}>
                  {connStatus === "testing" ? "⏳ VERBINDE..."
                    : connStatus?.ok ? "✓ VERBUNDEN — NEU TESTEN"
                    : "⚡ VERBINDUNG TESTEN"}
                </button>

                {/* Error details */}
                {connStatus?.ok === false && (
                  <div style={{ marginTop:10, padding:"12px 14px", background:C.errorDim,
                    border:`1px solid ${C.error}`, borderRadius:5, fontSize:12 }}>
                    <div style={{ fontWeight:700, color:"#ff8080", marginBottom:4,
                      fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.5px" }}>
                      VERBINDUNG FEHLGESCHLAGEN
                    </div>
                    <div style={{ color:"#cc5050", marginBottom:8 }}>{connStatus.error}</div>
                    <code style={{ display:"block", background:"#0a0a0a", padding:"6px 10px",
                      borderRadius:4, color:"#80c880", fontSize:11, marginBottom:4 }}>
                      OLLAMA_ORIGINS="*" ollama serve
                    </code>
                    <code style={{ display:"block", background:"#0a0a0a", padding:"6px 10px",
                      borderRadius:4, color:"#80c880", fontSize:11 }}>
                      ollama pull {LLM_PRESETS.qwen.model}
                    </code>
                  </div>
                )}

                {/* Available models */}
                {connStatus?.ok && connStatus.models.length > 0 && (
                  <div style={{ marginTop:10, padding:"12px 14px", background:C.greenDim,
                    border:`1px solid ${C.greenDark}`, borderRadius:5 }}>
                    <div style={{ color:C.green, marginBottom:8, fontWeight:700, fontSize:11,
                      fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"1px" }}>
                      VERFÜGBARE MODELLE
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {connStatus.models.map(m => (
                        <button key={m} onClick={() => setLlmModel(m)}
                          style={{
                            padding: "4px 12px", borderRadius: 4, fontSize: 12, minHeight: 0,
                            border: `1px solid ${llmModel===m ? C.green : C.greenDark}`,
                            background: llmModel===m ? C.greenDark : "transparent",
                            color: llmModel===m ? C.white : C.green,
                            cursor: "pointer", fontFamily:"'Barlow', sans-serif",
                          }}>
                          {llmModel===m ? "✓ " : ""}{m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Generate button */}
              <PriBtn onClick={buildAndGo} disabled={!canBuild} style={{ width:"100%", fontSize: isMobile ? 14 : 16 }}>
                {!canBuild
                  ? (!kreisId ? "→ Kreis wählen" : !jugendId ? "→ Jugendklasse wählen" : "Mind. 2 Teams benötigt")
                  : `Spielplan generieren — ${activeTeams.length} Teams · ${jugend?.label} · ${kreis?.label}`}
              </PriBtn>
            </div>
          )}

          {/* ════════════════ GAMES ════════════════ */}
          {step === "games" && (
            <div className="fu">
              {/* Nav */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                <GhostBtn onClick={() => setStep("setup")}>← Setup</GhostBtn>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
                    fontSize: isMobile ? 18 : 24, color:C.white,
                    textTransform:"uppercase", letterSpacing:"1px",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>
                    {jugend?.label} · {kreis?.label}
                    {jugend?.turnier && (
                      <span style={{ fontSize:12, color:C.warn, marginLeft:10, fontWeight:600 }}>TURNIER</span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:C.gray }}>
                    {games.length} {jugend?.turnier ? "Begegnungen" : "Spiele"} · {activeTeams.length} Teams
                  </div>
                </div>
                <GhostBtn onClick={() => exportToPDF(games,"",cfg)}>↓ PDF</GhostBtn>
              </div>

              {/* Top 5 */}
              <div style={{
                background: C.greenDim, border: `1px solid ${C.greenDark}`,
                borderRadius: 8, padding: 16, marginBottom: 14,
                borderLeft: `4px solid ${C.green}`,
              }}>
                <div style={{ ...secH, marginBottom:12 }}>
                  <span className="section-number">★</span>Top-Empfehlungen
                </div>
                {prioritized.map((g, i) => (
                  <div key={g.id} className="top-pick-row"
                    style={{ marginBottom: i < prioritized.length-1 ? 8 : 0,
                      padding:"10px 12px", borderRadius:5, background:"#0a1a0d" }}>
                    <span style={{
                      width:22, height:22, borderRadius:4, background:C.green, color:C.white,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:11, fontWeight:900, flexShrink:0,
                      fontFamily:"'Barlow Condensed',sans-serif",
                    }}>{i+1}</span>
                    <span style={{ flex:1, fontSize:13, color:C.white, minWidth:0,
                      fontFamily:"'Barlow',sans-serif" }}>
                      <strong>{g.home}</strong>
                      <span style={{ color:C.gray, fontWeight:400 }}> vs </span>
                      {g.away}
                    </span>
                    <span style={{ fontSize:12, color:C.gray, whiteSpace:"nowrap" }}>{g.dateLabel}</span>
                    <span style={{ fontSize:12, color:C.gray, whiteSpace:"nowrap" }}>{g.time}</span>
                    <span style={{ fontSize:12, color:C.green, fontWeight:700, whiteSpace:"nowrap" }}>{g.km} km</span>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="game-table" style={{
                background:C.surface, border:`1px solid ${C.border}`,
                borderRadius:8, overflow:"hidden", marginBottom:14,
              }}>
                <div style={{
                  display:"grid", gridTemplateColumns:"2.2fr 1.2fr 0.7fr 1.4fr 0.5fr",
                  padding:"10px 16px", borderBottom:`1px solid ${C.border}`,
                  background:"#161616",
                }}>
                  {["Begegnung","Datum","Anstoß","Spielort","km"].map(h => (
                    <span key={h} style={{ fontSize:10, color:C.gray, letterSpacing:"1.5px",
                      textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>
                      {h}
                    </span>
                  ))}
                </div>
                {games.map((g, i) => (
                  <div key={g.id} className="row-item"
                    style={{ display:"grid", gridTemplateColumns:"2.2fr 1.2fr 0.7fr 1.4fr 0.5fr",
                      padding:"11px 16px", fontSize:13,
                      borderBottom: i < games.length-1 ? `1px solid ${C.border}` : "none",
                      transition:"background 0.12s", background:"transparent",
                      fontFamily:"'Barlow',sans-serif" }}>
                    <span>
                      <strong style={{ color:C.white }}>{g.home}</strong>
                      <span style={{ color:C.grayDark }}> vs </span>
                      {g.away}
                    </span>
                    <span style={{ color:C.gray }}>{g.dateLabel}</span>
                    <span style={{ color:C.gray }}>{g.time}</span>
                    <span style={{ color:C.gray, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.venue}</span>
                    <span style={{ color: g.km < 15 ? C.green : C.gray, fontWeight: g.km < 15 ? 600 : 400 }}>{g.km}</span>
                  </div>
                ))}
              </div>

              {/* Mobile cards */}
              <div className="game-cards" style={{ marginBottom:14 }}>
                {games.map(g => <GameCard key={g.id} g={g} />)}
              </div>

              <PriBtn onClick={generateAI} disabled={loadingAI} style={{ width:"100%" }}>
                {loadingAI
                  ? `⏳ ${llmModel} analysiert...`
                  : `KI Scout-Plan für ${jugend?.label} erstellen →`}
              </PriBtn>
            </div>
          )}

          {/* ════════════════ PLAN ════════════════ */}
          {step === "plan" && (
            <div className="fu">
              {/* Nav */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                <GhostBtn onClick={() => setStep("games")}>← Spiele</GhostBtn>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
                    fontSize: isMobile ? 18 : 22, color:C.white,
                    textTransform:"uppercase", letterSpacing:"1px",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>
                    Scout-Plan · {jugend?.label}
                  </div>
                  <div style={{ fontSize:12, color:C.gray }}>{kreis?.label} · {llmModel}</div>
                </div>
                <PriBtn onClick={() => exportToPDF(games, plan, cfg)} style={{ fontSize:12, padding:"9px 18px" }}>
                  ↓ PDF
                </PriBtn>
              </div>

              {/* KI Analysis */}
              <div className="fu2" style={{
                background: C.greenDim, border:`1px solid ${C.greenDark}`,
                borderLeft: `4px solid ${C.green}`,
                borderRadius:8, padding: isMobile ? 16 : 22, marginBottom:14,
              }}>
                <div style={{ ...secH, marginBottom:14 }}>
                  <span className="section-number">KI</span>
                  Scout-Analyse · {jugend?.label} · {kreis?.label}
                </div>
                <div style={{
                  whiteSpace:"pre-wrap", lineHeight:1.8,
                  fontSize: isMobile ? 13 : 14, color:"#d0f0d8",
                  fontFamily:"'Barlow',sans-serif",
                }}>{plan}</div>
              </div>

              {/* All games */}
              <div className="fu3" style={{ marginBottom:14 }}>
                <div style={{
                  padding:"10px 16px", background:"#161616",
                  borderRadius:"8px 8px 0 0",
                  border:`1px solid ${C.border}`, borderBottom:"none",
                  fontSize:10, color:C.gray, letterSpacing:"2px",
                  textTransform:"uppercase",
                  fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                }}>
                  Alle {games.length} Spiele · {jugend?.label} · {kreis?.label}
                </div>

                <div className="game-table" style={{
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderTop:"none", borderRadius:"0 0 8px 8px", overflow:"hidden",
                }}>
                  {games.map((g, i) => (
                    <div key={g.id} className="row-item"
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
                        borderBottom: i<games.length-1 ? `1px solid ${C.border}` : "none",
                        fontSize:13, transition:"background 0.12s", background:"transparent",
                        fontFamily:"'Barlow',sans-serif" }}>
                      <span style={{ width:18, textAlign:"center", color:C.grayDark, fontSize:11, flexShrink:0 }}>{i+1}</span>
                      <span style={{ flex:1, minWidth:0 }}>
                        <strong style={{ color:C.white }}>{g.home}</strong>
                        <span style={{ color:C.grayDark }}> vs </span>
                        {g.away}
                      </span>
                      <span style={{ fontSize:12, color:C.gray, whiteSpace:"nowrap" }}>{g.dateLabel}</span>
                      <span style={{ fontSize:12, color:C.gray, whiteSpace:"nowrap", marginLeft:8 }}>{g.time} Uhr</span>
                      <span style={{ fontSize:12, color:g.km<15?C.green:C.gray, whiteSpace:"nowrap", marginLeft:8,
                        fontWeight: g.km<15 ? 700 : 400 }}>
                        {g.km} km
                      </span>
                    </div>
                  ))}
                </div>

                <div className="game-cards" style={{
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderTop:"none", borderRadius:"0 0 8px 8px", padding:"10px",
                }}>
                  {games.map(g => <GameCard key={g.id} g={g} />)}
                </div>
              </div>

              {/* Reset buttons */}
              <div className="reset-row">
                <GhostBtn onClick={fullReset} style={{ width:"100%", justifyContent:"center", textAlign:"center" }}>
                  ↺ Gleicher Kreis, neuer Plan
                </GhostBtn>
                <GhostBtn onClick={hardReset} style={{ width:"100%", justifyContent:"center", textAlign:"center" }}>
                  ⊕ Komplett neu starten
                </GhostBtn>
              </div>
            </div>
          )}
        </main>

        {/* ══ FOOTER ══ */}
        <footer style={{
          borderTop: `1px solid ${C.border}`, padding:"16px 20px",
          marginTop:20, textAlign:"center",
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <BMGBadge size={22} />
            <span style={{
              fontSize:11, color:C.grayDark, letterSpacing:"1px",
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600,
              textTransform:"uppercase",
            }}>
              ScoutPlan · Borussia Mönchengladbach · FVN Niederrhein
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
