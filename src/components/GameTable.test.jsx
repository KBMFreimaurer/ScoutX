import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameTable } from "./GameTable";

describe("GameTable", () => {
  it("sortiert Spiele nach Prioritaet", () => {
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
});
