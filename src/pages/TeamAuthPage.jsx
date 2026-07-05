import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { C, card, lbl, secH } from "../styles/theme";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import {
  INVITE_TOKEN_STORAGE_KEY,
  completeLogtoCallback,
  isLogtoConfigured,
  startLogtoSignIn,
} from "../services/logtoClient";
import { acceptTeamInvitationWithLogto, loginTeamBackendWithLogto } from "../services/teamBackendClient";

const wrap = { maxWidth: 440, margin: "48px auto 0", display: "grid", gap: 16 };

function AuthCard({ title, children }) {
  return (
    <div style={wrap}>
      <div style={{ ...card, padding: 24 }}>
        <div style={secH}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function ErrorAlert({ message }) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      style={{
        border: `1px solid ${C.redBorder || "rgba(255,80,80,0.35)"}`,
        background: "rgba(255,80,80,0.08)",
        color: C.offWhite,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        marginBottom: 16,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export function TeamAuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const callbackStarted = useRef(false);
  const inviteToken = mode === "invite" ? String(searchParams.get("token") || "").trim() : "";

  useEffect(() => {
    if (mode !== "callback" || callbackStarted.current) {
      return;
    }
    callbackStarted.current = true;
    (async () => {
      try {
        const { idToken } = await completeLogtoCallback();
        const pendingInvite = String(window.sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY) || "").trim();
        if (pendingInvite) {
          await acceptTeamInvitationWithLogto(pendingInvite, idToken);
          window.sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
        } else {
          await loginTeamBackendWithLogto(idToken);
        }
        // Harter Redirect, damit alle Provider den frischen Session-State laden.
        window.location.replace("/hub");
      } catch (callbackError) {
        setError(callbackError?.message || "Anmeldung fehlgeschlagen.");
      }
    })();
  }, [mode]);

  const signIn = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "invite") {
        window.sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, inviteToken);
      } else {
        window.sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
      }
      await startLogtoSignIn();
    } catch (signInError) {
      setBusy(false);
      setError(signInError?.message || "Anmeldung konnte nicht gestartet werden.");
    }
  };

  if (!isLogtoConfigured()) {
    return (
      <AuthCard title="Team-Anmeldung">
        <ErrorAlert message="Logto ist nicht konfiguriert. Bitte VITE_LOGTO_ENDPOINT und VITE_LOGTO_APP_ID setzen." />
        <GhostButton onClick={() => navigate("/hub")}>Zurück zum Cockpit</GhostButton>
      </AuthCard>
    );
  }

  if (mode === "callback") {
    return (
      <AuthCard title="Anmeldung wird abgeschlossen">
        <ErrorAlert message={error} />
        {error ? (
          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryButton onClick={() => navigate("/team/login")}>Erneut anmelden</PrimaryButton>
            <GhostButton onClick={() => navigate("/hub")}>Zum Cockpit</GhostButton>
          </div>
        ) : (
          <p style={{ color: C.grayLight, fontSize: 13, margin: 0 }}>Einen Moment, die Logto-Anmeldung wird geprüft…</p>
        )}
      </AuthCard>
    );
  }

  if (mode === "invite") {
    return (
      <AuthCard title="Team-Einladung">
        <ErrorAlert
          message={error || (inviteToken ? "" : "Einladung fehlt. Bitte den vollständigen Einladungs-Link verwenden.")}
        />
        {inviteToken ? (
          <>
            <span style={lbl}>Borussia Mönchengladbach Scouting</span>
            <p style={{ color: C.grayLight, fontSize: 13, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
              Du wurdest ins Team eingeladen. Melde dich mit dem Logto-Konto an, dessen E-Mail-Adresse eingeladen wurde.
              Die Einladung ist einmalig gültig.
            </p>
            <PrimaryButton onClick={signIn} disabled={busy} style={{ width: "100%" }}>
              {busy ? "Weiterleitung…" : "Einladung annehmen & anmelden"}
            </PrimaryButton>
          </>
        ) : (
          <GhostButton onClick={() => navigate("/hub")}>Zum Cockpit</GhostButton>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Team-Anmeldung">
      <ErrorAlert message={error} />
      <span style={lbl}>Borussia Mönchengladbach Scouting</span>
      <p style={{ color: C.grayLight, fontSize: 13, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
        Die Anmeldung läuft über den ScoutX-Login-Server (Logto). Ein Team-Beitritt ist nur über eine persönliche
        Einladung möglich.
      </p>
      <PrimaryButton onClick={signIn} disabled={busy} style={{ width: "100%" }}>
        {busy ? "Weiterleitung…" : "Mit Logto anmelden"}
      </PrimaryButton>
      <div style={{ marginTop: 10 }}>
        <GhostButton onClick={() => navigate("/hub")} style={{ width: "100%", justifyContent: "center" }}>
          Zurück zum Cockpit
        </GhostButton>
      </div>
    </AuthCard>
  );
}
