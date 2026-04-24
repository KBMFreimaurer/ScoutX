import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepNav } from "./StepNav";

describe("StepNav", () => {
  it("renders cockpit and configuration outside the configuration flow", () => {
    render(
      <StepNav
        currentStep="hub"
        onStepChange={() => {}}
        canAccessGames
        canAccessPlan
        isMobile={false}
      />,
    );

    expect(screen.getByText(/cockpit/i)).toBeInTheDocument();
    expect(screen.getByText(/konfiguration/i)).toBeInTheDocument();
    expect(screen.queryByText(/spiele/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/plan/i)).not.toBeInTheDocument();
  });

  it("renders cockpit and all three setup steps inside the configuration flow", () => {
    render(
      <StepNav
        currentStep="setup"
        onStepChange={() => {}}
        canAccessGames={false}
        canAccessPlan={false}
        isMobile={false}
      />,
    );

    expect(screen.getByText(/cockpit/i)).toBeInTheDocument();
    expect(screen.getByText(/konfiguration/i)).toBeInTheDocument();
    expect(screen.getByText(/spiele/i)).toBeInTheDocument();
    expect(screen.getByText(/plan/i)).toBeInTheDocument();
  });

  it("triggers navigation back to cockpit", () => {
    const onStepChange = vi.fn();

    render(
      <StepNav currentStep="setup" onStepChange={onStepChange} canAccessGames canAccessPlan isMobile={false} />,
    );

    fireEvent.click(screen.getByText(/cockpit/i));
    expect(onStepChange).toHaveBeenCalledWith("hub");
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
