import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TimeProvider, useTimes } from "./TimeContext";

const TEST_GAME = {
  id: "game-1",
  home: "Team A",
  away: "Team B",
  dateLabel: "12.04.2026",
  venue: "Sportplatz Mitte",
};

function TestHarness() {
  const { timeEntries, onUpsertTimeEntry } = useTimes();

  return (
    <div>
      <button
        type="button"
        onClick={() => onUpsertTimeEntry({ game: TEST_GAME, minutes: 60, note: "Block 1" })}
      >
        add-1
      </button>
      <button
        type="button"
        onClick={() => onUpsertTimeEntry({ game: TEST_GAME, minutes: 45, note: "Block 2" })}
      >
        add-2
      </button>
      <button
        type="button"
        onClick={() => {
          const secondId = String(timeEntries?.[1]?.id || "");
          if (!secondId) {
            return;
          }
          onUpsertTimeEntry({
            entryId: secondId,
            game: TEST_GAME,
            minutes: 75,
            note: "Block 2 aktualisiert",
          });
        }}
      >
        update-oldest
      </button>
      <pre data-testid="entries">{JSON.stringify(timeEntries)}</pre>
    </div>
  );
}

function renderHarness() {
  return render(
    <TimeProvider>
      <TestHarness />
    </TimeProvider>,
  );
}

function getEntriesFromDom() {
  return JSON.parse(screen.getByTestId("entries").textContent || "[]");
}

describe("TimeContext", () => {
  beforeEach(() => {
    if (typeof window.localStorage?.clear === "function") {
      window.localStorage.clear();
    }
  });

  it("erlaubt mehrere Zeitblöcke für dasselbe Spiel", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "add-1" }));
    fireEvent.click(screen.getByRole("button", { name: "add-2" }));

    const entries = getEntriesFromDom();
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(2);
    expect(entries.every((entry) => entry.gameId === "game-1")).toBe(true);
    expect(entries.map((entry) => entry.minutes).sort((left, right) => left - right)).toEqual([45, 60]);
  });

  it("aktualisiert bei edit nur den referenzierten Zeitblock", () => {
    renderHarness();

    fireEvent.click(screen.getByRole("button", { name: "add-1" }));
    fireEvent.click(screen.getByRole("button", { name: "add-2" }));
    fireEvent.click(screen.getByRole("button", { name: "update-oldest" }));

    const entries = getEntriesFromDom();
    expect(entries).toHaveLength(2);

    const updatedEntry = entries.find((entry) => entry.note === "Block 2 aktualisiert");
    expect(updatedEntry).toBeTruthy();
    expect(updatedEntry.minutes).toBe(75);

    const untouchedEntry = entries.find((entry) => entry.note === "Block 2");
    expect(untouchedEntry).toBeTruthy();
    expect(untouchedEntry.minutes).toBe(45);
  });
});
