import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameTable } from "./GameTable";

describe("GameTable", () => {
  it("sortiert Spiele nach Priorität", () => {
    const games = [
      {
        id: "game-low",
        home: "Team C",
        away: "Team D",
        priority: 3,
        dateObj: new Date("2026-05-01T00:00:00"),
        dateLabel: "Fr, 01.05.2026",
        time: "12:00",
        venue: "Platz C",
      },
      {
        id: "game-high",
        home: "Team A",
        away: "Team B",
        priority: 5,
        dateObj: new Date("2026-05-01T00:00:00"),
        dateLabel: "Fr, 01.05.2026",
        time: "10:00",
        venue: "Platz A",
      },
      {
        id: "game-mid",
        home: "Team E",
        away: "Team F",
        priority: 4,
        dateObj: new Date("2026-05-01T00:00:00"),
        dateLabel: "Fr, 01.05.2026",
        time: "11:00",
        venue: "Platz B",
      },
    ];

    render(<GameTable games={games} />);

    const rows = screen.getAllByRole("row");
    const firstDataRow = rows[1];

    expect(within(firstDataRow).getByText("Team A")).toBeInTheDocument();
    expect(within(firstDataRow).getByText("Team B")).toBeInTheDocument();
  });

  it("zeigt Favoriten, Entfernung und speichert Notizen", () => {
    const onToggleNote = vi.fn();
    const onSetNote = vi.fn();

    const games = [
      {
        id: "game-1",
        home: "Team A",
        away: "Team B",
        priority: 5,
        dateObj: new Date("2026-05-01T00:00:00"),
        dateLabel: "Fr, 01.05.2026",
        time: "14:00",
        venue: "Platz A",
        isFavoriteGame: true,
        distanceKm: 12.4,
        matchUrl: "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
      },
    ];

    render(
      <GameTable
        games={games}
        notes={{ "game-1": "Spieler #10 beobachten" }}
        expandedNoteId="game-1"
        onToggleNote={onToggleNote}
        onSetNote={onSetNote}
      />,
    );

    expect(screen.getByText("★")).toBeInTheDocument();
    expect(screen.getByText("12 km")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zum Spiel für Team A vs Team B/i })).toHaveAttribute(
      "href",
      "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
    );

    fireEvent.click(screen.getByRole("button", { name: "Notiz" }));
    expect(onToggleNote).toHaveBeenCalledWith("game-1");

    const textarea = screen.getByLabelText(/Notiz für Team A gegen Team B/i);
    fireEvent.change(textarea, { target: { value: "Neuer Hinweis" } });
    expect(onSetNote).toHaveBeenCalledWith("game-1", "Neuer Hinweis");
  });
});
