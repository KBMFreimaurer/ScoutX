import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepNav } from "./StepNav";

describe("StepNav", () => {
  it("renders all three steps", () => {
    render(
      <StepNav
        currentStep="setup"
        onStepChange={() => {}}
        canAccessGames={false}
        canAccessPlan={false}
        isMobile={false}
      />,
    );

    expect(screen.getByText(/konfiguration/i)).toBeInTheDocument();
    expect(screen.getByText(/spiele/i)).toBeInTheDocument();
    expect(screen.getByText(/plan/i)).toBeInTheDocument();
  });

  it("triggers navigation for accessible steps", () => {
    const onStepChange = vi.fn();

    render(
      <StepNav currentStep="setup" onStepChange={onStepChange} canAccessGames canAccessPlan={false} isMobile={false} />,
    );

    fireEvent.click(screen.getByText(/spiele/i));
    expect(onStepChange).toHaveBeenCalledWith("games");
  });
});
