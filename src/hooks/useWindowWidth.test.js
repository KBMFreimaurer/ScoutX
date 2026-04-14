import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWindowWidth } from "./useWindowWidth";

describe("useWindowWidth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("gibt die aktuelle Fensterbreite zurück", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1024);
  });

  it("debounced Resize-Events (wartet 150ms vor Update)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useWindowWidth());
    expect(result.current).toBe(1024);

    // Resize auf 800px
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Sofort nach Event sollte Breite noch nicht aktualisiert sein
    expect(result.current).toBe(1024);

    // Nach 100ms immer noch nicht (< 150ms debounce)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(1024);

    // Nach 150ms sollte die neue Breite da sein
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(800);
  });

  it("canceliert vorherigen Timeout bei raschem Resize", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useWindowWidth());

    // Erstes Resize auf 900px
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 900,
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Nach 100ms zweites Resize auf 800px
    act(() => {
      vi.advanceTimersByTime(100);
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Der erste Timeout sollte canceliert worden sein
    // Nach weiteren 150ms sollte nur 800px (nicht 900px) da sein
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(800);
  });

  it("räumt Event-Listener beim Unmount auf", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useWindowWidth());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("clearTimeout beim Unmount, falls Timeout noch läuft", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = renderHook(() => useWindowWidth());

    // Resize auslösen
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Vor Ablauf der 150ms unmounten
    act(() => {
      vi.advanceTimersByTime(50);
    });
    unmount();

    // clearTimeout sollte aufgerufen worden sein
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
