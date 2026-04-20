import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rendert Kinder ohne Fehler", () => {
    render(
      <ErrorBoundary>
        <div>Alles gut</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Alles gut")).toBeInTheDocument();
  });

  it("zeigt Fallback und triggert Reload-Handler", () => {
    const onReload = vi.fn();

    render(
      <ErrorBoundary onReload={onReload}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: /Unerwarteter Fehler/i })).toBeInTheDocument();
    const reloadButton = screen.getByRole("button", { name: /Seite neu laden/i });
    fireEvent.click(reloadButton);
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
