import { createPortal } from "react-dom";
import { C } from "../styles/theme";
import { BMGBadge } from "./BMGBadge";
import { GhostButton, PrimaryButton } from "./Buttons";

const FIELD_STYLE = {
  width: "100%",
  minHeight: 48,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.045)",
  color: C.offWhite,
  padding: "12px 14px",
  fontSize: 14,
  lineHeight: 1.4,
};

const STATUS_COPY = {
  connected: "Backend verbunden",
  auth_required: "Anmeldung erforderlich",
  auth_error: "Anmeldung fehlgeschlagen",
  email_verification_required: "E-Mail bestaetigen",
  profile_required: "Profil vervollstaendigen",
  local: "Lokaler Modus",
};

function AuthModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        border: `1px solid ${active ? C.greenBorder : C.border}`,
        background: active ? C.greenDim : "rgba(255,255,255,0.03)",
        color: active ? C.greenLight : C.grayLight,
        borderRadius: 999,
        minHeight: 38,
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

function AuthSignal({ label, body, tone = "default", compact = false }) {
  const toneStyles =
    tone === "green"
      ? { border: C.greenBorder, background: C.greenDim, color: C.greenLight }
      : tone === "warn"
        ? { border: "rgba(251,191,36,0.2)", background: C.warnDim, color: C.warn }
        : { border: C.border, background: "rgba(255,255,255,0.03)", color: C.offWhite };

  return (
    <div
      style={{
        border: `1px solid ${toneStyles.border}`,
        background: toneStyles.background,
        borderRadius: 14,
        padding: compact ? "10px 12px" : "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: toneStyles.color }}>
        {label}
      </div>
      <div style={{ marginTop: compact ? 4 : 6, color: C.grayLight, fontSize: compact ? 12 : 13, lineHeight: compact ? 1.4 : 1.5 }}>{body}</div>
    </div>
  );
}

function AuthField({ id, label, children, hint }) {
  return (
    <label htmlFor={id} style={{ display: "grid", gap: 6 }}>
      <span style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>{label}</span>
      {children}
      {hint ? <span style={{ color: C.grayDark, fontSize: 11, lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

export function TeamAuthGate({
  isOpen,
  isMobile,
  mode,
  busy,
  status,
  statusMessage,
  activeUserId,
  userId,
  password,
  registerName,
  registerTeamKey,
  registerTeams,
  verificationToken,
  profileName,
  profileBirthDate,
  profileImage,
  onModeChange,
  onUserIdChange,
  onPasswordChange,
  onRegisterNameChange,
  onRegisterTeamKeyChange,
  onVerificationTokenChange,
  onProfileNameChange,
  onProfileBirthDateChange,
  onProfileImageChange,
  onResendVerification,
  onSubmitProfile,
  onSubmit,
}) {
  if (!isOpen) {
    return null;
  }

  const isRegister = mode === "register";
  const isVerification = status === "email_verification_required";
  const isProfile = status === "profile_required";
  const canSubmit =
    (isVerification
      ? Boolean(String(verificationToken || "").trim())
      : isProfile
        ? Boolean(String(profileName || "").trim() && String(profileBirthDate || "").trim() && String(profileImage || "").trim())
        : Boolean(String(password || "").trim()) && (!isRegister || Boolean(String(registerName || "").trim()))) && !busy;
  const resolvedStatus = STATUS_COPY[String(status || "").trim()] || STATUS_COPY.auth_required;
  const gateTitle = isVerification
    ? "E-Mail-Adresse bestaetigen"
    : isProfile
      ? "Scout-Profil vervollstaendigen"
      : isRegister
        ? "Teamzugang aktivieren"
        : "Mit Teamdaten weiterarbeiten";
  const isShortViewport = !isMobile && typeof window !== "undefined" && window.innerHeight < 860;
  const dialogPadding = isMobile ? 14 : isShortViewport ? 16 : 24;
  const shellGap = isMobile ? 12 : isShortViewport ? 12 : 16;
  const sectionPadding = isMobile ? 20 : isShortViewport ? 22 : 28;
  const sectionGap = isMobile ? 18 : isShortViewport ? 14 : 18;
  const fieldStyle = isShortViewport
    ? { ...FIELD_STYLE, minHeight: 44, padding: "10px 12px", fontSize: 13 }
    : FIELD_STYLE;
  const statusCardStyle = {
    border: `1px solid ${status === "auth_error" ? "rgba(239,68,68,0.2)" : C.border}`,
    background: status === "auth_error" ? C.errorDim : "rgba(255,255,255,0.025)",
    color: status === "auth_error" ? "#fecaca" : C.grayLight,
    borderRadius: 14,
    padding: isShortViewport ? "10px 12px" : "12px 14px",
    fontSize: isShortViewport ? 12 : 13,
    lineHeight: isShortViewport ? 1.45 : 1.55,
  };
  const submitHandler = isProfile ? onSubmitProfile : onSubmit;
  const handleProfileImageFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || typeof FileReader === "undefined") {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onProfileImageChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ScoutX Anmeldung"
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(180deg, rgba(6,6,9,0.84) 0%, rgba(6,6,9,0.94) 100%)",
        display: "flex",
        alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: dialogPadding,
        overflowY: "auto",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div
        data-testid="team-auth-shell"
        style={{
          width: "min(1040px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(280px, 0.95fr) minmax(320px, 1.05fr)",
          gap: shellGap,
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          background:
            "linear-gradient(135deg, rgba(14,16,20,0.98) 0%, rgba(8,10,14,0.98) 62%, rgba(6,6,9,0.98) 100%)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
          overflow: "hidden",
          overflowY: "auto",
        }}
      >
        <section
          data-testid="team-auth-form-panel"
          style={{
            padding: sectionPadding,
            display: "grid",
            gap: sectionGap,
            alignContent: "start",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ color: C.gray, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {resolvedStatus}
              </div>
              <div style={{ marginTop: 6, color: C.white, fontSize: isMobile ? 22 : isShortViewport ? 24 : 26, fontWeight: 900, letterSpacing: "-0.04em" }}>
                {gateTitle}
              </div>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: `1px solid ${status === "auth_error" ? "rgba(239,68,68,0.22)" : C.greenBorder}`,
                background: status === "auth_error" ? C.errorDim : C.greenDim,
                color: status === "auth_error" ? "#fca5a5" : C.greenLight,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {status === "auth_error" ? "Bitte pruefen" : "Session bereit"}
            </div>
          </div>

          <div
            style={statusCardStyle}
          >
            {statusMessage || "Bitte einmal anmelden. Danach kannst du im Cockpit normal weiterarbeiten."}
          </div>

          {!isVerification && !isProfile ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <AuthModeButton active={!isRegister} onClick={() => onModeChange("login")}>
                Login
              </AuthModeButton>
              <AuthModeButton active={isRegister} onClick={() => onModeChange("register")}>
                Registrieren
              </AuthModeButton>
            </div>
          ) : null}

          <form onSubmit={submitHandler} style={{ display: "grid", gap: isShortViewport ? 10 : 12 }}>
            {isVerification ? (
              <>
                <AuthField id="team-auth-verification-token" label="Bestaetigungs-Code">
                  <input
                    id="team-auth-verification-token"
                    type="text"
                    value={verificationToken}
                    onChange={(event) => onVerificationTokenChange(event.target.value)}
                    placeholder="Code aus der E-Mail"
                    autoComplete="one-time-code"
                    style={fieldStyle}
                  />
                </AuthField>
                <GhostButton type="button" onClick={onResendVerification} disabled={busy}>
                  Code erneut senden
                </GhostButton>
              </>
            ) : isProfile ? (
              <>
                <AuthField id="team-auth-profile-name" label="Name">
                  <input
                    id="team-auth-profile-name"
                    type="text"
                    value={profileName}
                    onChange={(event) => onProfileNameChange(event.target.value)}
                    placeholder="Vor- und Nachname"
                    autoComplete="name"
                    style={fieldStyle}
                  />
                </AuthField>
                <AuthField id="team-auth-profile-birth-date" label="Geburtsdatum">
                  <input
                    id="team-auth-profile-birth-date"
                    type="date"
                    value={profileBirthDate}
                    onChange={(event) => onProfileBirthDateChange(event.target.value)}
                    style={fieldStyle}
                  />
                </AuthField>
                <AuthField id="team-auth-profile-image" label="Profilbild">
                  <input id="team-auth-profile-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProfileImageFile} style={fieldStyle} />
                </AuthField>
              </>
            ) : (
              <>
                <AuthField
                  id="team-auth-user-id"
                  label="E-Mail"
                  hint={`Leer lassen, um ${activeUserId} als Standard zu nutzen.`}
                >
                  <input
                    id="team-auth-user-id"
                    type="email"
                    value={userId}
                    onChange={(event) => onUserIdChange(event.target.value)}
                    placeholder={`E-Mail (default: ${activeUserId})`}
                    autoComplete="username"
                    style={fieldStyle}
                  />
                </AuthField>

                {isRegister ? (
                  <>
                    <AuthField id="team-auth-name" label="Anzeigename">
                      <input
                        id="team-auth-name"
                        type="text"
                        value={registerName}
                        onChange={(event) => onRegisterNameChange(event.target.value)}
                        placeholder="Vor- und Nachname"
                        autoComplete="name"
                        style={fieldStyle}
                      />
                    </AuthField>
                    <AuthField id="team-auth-team" label="Teamzuordnung" hint="Die konkrete Freigabe fuer Teamdaten wird serverseitig entschieden.">
                      <select
                        id="team-auth-team"
                        value={registerTeamKey}
                        onChange={(event) => onRegisterTeamKeyChange(event.target.value)}
                        style={fieldStyle}
                      >
                        {(Array.isArray(registerTeams) ? registerTeams : []).map((team) => (
                          <option key={team.key} value={team.key}>
                            {team.label}
                          </option>
                        ))}
                      </select>
                    </AuthField>
                  </>
                ) : null}

                <AuthField
                  id="team-auth-password"
                  label="Passwort"
                  hint={isRegister ? "Mindestens 8 Zeichen fuer die Aktivierung deines Zugangs." : "Dein bestehendes Team-Passwort."}
                >
                  <input
                    id="team-auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder={isRegister ? "Neues Passwort (mind. 8 Zeichen)" : "Team-Passwort"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    style={fieldStyle}
                  />
                </AuthField>
              </>
            )}

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              <div style={{ color: C.gray, fontSize: isShortViewport ? 11 : 12, lineHeight: isShortViewport ? 1.4 : 1.5 }}>
                {isRegister
                  ? "Neue Zugaenge werden mit Teambezug angelegt und muessen per E-Mail bestaetigt werden."
                  : isVerification
                    ? "Nach der Bestaetigung prueft ScoutX automatisch, ob dein Profil vollstaendig ist."
                    : isProfile
                      ? "Rolle und Teamrechte bleiben serverseitig festgelegt."
                      : "Nach erfolgreichem Login stoert keine zusaetzliche Auth-Sperrmaske mehr im Cockpit."}
              </div>
              <PrimaryButton
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: isMobile ? "100%" : "auto",
                  minWidth: isMobile ? "100%" : 220,
                  justifyContent: "center",
                }}
              >
                {busy ? "Bitte warten..." : isVerification ? "E-Mail bestaetigen" : isProfile ? "Profil speichern" : isRegister ? "Account erstellen" : "Anmelden"}
              </PrimaryButton>
            </div>
          </form>

          <div style={{ color: C.grayDark, fontSize: 11, lineHeight: isShortViewport ? 1.45 : 1.55 }}>
            Keine Passwoerter oder Sessions werden im Browser-Storage abgelegt. Die Auth arbeitet mit der vorhandenen sicheren
            Backend-Session.
          </div>
        </section>

        <section
          data-testid="team-auth-info-panel"
          style={{
            padding: sectionPadding,
            background:
              "radial-gradient(circle at top left, rgba(0,200,83,0.14) 0%, rgba(0,200,83,0.04) 38%, rgba(255,255,255,0.01) 100%)",
            borderRight: isMobile ? "none" : `1px solid ${C.border}`,
            display: "grid",
            gap: sectionGap,
            alignContent: "start",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: isMobile ? 52 : 60,
                height: isMobile ? 52 : 60,
                borderRadius: 18,
                border: `1px solid ${C.greenBorder}`,
                background: "rgba(255,255,255,0.035)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
              }}
            >
              <BMGBadge size={isMobile ? 30 : 34} variant="full" />
            </div>
            <div>
              <div style={{ color: C.greenLight, fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Team Backend
              </div>
              <div style={{ color: C.white, fontSize: isMobile ? 22 : isShortViewport ? 24 : 28, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
                ScoutX Auth
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ margin: 0, color: C.offWhite, fontSize: isMobile ? 24 : isShortViewport ? 30 : 34, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1 }}>
              Teamzugriff mit Server-Session
            </h2>
            <p style={{ margin: isShortViewport ? "8px 0 0" : "10px 0 0", color: C.grayLight, fontSize: isMobile ? 13 : isShortViewport ? 14 : 15, lineHeight: isShortViewport ? 1.52 : 1.65, maxWidth: 420 }}>
              Melde dich mit deinem Team-Account an oder aktiviere deinen Zugang. ScoutX nutzt die vorhandene Session-Architektur
              und blendet interne Teamdaten erst nach erfolgreicher Backend-Pruefung ein.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <AuthSignal
              label="Zugriff"
              body="Teamzugang wird serverseitig geprueft. Lokale UI-Freigaben allein reichen nicht aus."
              tone="green"
              compact={isShortViewport}
            />
            <AuthSignal
              label="Session"
              body="Die Anmeldung bleibt ueber die sichere Backend-Session aktiv, bis du dich sichtbar wieder ausloggst."
              compact={isShortViewport}
            />
            <AuthSignal
              label="Hinweis"
              body="Sensible Teams werden kontrolliert freigeschaltet. Registrierung bedeutet nicht automatisch Datenzugriff."
              tone="warn"
              compact={isShortViewport}
            />
          </div>
        </section>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
}
