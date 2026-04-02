import { C } from "../data/constants";

export { C };

export const GCSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,700&family=Barlow:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box}
body{
  margin:0;
  background:
    radial-gradient(1200px 600px at 15% -20%, rgba(0,135,62,0.14), transparent 60%),
    radial-gradient(900px 500px at 100% 0%, rgba(0,135,62,0.08), transparent 58%),
    #0b0c0d;
  color:${C.offWhite};
  -webkit-tap-highlight-color:transparent;
}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:#0b0c0d}
::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:#00873E}
input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6) sepia(0.5) hue-rotate(100deg)}
select option{background:#1a1a1a;color:#e8e8e8}

@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes skeletonShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes pulseGlow{0%{box-shadow:0 0 0 0 rgba(112,221,136,0.24)}100%{box-shadow:0 0 0 14px rgba(112,221,136,0)}}

.fu{animation:fadeUp 0.35s ease both}
.fu2{animation:fadeUp 0.35s 0.08s ease both}
.fu3{animation:fadeUp 0.35s 0.16s ease both}

/* App shell */
.app-shell{display:flex;min-height:100vh}
.left-rail{
  width:236px;
  background:rgba(26,26,26,0.88);
  border-right:1px solid rgba(255,255,255,0.06);
  backdrop-filter:blur(10px);
  display:flex;
  flex-direction:column;
  padding:16px;
  gap:14px;
}
.left-rail-brand{
  font-family:'Barlow Condensed',sans-serif;
  text-transform:uppercase;
  letter-spacing:0.8px;
  font-weight:900;
  font-size:30px;
  color:#70dd88;
}
.left-rail-sub{
  color:${C.gray};
  font-size:12px;
  line-height:1.35;
}
.left-menu{display:flex;flex-direction:column;gap:6px}
.left-menu-item{
  border:1px solid transparent;
  border-radius:8px;
  background:transparent;
  color:${C.gray};
  padding:10px 12px;
  text-align:left;
  font-family:'Barlow',sans-serif;
  font-size:13px;
  cursor:pointer;
  transition:all .16s ease;
}
.left-menu-item:hover{background:#272727;color:${C.offWhite}}
.left-menu-item.active{
  background:linear-gradient(135deg, rgba(112,221,136,0.17) 0%, rgba(0,135,62,0.08) 100%);
  border-color:${C.greenBorder};
  color:#70dd88;
}
.left-rail-cta{
  margin-top:auto;
  border:none;
  border-radius:8px;
  min-height:44px;
  cursor:pointer;
  font-family:'Barlow Condensed',sans-serif;
  letter-spacing:.6px;
  text-transform:uppercase;
  font-weight:700;
  color:#08110b;
  background:linear-gradient(135deg,#70DD88 0%, #00873E 100%);
}
.content-shell{flex:1;display:flex;flex-direction:column;min-width:0}
.top-strip{
  height:64px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  padding:0 20px;
  border-bottom:1px solid rgba(255,255,255,0.07);
  background:rgba(13,13,13,0.78);
  backdrop-filter:blur(14px);
  position:sticky;
  top:0;
  z-index:25;
}
.top-strip-title{
  font-family:'Barlow Condensed',sans-serif;
  font-size:32px;
  line-height:1;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:0.9px;
}
.top-strip-actions{display:flex;align-items:center;gap:10px}
.icon-dot{
  width:28px;height:28px;border-radius:50%;
  border:1px solid rgba(255,255,255,0.15);
  background:#1e1e1e;
}
.workspace{
  width:100%;
  max-width:1260px;
  margin:0 auto;
  padding:24px 20px 30px;
}
.setup-headline{
  margin-bottom:18px;
}
.setup-headline h1{
  margin:0 0 6px;
  font-family:'Barlow Condensed',sans-serif;
  font-size:48px;
  line-height:0.95;
  text-transform:uppercase;
  letter-spacing:1px;
  color:${C.white};
}
.setup-headline p{
  margin:0;
  color:${C.gray};
  font-size:14px;
}
.setup-layout{
  display:grid;
  grid-template-columns:minmax(0,2.05fr) minmax(0,1fr);
  gap:14px;
}
.setup-left-grid{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:14px;
}
.setup-span-two{grid-column:1/-1}
.right-stack{display:flex;flex-direction:column;gap:14px}

/* Hover states */
.row-item:hover{background:${C.surfaceHi}!important}
.ghost-btn:hover{background:#2e2e2e!important;border-color:#4a4a4a!important;color:${C.offWhite}!important}
.pri-btn:hover:not(:disabled){filter:brightness(1.08)}
.item-btn:hover{border-color:${C.green}!important;color:${C.offWhite}!important;background:#2b2b2b!important}
.team-chip.sel,
.team-chip.sel:hover{border-color:${C.green}!important;color:${C.white}!important;background:${C.greenDark}!important}
.scout-input:focus,.scout-select:focus{
  border-color:${C.green}!important;
  box-shadow:0 0 0 1px rgba(112,221,136,0.25);
}

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
.step-label-full{display:inline}
.step-label-short{display:none}

.preset-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.pills-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}

/* ── BMG-specific design tokens ── */
.section-number{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:26px;
  padding:0 8px;
  height:20px;
  border-radius:999px;
  border:1px solid ${C.greenBorder};
  background:${C.greenDim};
  color:#70dd88;
  font-size:10px;
  font-weight:700;
  letter-spacing:0.8px;
  text-transform:uppercase;
  margin-right:8px;
  flex-shrink:0;
}

.skeleton{
  border-radius:6px;
  background:linear-gradient(90deg,#1b1b1b 25%,#2a2a2a 40%,#1b1b1b 60%);
  background-size:200% 100%;
  animation:skeletonShimmer 1.2s ease-in-out infinite;
}

@media(max-width:1050px){
  .left-rail{display:none}
  .top-strip-title{font-size:28px}
  .setup-layout{grid-template-columns:1fr}
}

@media(max-width:640px){
  .top-strip{height:auto;padding:12px;flex-wrap:wrap}
  .top-strip-title{font-size:24px}
  .workspace{padding:16px 12px 20px}
  .setup-headline h1{font-size:34px}
  .setup-left-grid{grid-template-columns:1fr}
}
`;

export const inp = {
  width: "100%",
  padding: "11px 14px",
  background: "#242424",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 6,
  color: C.offWhite,
  fontFamily: "'Barlow',sans-serif",
  fontSize: 14,
  outline: "none",
  minHeight: 44,
  transition: "border-color 0.15s, box-shadow 0.15s",
};

export const lbl = {
  display: "block",
  fontSize: 10,
  color: C.gray,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  marginBottom: 6,
  fontFamily: "'Barlow Condensed',sans-serif",
  fontWeight: 700,
};

export const secH = {
  fontSize: 12,
  color: C.offWhite,
  letterSpacing: "0.4px",
  textTransform: "uppercase",
  marginBottom: 14,
  fontFamily: "'Barlow Condensed',sans-serif",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 0,
};

export const card = {
  background: "rgba(28,27,27,0.94)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 10,
  padding: 20,
  marginBottom: 0,
  position: "relative",
  overflow: "hidden",
};
