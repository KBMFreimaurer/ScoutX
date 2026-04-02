import { C } from "../data/constants";

export { C };

export const GCSS = `
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
@keyframes skeletonShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

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

.skeleton{
  border-radius:6px;
  background:linear-gradient(90deg,#1b1b1b 25%,#2a2a2a 40%,#1b1b1b 60%);
  background-size:200% 100%;
  animation:skeletonShimmer 1.2s ease-in-out infinite;
}
`;

export const inp = {
  width: "100%",
  padding: "10px 14px",
  background: "#111",
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.offWhite,
  fontFamily: "'Barlow',sans-serif",
  fontSize: 14,
  outline: "none",
  minHeight: 44,
  transition: "border-color 0.15s",
};

export const lbl = {
  display: "block",
  fontSize: 11,
  color: C.gray,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  marginBottom: 6,
  fontFamily: "'Barlow Condensed',sans-serif",
  fontWeight: 600,
};

export const secH = {
  fontSize: 11,
  color: C.green,
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: 16,
  fontFamily: "'Barlow Condensed',sans-serif",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 0,
};

export const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: 20,
  marginBottom: 12,
  position: "relative",
  overflow: "hidden",
};
