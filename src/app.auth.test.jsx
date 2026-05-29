import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./app";

describe("App auth gate", () => {
  it("blocks ScoutX features until the team session is authenticated", async () => {
    render(
      <MemoryRouter initialEntries={["/plan"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("dialog", { name: /ScoutX Anmeldung/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Scout-Plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /In HRworks importieren/i })).not.toBeInTheDocument();
  });
});
