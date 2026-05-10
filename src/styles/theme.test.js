import { describe, expect, it } from "vitest";
import { GCSS } from "./theme";

describe("styles/theme iOS dock guards", () => {
  it("enthält gemeinsame iOS-Dock-Regeln für Setup und Page-Dock", () => {
    expect(GCSS).toContain(".setup-action-bar-mobile,");
    expect(GCSS).toContain(".page-action-dock-mobile{");
    expect(GCSS).toContain("transform:translateY(calc(-1 * var(--keyboard-offset)))");
  });

  it("enthält iOS-spezifische Keyboard-/Tab-Bar-Regeln", () => {
    expect(GCSS).toContain('[data-ios-webview="true"][data-ios-keyboard-open="true"] .native-bottom-tabs');
    expect(GCSS).toContain("pointer-events:none");
    expect(GCSS).toContain('html[data-native-bottom-tabs="true"] .setup-action-bar-mobile');
    expect(GCSS).toContain('html[data-native-bottom-tabs="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile');
    expect(GCSS).toContain('[data-ios-webview="true"][data-ios-keyboard-open="true"] .setup-action-bar-mobile');
    expect(GCSS).toContain("display:none");
  });

  it("unterdrückt den iOS-rechten Randstreifen visuell", () => {
    expect(GCSS).toContain("html[data-ios-webview=\"true\"] ::-webkit-scrollbar");
    expect(GCSS).toContain("width:0");
    expect(GCSS).toContain("height:0");
  });
});
