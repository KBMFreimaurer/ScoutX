import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TeamAuthGate } from "./TeamAuthGate";

function createProps(overrides = {}) {
  return {
    isOpen: true,
    isMobile: false,
    mode: "login",
    busy: false,
    status: "auth_required",
    statusMessage: "Bitte anmelden, damit Teamdaten synchronisiert werden.",
    activeUserId: "user-scout",
    userId: "",
    password: "",
    registerName: "",
    registerTeamKey: "borussia-moenchengladbach",
    registerTeams: [{ key: "borussia-moenchengladbach", label: "Borussia Mönchengladbach" }],
    verificationToken: "",
    profileName: "",
    profileBirthDate: "",
    profileImage: "",
    onModeChange: vi.fn(),
    onUserIdChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onRegisterNameChange: vi.fn(),
    onRegisterTeamKeyChange: vi.fn(),
    onVerificationTokenChange: vi.fn(),
    onProfileNameChange: vi.fn(),
    onProfileBirthDateChange: vi.fn(),
    onProfileImageChange: vi.fn(),
    onResendVerification: vi.fn(),
    onSubmitProfile: vi.fn((event) => event.preventDefault()),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };
}

describe("TeamAuthGate", () => {
  it("renders a two-column ScoutX auth layout on desktop", () => {
    render(<TeamAuthGate {...createProps()} />);

    expect(screen.getByRole("dialog", { name: /ScoutX Anmeldung/i })).toBeInTheDocument();
    expect(screen.getByTestId("team-auth-shell")).toHaveStyle({
      gridTemplateColumns: "minmax(280px, 0.95fr) minmax(320px, 1.05fr)",
    });
    expect(screen.getByText(/Teamzugriff mit Server-Session/i)).toBeInTheDocument();
  });

  it("stacks the auth layout on mobile", () => {
    render(<TeamAuthGate {...createProps({ isMobile: true })} />);

    expect(screen.getByTestId("team-auth-shell")).toHaveStyle({
      gridTemplateColumns: "1fr",
    });
  });

  it("keeps the auth shell reachable within the viewport", () => {
    render(<TeamAuthGate {...createProps()} />);

    expect(screen.getByRole("dialog", { name: /ScoutX Anmeldung/i })).toHaveStyle({
      alignItems: "center",
      overflowY: "auto",
    });
    expect(screen.getByTestId("team-auth-shell")).toHaveStyle({
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
    });
  });

  it("switches to a compact desktop spacing preset on short viewports", () => {
    const previousHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 780,
    });

    render(<TeamAuthGate {...createProps()} />);

    expect(screen.getByRole("dialog", { name: /ScoutX Anmeldung/i })).toHaveStyle({
      padding: "16px",
    });
    expect(screen.getByTestId("team-auth-shell")).toHaveStyle({
      gap: "12px",
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: previousHeight,
    });
  });

  it("shows the form panel before the info panel in stacked layout", () => {
    render(<TeamAuthGate {...createProps({ isMobile: true })} />);

    const formPanel = screen.getByTestId("team-auth-form-panel");
    const infoPanel = screen.getByTestId("team-auth-info-panel");

    expect(formPanel.compareDocumentPosition(infoPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the dialog through a portal so transformed parents cannot offset it", () => {
    const { container } = render(
      <div data-testid="transformed-host" style={{ transform: "translateY(16px)" }}>
        <TeamAuthGate {...createProps()} />
      </div>,
    );

    const host = screen.getByTestId("transformed-host");
    const dialog = screen.getByRole("dialog", { name: /ScoutX Anmeldung/i });

    expect(container).toContainElement(host);
    expect(host).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it("shows login fields by default and hides registration-only fields", () => {
    render(<TeamAuthGate {...createProps()} />);

    expect(screen.getByLabelText(/E-Mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Anzeigename/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Teamzuordnung/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anmelden/i })).toBeDisabled();
  });

  it("shows registration fields and enables the CTA only with display name and password", () => {
    render(
      <TeamAuthGate
        {...createProps({
          mode: "register",
          password: "secret-123",
          registerName: "Ayoub Kerbab",
        })}
      />,
    );

    expect(screen.getByLabelText(/Anzeigename/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Teamzuordnung/i)).toBeInTheDocument();
    expect(screen.getByText(/Teamzugang wird serverseitig geprueft/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account erstellen/i })).not.toBeDisabled();
  });

  it("forwards mode changes through the segmented controls", () => {
    const onModeChange = vi.fn();
    render(<TeamAuthGate {...createProps({ onModeChange })} />);

    fireEvent.click(screen.getByRole("button", { name: /Registrieren/i }));

    expect(onModeChange).toHaveBeenCalledWith("register");
  });

  it("shows the verification gate when email confirmation is required", () => {
    render(<TeamAuthGate {...createProps({ status: "email_verification_required", verificationToken: "abc123" })} />);

    expect(screen.getByLabelText(/Bestaetigungs-Code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /E-Mail bestaetigen/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Code erneut senden/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Passwort/i)).not.toBeInTheDocument();
  });

  it("shows the profile gate and requires a complete profile", () => {
    render(
      <TeamAuthGate
        {...createProps({
          status: "profile_required",
          profileName: "Ayoub Kerbab",
          profileBirthDate: "2000-01-01",
          profileImage: "data:image/png;base64,AAAA",
        })}
      />,
    );

    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Geburtsdatum/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Profilbild/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Profil speichern/i })).not.toBeDisabled();
  });
});
