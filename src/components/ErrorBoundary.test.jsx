import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Crash() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rendert Kinder im Normalfall", () => {
    render(
      <ErrorBoundary>
        <div>Alles gut</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Alles gut")).toBeInTheDocument();
  });

  it("zeigt Recovery-Aktionen bei Render-Fehlern", () => {
    render(
      <ErrorBoundary>
        <Crash />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Unerwarteter Fehler/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neu laden/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zur Konfiguration/i })).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
