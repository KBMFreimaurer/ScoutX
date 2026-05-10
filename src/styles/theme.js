import { C } from "../config/colors";

export { C };

export const GCSS = `
*,*::before,*::after{box-sizing:border-box}

:root{
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --keyboard-offset: 0px;
  --native-tabs-dock-offset: 62px;
  --action-dock-height: 136px;
  --action-dock-height-native-tabs: 152px;
  --setup-mobile-fill-offset: 390px;
}

body{
  margin:0;
  background: ${C.bg};
  color:${C.offWhite};
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  -webkit-tap-highlight-color:transparent;
}

html[data-ios-webview="true"],
html[data-ios-webview="true"] body{
  width:100%;
  max-width:100%;
  overflow-x:hidden;
  background:#060609;
}

:focus-visible{
  outline:2px solid rgba(0,200,83,0.85);
  outline-offset:2px;
}

/* Scrollbar */
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.15)}

input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5) sepia(1) hue-rotate(100deg)}
select option{background:#18181B;color:#e4e4e7}

/* Animations */
@keyframes fadeUp{
  from{opacity:0;transform:translateY(16px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes fadeIn{
  from{opacity:0}
  to{opacity:1}
}
@keyframes skeletonShimmer{
  0%{background-position:200% 0}
  100%{background-position:-200% 0}
}
@keyframes pulseGlow{
  0%,100%{box-shadow:0 0 0 0 rgba(0,200,83,0.2)}
  50%{box-shadow:0 0 0 8px rgba(0,200,83,0)}
}
@keyframes slideIn{
  from{opacity:0;transform:translateX(-8px)}
  to{opacity:1;transform:translateX(0)}
}
@keyframes float{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-4px)}
}
@keyframes scoutxTabPulse{
  0%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(0,200,83,0))}
  35%{transform:scale(1.1);filter:drop-shadow(0 0 10px rgba(0,200,83,0.55))}
  65%{transform:scale(0.96);filter:drop-shadow(0 0 6px rgba(0,200,83,0.35))}
  100%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(0,200,83,0))}
}

.fu{animation:fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both}
.fu2{animation:fadeUp 0.4s 0.06s cubic-bezier(0.16,1,0.3,1) both}
.fu3{animation:fadeUp 0.4s 0.12s cubic-bezier(0.16,1,0.3,1) both}

/* App shell */
.app-shell{display:flex;min-height:100vh;min-height:100dvh;position:relative}

.left-rail{
  width:240px;
  background:rgba(14,16,20,0.92);
  border-right:1px solid ${C.border};
  backdrop-filter:blur(24px);
  -webkit-backdrop-filter:blur(24px);
  display:flex;
  flex-direction:column;
  padding:24px 16px 16px;
  gap:16px;
  position:sticky;
  top:0;
  height:100vh;
  overflow-y:auto;
}
.left-rail-brand{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
  font-weight:900;
  font-size:22px;
  letter-spacing:-0.5px;
  color:${C.white};
  display:flex;
  align-items:center;
  gap:8px;
}
.left-rail-brand .brand-accent{
  color:${C.green};
}
.left-rail-sub{
  color:${C.gray};
  font-size:12px;
  line-height:1.5;
  letter-spacing:0;
}

.left-menu{display:flex;flex-direction:column;gap:2px;margin-top:8px}
.left-menu-item{
  border:1px solid transparent;
  border-radius:8px;
  background:transparent;
  color:${C.gray};
  padding:10px 12px;
  text-align:left;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:13px;
  font-weight:500;
  cursor:pointer;
  transition:all .15s ease;
  display:flex;
  align-items:center;
  gap:10px;
}
.left-menu-item:hover{
  background:rgba(255,255,255,0.04);
  color:${C.offWhite};
}
.left-menu-item.active{
  background:${C.greenDim};
  border-color:${C.greenBorder};
  color:${C.green};
  font-weight:600;
}
.left-rail-cta{
  margin-top:auto;
  border:none;
  border-radius:10px;
  min-height:44px;
  cursor:pointer;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
  font-weight:600;
  font-size:13px;
  letter-spacing:0;
  color:${C.bg};
  background:${C.green};
  transition:all .2s ease;
  box-shadow:0 0 20px rgba(0,200,83,0.15);
}
.left-rail-cta:hover{
  background:${C.greenLight};
  box-shadow:0 0 30px rgba(0,200,83,0.25);
}

/* Content shell */
.content-shell{flex:1;display:flex;flex-direction:column;min-width:0}
.statusbar-shield{display:none}
html[data-ios-webview="true"] .statusbar-shield{
  display:block;
  position:fixed;
  top:0;
  left:0;
  right:0;
  height:calc(var(--safe-top) + 2px);
  background:#060609;
  pointer-events:none;
  z-index:60;
}

.top-strip{
  min-height:56px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:calc(8px + var(--safe-top)) calc(24px + var(--safe-right)) 8px calc(24px + var(--safe-left));
  border-bottom:1px solid ${C.border};
  background:rgba(6,6,9,0.8);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  position:sticky;
  top:0;
  z-index:25;
}
.top-strip-title{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:18px;
  line-height:1;
  font-weight:800;
  letter-spacing:-0.3px;
}
.top-strip-actions{display:flex;align-items:center;gap:6px}
.icon-dot{
  width:32px;height:32px;border-radius:8px;
  border:1px solid ${C.border};
  background:rgba(255,255,255,0.03);
  cursor:pointer;
  transition:all .15s;
  display:flex;
  align-items:center;
  justify-content:center;
}
.icon-dot:hover{
  background:rgba(255,255,255,0.06);
  border-color:${C.borderHi};
}

/* Workspace */
.workspace{
  width:100%;
  max-width:1280px;
  margin:0 auto;
  padding:28px calc(28px + var(--safe-right)) calc(40px + var(--safe-bottom)) calc(28px + var(--safe-left));
}

/* Setup header */
.setup-exec-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:16px;
  margin-bottom:22px;
}
.setup-exec-eyebrow{
  display:inline-block;
  margin:0 0 8px;
  color:${C.green};
  font-size:10px;
  letter-spacing:0.22em;
  text-transform:uppercase;
  font-weight:700;
}
.setup-exec-title{
  margin:0;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:48px;
  line-height:0.98;
  letter-spacing:-1.1px;
  color:${C.offWhite};
  max-width:680px;
}
.setup-exec-subline{
  margin:12px 0 0;
  color:${C.gray};
  font-size:17px;
  line-height:1.45;
  max-width:700px;
}
.setup-exec-status{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 16px;
  border-radius:12px;
  background:rgba(255,255,255,0.03);
  border:1px solid rgba(62,74,62,0.15);
  color:${C.grayLight};
  font-size:11px;
  letter-spacing:0.12em;
  text-transform:uppercase;
  font-weight:700;
  white-space:nowrap;
}
.setup-exec-status-dot{
  width:8px;
  height:8px;
  border-radius:999px;
  background:${C.green};
  box-shadow:0 0 12px ${C.greenGlow};
  animation:pulseGlow 1.8s infinite ease-in-out;
}

/* Setup layout */
.setup-exec-grid{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  gap:16px;
}
.setup-exec-left,
.setup-exec-right{
  display:flex;
  flex-direction:column;
  gap:16px;
}
.setup-wizard-progress{
  display:grid;
  grid-template-columns:repeat(7,minmax(0,1fr));
  gap:8px;
  margin-bottom:14px;
}
.setup-wizard-chip{
  width:100%;
  border:1px solid ${C.border};
  background:rgba(255,255,255,0.02);
  border-radius:10px;
  text-align:left;
  font-family:inherit;
  padding:8px 10px;
  min-height:56px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  gap:2px;
  cursor:default;
  transition:border-color .2s ease, background .2s ease, box-shadow .2s ease;
}
.setup-wizard-chip:not(:disabled){
  cursor:pointer;
}
.setup-wizard-chip:not(:disabled):hover{
  border-color:${C.borderHi};
  background:rgba(255,255,255,0.04);
}
.setup-wizard-chip.active{
  border-color:${C.greenBorder};
  background:${C.greenDim};
  box-shadow:0 0 0 1px rgba(0,200,83,0.15) inset;
}
.setup-wizard-chip.done:not(.active){
  border-color:rgba(0,200,83,0.18);
  background:rgba(0,200,83,0.06);
}
.setup-wizard-chip-num{
  color:${C.gray};
  font-size:10px;
  letter-spacing:.12em;
  text-transform:uppercase;
  font-weight:700;
}
.setup-wizard-chip.active .setup-wizard-chip-num{color:${C.green}}
.setup-wizard-chip-title{
  color:${C.grayLight};
  font-size:12px;
  line-height:1.25;
  font-weight:600;
}
.setup-wizard-chip.active .setup-wizard-chip-title{color:${C.offWhite}}
.setup-wizard-page{
  display:flex;
  flex-direction:column;
  gap:16px;
}
.setup-step-fill{
  display:flex;
  flex-direction:column;
  min-height:0;
}
.setup-step-fill > *{
  width:100%;
}
.setup-screen-mobile .setup-step-fill{
  min-height:calc(100dvh - var(--setup-mobile-fill-offset) - var(--safe-top) - var(--safe-bottom));
}
.setup-screen-mobile .setup-step-fill > *{
  flex:1 1 auto;
}
.setup-wizard-actions{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}
.setup-action-summary{
  color:${C.gray};
  font-size:12px;
  font-weight:500;
  line-height:1.4;
  white-space:normal;
}
.setup-summary-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:10px;
}
.setup-summary-item{
  border:1px solid ${C.border};
  border-radius:10px;
  background:rgba(255,255,255,0.02);
  padding:10px 12px;
  display:flex;
  flex-direction:column;
  gap:4px;
  min-height:74px;
}
.setup-summary-label{
  color:${C.gray};
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.14em;
  font-weight:700;
}
.setup-summary-value{
  color:${C.offWhite};
  font-size:12px;
  line-height:1.35;
  font-weight:600;
  overflow-wrap:anywhere;
}

.setup-action-bar{
  position:sticky;
  bottom:12px;
  z-index:30;
  margin-top:6px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px;
  border-radius:12px;
  border:1px solid rgba(62,74,62,0.15);
  background:#08090a;
  box-shadow:0 0 0 1px rgba(255,255,255,0.015) inset, 0 18px 42px rgba(0,0,0,0.55);
}
.setup-screen-mobile{
  padding-bottom:calc(var(--action-dock-height) + var(--safe-bottom));
}
.setup-action-gap-guard{
  display:none;
}
.setup-action-bar-mobile,
.page-action-dock-mobile{
  position:fixed;
  left:calc(10px + var(--safe-left));
  right:calc(10px + var(--safe-right));
  bottom:calc(12px + var(--safe-bottom));
  transform:translateY(calc(-1 * var(--keyboard-offset)));
  will-change:transform;
  padding-bottom:10px;
}
.setup-action-bar-native-tabs{
  bottom:calc(var(--native-tabs-dock-offset) + var(--safe-bottom));
}
[data-ios-keyboard-open="true"] .setup-action-bar-native-tabs{
  bottom:calc(12px + var(--safe-bottom));
}
html[data-native-bottom-tabs="true"] .setup-action-bar-mobile,
html[data-native-bottom-tabs="true"] .page-action-dock-mobile{
  bottom:calc(var(--native-tabs-dock-offset) + var(--safe-bottom));
}
html[data-native-bottom-tabs="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile,
html[data-native-bottom-tabs="true"][data-ios-keyboard-open="true"] .page-action-dock-mobile{
  bottom:calc(12px + var(--safe-bottom));
}
[data-ios-webview="true"] .setup-action-bar-mobile,
[data-ios-webview="true"] .page-action-dock-mobile{
  bottom:calc(var(--native-tabs-dock-offset) + var(--safe-bottom));
}
[data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile,
[data-ios-webview="true"][data-ios-keyboard-open="true"] .page-action-dock-mobile{
  bottom:calc(12px + var(--safe-bottom));
}
.setup-action-bar-mobile{
  z-index:38;
  margin-top:0;
  flex-direction:column;
  align-items:stretch;
}
.setup-action-bar-mobile::before,
.page-action-dock-mobile::before{
  display:none;
}
[data-ios-webview="true"][data-native-bottom-tabs="true"] .setup-action-gap-guard{
  display:block;
  position:fixed;
  left:0;
  right:0;
  bottom:calc(var(--native-tabs-dock-offset) + var(--safe-bottom) - 1px);
  height:20px;
  background:#08090a;
  pointer-events:none;
  z-index:37;
}
[data-ios-webview="true"][data-native-bottom-tabs="true"] .setup-action-bar-mobile{
  border-bottom-left-radius:0;
  border-bottom-right-radius:0;
  border-bottom-color:transparent;
  box-shadow:0 0 0 1px rgba(255,255,255,0.015) inset, 0 4px 10px rgba(0,0,0,0.16);
}
[data-ios-webview="true"][data-native-bottom-tabs="true"][data-ios-keyboard-open="true"] .setup-action-gap-guard{
  display:none;
}
.setup-action-bar-mobile::after{display:none}
.setup-action-bar-mobile .setup-action-meta{font-size:12px;white-space:normal}
.setup-action-bar-mobile .setup-wizard-actions{width:100%}
.setup-action-bar-mobile .setup-wizard-actions .ghost-btn,
.setup-action-bar-mobile .setup-wizard-actions .pri-btn{
  flex:1;
  justify-content:center;
}
[data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile{
  display:none;
}
[data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile::before,
[data-ios-webview="true"][data-ios-keyboard-open="true"] .page-action-dock-mobile::before{
  display:none;
}
[data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile .setup-action-meta{
  display:none;
}
.setup-action-bar::after{
  content:'';
  position:absolute;
  left:-1px;
  right:-1px;
  bottom:-14px;
  height:16px;
  background:#08090a;
  border-left:1px solid rgba(62,74,62,0.15);
  border-right:1px solid rgba(62,74,62,0.15);
  pointer-events:none;
}
.setup-action-meta{
  display:flex;
  flex-direction:column;
  min-width:0;
  gap:2px;
  color:${C.grayLight};
  font-size:13px;
  font-weight:600;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.setup-action-eyebrow{
  color:${C.gray};
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:0.2em;
  font-weight:700;
}

/* Hover states */
.row-item{cursor:pointer}
.row-item:hover{background:rgba(255,255,255,0.03)!important}
.ghost-btn:hover{background:rgba(255,255,255,0.06)!important;border-color:${C.borderHi}!important;color:${C.white}!important}
.pri-btn:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-1px)}
.pri-btn:active:not(:disabled){transform:translateY(0)}
.item-btn{cursor:pointer}
.item-btn[aria-pressed="false"]:hover{background:rgba(255,255,255,0.05)!important}
.item-btn:focus-visible{outline:none}
.team-chip{cursor:pointer}
.team-chip.sel,
.team-chip.sel:hover{border-color:${C.green}!important;color:${C.white}!important;background:${C.greenDim}!important}

/* Input focus */
.scout-input:focus,.scout-select:focus{
  border-color:rgba(0,200,83,0.4)!important;
  box-shadow:0 0 0 3px rgba(0,200,83,0.08);
  outline:none;
}

/* Touch targets */
button,input,select{min-height:44px}
button{touch-action:manipulation}

html[data-ios-webview="true"] input,
html[data-ios-webview="true"] select,
html[data-ios-webview="true"] textarea{
  font-size:16px!important;
}
html[data-ios-webview="true"] ::-webkit-scrollbar{
  width:0;
  height:0;
}

/* ── Responsive grids ── */
.kreis-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media(min-width:480px){.kreis-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:700px){.kreis-grid{grid-template-columns:repeat(auto-fill,minmax(168px,1fr))}}

/* Symmetrische letzte Reihe im Kreis-Grid (3er Raster) */
@media(min-width:480px) and (max-width:699px){
  .kreis-grid > :last-child:nth-child(3n+1){grid-column:2}
  .kreis-grid > :last-child:nth-child(3n+2){grid-column:3}
}

@media(min-width:700px){
  .kreis-grid{
    grid-template-columns:repeat(3,minmax(0,1fr));
  }
  .kreis-grid > :last-child:nth-child(3n+1){grid-column:2}
  .kreis-grid > :last-child:nth-child(3n+2){grid-column:3}
}

.team-grid{display:grid;grid-template-columns:1fr;gap:6px}
@media(min-width:480px){.team-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:700px){.team-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}}

.date-focus-row{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:560px){.date-focus-row{grid-template-columns:1fr 1fr}}

.reset-row{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:480px){.reset-row{grid-template-columns:1fr 1fr}}

.page-with-action-dock{
  padding-bottom:calc(var(--page-dock-reserve, var(--action-dock-height)) + var(--safe-bottom));
}
html[data-native-bottom-tabs="true"] .setup-screen-mobile{
  padding-bottom:calc(var(--action-dock-height-native-tabs) + var(--safe-bottom));
}
html[data-native-bottom-tabs="true"] .page-with-action-dock{
  padding-bottom:calc(var(--page-dock-reserve-native, var(--page-dock-reserve, var(--action-dock-height-native-tabs))) + var(--safe-bottom));
}
[data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-screen-mobile,
[data-ios-webview="true"][data-ios-keyboard-open="true"] .page-with-action-dock{
  padding-bottom:calc(20px + var(--safe-bottom));
}
.page-with-action-dock.page-with-action-dock-games{
  --page-dock-reserve: 188px;
  --page-dock-reserve-native: 220px;
}
.page-with-action-dock.page-with-action-dock-plan{
  --page-dock-reserve: 212px;
  --page-dock-reserve-native: 256px;
}
.page-action-dock{
  display:grid;
  gap:8px;
}
.page-action-dock-row{
  display:grid;
  grid-template-columns:1fr;
  gap:8px;
}
@media(min-width:480px){
  .page-action-dock-row{
    grid-template-columns:1fr 1fr;
  }
}
.page-action-dock-mobile{
  z-index:39;
  padding:10px;
  border-radius:12px;
  border:1px solid rgba(62,74,62,0.15);
  background:#08090a;
  box-shadow:0 0 0 1px rgba(255,255,255,0.015) inset, 0 18px 42px rgba(0,0,0,0.55);
}
.native-bottom-tabs{
  transition:transform .18s ease, opacity .18s ease;
}
.native-bottom-tab-btn{
  transition:all .16s ease;
}
.native-bottom-tab-icon{
  width:24px;
  height:24px;
  align-items:center;
  justify-content:center;
  user-select:none;
  -webkit-user-select:none;
  -webkit-touch-callout:none;
}
.native-bottom-tab-icon svg{
  width:24px;
  height:24px;
  pointer-events:none;
}
.native-bottom-tab-icon-center{
  width:34px;
  height:34px;
}
.native-bottom-tab-center-icon{
  width:32px;
  height:32px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  transform-origin:center;
  filter:drop-shadow(0 0 0 rgba(0,200,83,0));
  user-select:none;
  -webkit-user-select:none;
  -webkit-touch-callout:none;
}
.native-bottom-tab-center-icon img{
  width:100%!important;
  height:100%!important;
  object-fit:contain;
  pointer-events:none;
  -webkit-user-drag:none;
}
.native-bottom-tab-btn-center:active .native-bottom-tab-center-icon{
  animation:scoutxTabPulse .42s cubic-bezier(0.22,1,0.36,1);
}
.native-bottom-tab-btn-center[aria-current="page"] .native-bottom-tab-center-icon{
  filter:drop-shadow(0 0 8px rgba(0,200,83,0.28));
}
[data-ios-webview="true"][data-ios-keyboard-open="true"] .native-bottom-tabs{
  opacity:0;
  pointer-events:none;
  transform:translateY(calc(100% + var(--safe-bottom)));
}
[data-ios-webview="true"] .setup-exec-head{
  margin-bottom:14px;
  gap:12px;
}
[data-ios-webview="true"] .setup-exec-title{
  font-size:42px;
  line-height:1;
}
[data-ios-webview="true"] .setup-exec-subline{
  margin-top:8px;
}

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

/* ── Section number badge ── */
.section-number{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:24px;
  padding:0 8px;
  height:22px;
  border-radius:6px;
  background:${C.greenDim};
  border:1px solid ${C.greenBorder};
  color:${C.green};
  font-size:10px;
  font-weight:700;
  letter-spacing:0.5px;
  margin-right:10px;
  flex-shrink:0;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
}

/* Skeleton */
.skeleton{
  border-radius:8px;
  background:linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 40%,rgba(255,255,255,0.03) 60%);
  background-size:200% 100%;
  animation:skeletonShimmer 1.5s ease-in-out infinite;
}

/* Responsive: hide rail */
@media(max-width:1050px){
  .left-rail{display:none}
  .top-strip-title{font-size:16px}
  .setup-exec-title{font-size:42px}
  .setup-exec-head{align-items:flex-start;flex-direction:column}
  .setup-exec-status{font-size:10px}
}

@media(max-width:640px){
  .top-strip{
    min-height:48px;
    padding:calc(8px + var(--safe-top)) calc(12px + var(--safe-right)) 8px calc(12px + var(--safe-left));
  }
  .top-strip-title{font-size:15px}
  .top-strip-actions{display:none}
  .workspace{padding:20px calc(16px + var(--safe-right)) calc(28px + var(--safe-bottom)) calc(16px + var(--safe-left))}
  .setup-exec-title{font-size:36px;line-height:1.03}
  .setup-exec-subline{font-size:15px}
  .setup-screen{padding-bottom:calc(138px + var(--safe-bottom) + var(--keyboard-offset))}
  .setup-screen-mobile .setup-step-fill{
    min-height:calc(100dvh - 350px - var(--safe-top) - var(--safe-bottom));
  }
  .setup-action-bar:not(.setup-action-bar-mobile){
    position:fixed;
    left:calc(10px + var(--safe-left));
    right:calc(10px + var(--safe-right));
    bottom:calc(8px + var(--safe-bottom));
    transform:translateY(calc(-1 * var(--keyboard-offset)));
    will-change:transform;
    z-index:80;
    margin-top:0;
    flex-direction:column;
    align-items:stretch;
  }
  .setup-action-bar:not(.setup-action-bar-mobile)::after{display:none}
  .setup-action-bar:not(.setup-action-bar-mobile) .setup-action-meta{font-size:12px;white-space:normal}
  .setup-wizard-progress{grid-template-columns:repeat(2,minmax(0,1fr))}
  .setup-action-bar:not(.setup-action-bar-mobile) .setup-wizard-actions{width:100%}
  .setup-action-bar:not(.setup-action-bar-mobile) .setup-wizard-actions .ghost-btn,
  .setup-action-bar:not(.setup-action-bar-mobile) .setup-wizard-actions .pri-btn{
    flex:1;
    justify-content:center;
  }
  [data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-action-bar:not(.setup-action-bar-mobile) .setup-action-meta{
    display:none;
  }
  .page-with-action-dock{
    padding-bottom:calc(146px + var(--safe-bottom));
  }
}

@media(max-width:980px){
  .setup-wizard-progress{grid-template-columns:repeat(3,minmax(0,1fr))}
}

@media(min-width:980px){
  .setup-wizard-chip{min-height:62px}
}

/* Glass surface for ambient light */
.app-shell::before{
  content:'';
  position:fixed;
  top:-40%;
  left:-20%;
  width:60%;
  height:80%;
  background:radial-gradient(ellipse, rgba(0,200,83,0.04) 0%, transparent 70%);
  pointer-events:none;
  z-index:0;
}
.app-shell::after{
  content:'';
  position:fixed;
  bottom:-30%;
  right:-10%;
  width:50%;
  height:70%;
  background:radial-gradient(ellipse, rgba(129,140,248,0.03) 0%, transparent 70%);
  pointer-events:none;
  z-index:0;
}
.content-shell{position:relative;z-index:1}
.left-rail{position:sticky;z-index:2}
`;

export const inp = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: C.offWhite,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: 13,
  outline: "none",
  minHeight: 44,
  transition: "border-color 0.2s, box-shadow 0.2s",
};

export const lbl = {
  display: "block",
  fontSize: 11,
  color: C.gray,
  letterSpacing: "0.3px",
  textTransform: "uppercase",
  marginBottom: 6,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontWeight: 600,
};

export const secH = {
  fontSize: 12,
  color: C.offWhite,
  letterSpacing: "0.2px",
  textTransform: "uppercase",
  marginBottom: 16,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 0,
};

export const card = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 20,
  marginBottom: 0,
  position: "relative",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};
