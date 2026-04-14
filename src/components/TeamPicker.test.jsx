import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamPicker } from "./TeamPicker";
import { fetchClubSuggestions } from "../services/clubSearch";

vi.mock("../services/clubSearch", () => ({
  fetchClubSuggestions: vi.fn(),
}));

function TeamPickerHarness() {
  const [teamDraft, setTeamDraft] = useState("");
  const [selectedTeams, setSelectedTeams] = useState([]);

  return (
    <TeamPicker
      selectedTeams={selectedTeams}
      teamDraft={teamDraft}
      teamValidation={null}
      onTeamDraft={setTeamDraft}
      onAddTeam={(value) => {
        const normalized = String(value || "").trim();
        if (!normalized) {
          return;
        }
        setSelectedTeams((prev) => [...prev, normalized]);
        setTeamDraft("");
      }}
      onUpdateTeam={() => {}}
      onNormalizeTeams={() => {}}
      onRemoveTeam={() => {}}
      onClearAll={() => setSelectedTeams([])}
      adapterEndpoint="/api/games"
      adapterToken="token-123"
    />
  );
}

describe("TeamPicker", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("zeigt Live-Vereinsvorschlaege und uebernimmt Auswahl", async () => {
    fetchClubSuggestions.mockResolvedValue([
      {
        name: "Duisburger SV 1900",
        location: "47051 Duisburg",
        logoUrl: "https://www.fussball.de/export.media/logo-dsv.png",
      },
    ]);

    render(<TeamPickerHarness />);

    const input = screen.getByLabelText(/Mannschaft\/Verein hinzuf/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Duis" } });

    await waitFor(() => {
      expect(fetchClubSuggestions).toHaveBeenCalledWith("/api/games", "token-123", "Duis", 8);
    });

    const suggestion = await screen.findByRole("button", { name: /Duisburger SV 1900/i });
    fireEvent.mouseDown(suggestion);

    expect(input).toHaveValue("Duisburger SV 1900");
  });
});
