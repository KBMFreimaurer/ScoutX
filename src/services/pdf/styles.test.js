import { describe, expect, it, vi } from "vitest";
import { buildFileName, sanitizeFileSegment, sanitizePdfText } from "./styles";

describe("pdf/styles", () => {
  it("entfernt Steuerzeichen und behält sichtbare Zeichen", () => {
    expect(sanitizePdfText(`A & B <C> "D" 'E'\u0000\u0007`)).toBe(`A & B <C> "D" 'E'`);
  });

  it("bereinigt Dateisegmente stabil", () => {
    expect(sanitizeFileSegment("Mönchengladbach / U13", "Fallback")).toBe("Monchengladbach-U13");
    expect(sanitizeFileSegment("   ", "Fallback")).toBe("Fallback");
  });

  it("erstellt konsistenten Dateinamen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T09:07:00Z"));

    const fileName = buildFileName({ kreisLabel: "Oberhausen", jugendLabel: "D-Jugend" });
    expect(fileName).toMatch(/^ScoutX-Oberhausen-D-Jugend-2026-04-06-\d{4}\.pdf$/);

    vi.useRealTimers();
  });
});
