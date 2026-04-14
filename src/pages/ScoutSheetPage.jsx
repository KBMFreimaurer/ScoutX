import { useEffect, useMemo, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { STORAGE_KEYS } from "../config/storage";
import { useScoutX } from "../context/ScoutXContext";
import { C } from "../styles/theme";

function readPlayerSheets() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.playerSheets);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || ""),
        createdAt: String(item.createdAt || ""),
        updatedAt: String(item.updatedAt || item.createdAt || ""),
        name: String(item.name || "").trim(),
        club: String(item.club || "").trim(),
        birthDate: String(item.birthDate || "").trim(),
        jerseyNumber: normalizeJerseyNumber(item.jerseyNumber),
        position: String(item.position || "").trim(),
        strengths: String(item.strengths || "").trim(),
      }))
      .filter((item) => item.id && item.name)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  } catch {
    return [];
  }
}

function toInputDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return "";
}

function toDateLabel(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "-";
  }

  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateTimeLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeJerseyNumber(value) {
  const text = String(value || "").trim();
  if (!/^\d{1,3}$/.test(text)) {
    return "";
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
    return "";
  }

  return String(parsed);
}

function emptyForm() {
  return {
    id: "",
    name: "",
    club: "",
    birthDate: "",
    jerseyNumber: "",
    position: "",
    strengths: "",
  };
}

export function ScoutSheetPage() {
  const { isMobile } = useScoutX();
  const [entries, setEntries] = useState(() => readPlayerSheets());
  const [form, setForm] = useState(() => emptyForm());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.playerSheets, JSON.stringify(entries));
    } catch {
      // Ignore optional localStorage write errors.
    }
  }, [entries]);

  const isEditing = Boolean(form.id);

  const playerCountLabel = useMemo(() => {
    const count = entries.length;
    if (count === 1) {
      return "1 Spieler";
    }
    return `${count} Spieler`;
  }, [entries.length]);

  const handleSubmit = () => {
    const name = String(form.name || "").trim();
    const club = String(form.club || "").trim();
    const birthDate = toInputDate(form.birthDate);
    const jerseyNumber = normalizeJerseyNumber(form.jerseyNumber);
    const position = String(form.position || "").trim();
    const strengths = String(form.strengths || "").trim();

    if (!name) {
      setError("Bitte einen Spielernamen eintragen.");
      return;
    }
    if (!club) {
      setError("Bitte den aktuellen Verein eintragen.");
      return;
    }
    if (!birthDate) {
      setError("Bitte ein gültiges Geburtsdatum wählen.");
      return;
    }
    if (!jerseyNumber) {
      setError("Bitte eine gültige Trikotnummer eintragen.");
      return;
    }
    if (!position) {
      setError("Bitte eine Position eintragen.");
      return;
    }
    if (!strengths) {
      setError("Bitte die Stärken des Spielers beschreiben.");
      return;
    }

    const nowIso = new Date().toISOString();

    if (isEditing) {
      setEntries((prev) =>
        prev
          .map((entry) =>
            entry.id === form.id
              ? {
                  ...entry,
                  name,
                  club,
                  birthDate,
                  jerseyNumber,
                  position,
                  strengths,
                  updatedAt: nowIso,
                }
              : entry,
          )
          .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))),
      );
      setNotice("Spielerbewertung wurde aktualisiert.");
    } else {
      const nextEntry = {
        id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        name,
        club,
        birthDate,
        jerseyNumber,
        position,
        strengths,
      };

      setEntries((prev) => [nextEntry, ...prev]);
      setNotice("Spieler wurde im Bewertungsbogen angelegt.");
    }

    setError("");
    setForm(emptyForm());
  };

  const onEdit = (entry) => {
    setForm({
      id: entry.id,
      name: entry.name,
      club: entry.club,
      birthDate: toInputDate(entry.birthDate),
      jerseyNumber: normalizeJerseyNumber(entry.jerseyNumber),
      position: entry.position,
      strengths: entry.strengths,
    });
    setError("");
    setNotice("");
  };

  const onDelete = (entryId) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    setForm((prev) => (prev.id === entryId ? emptyForm() : prev));
    setError("");
    setNotice("Spieler wurde aus dem Bewertungsbogen entfernt.");
  };

  return (
    <div className="fu">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: C.white, fontSize: isMobile ? 24 : 30, fontWeight: 800, letterSpacing: "-0.4px" }}>
          Scout-Bewertungsbogen
        </h1>
        <p style={{ margin: "8px 0 0", color: C.gray, fontSize: 13, lineHeight: 1.5, maxWidth: 900 }}>
          Lege Spieler an und dokumentiere strukturiert Name, Verein, Geburtsdatum, Trikotnummer, Position und deine
          manuelle Stärken-Einschätzung. Die Einträge werden lokal auf deinem Gerät gespeichert.
        </p>
      </div>

      {error ? (
        <div
          style={{
            border: `1px solid rgba(239,68,68,0.24)`,
            background: C.errorDim,
            color: "#fca5a5",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          style={{
            border: `1px solid ${C.greenBorder}`,
            background: C.greenDim,
            color: C.greenLight,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {notice}
        </div>
      ) : null}

      <section
        className="fu2"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          background: C.surface,
          padding: isMobile ? 12 : 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Spielername</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="z. B. Max Mustermann"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Aktueller Verein</span>
            <input
              type="text"
              value={form.club}
              onChange={(event) => setForm((prev) => ({ ...prev, club: event.target.value }))}
              placeholder="z. B. SF Hamborn 07"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",
            marginTop: 10,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Geburtsdatum</span>
            <input
              type="date"
              value={form.birthDate}
              onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Trikotnummer</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="999"
              step="1"
              value={form.jerseyNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, jerseyNumber: event.target.value }))}
              placeholder="z. B. 10"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Position</span>
            <input
              type="text"
              value={form.position}
              onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
              placeholder="z. B. IV, 6er, LA"
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
                minHeight: 44,
                padding: "10px 12px",
                fontSize: 13,
              }}
            />
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          <span style={{ color: C.gray, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Stärken (manuelle Notiz)</span>
          <textarea
            value={form.strengths}
            onChange={(event) => setForm((prev) => ({ ...prev, strengths: event.target.value }))}
            placeholder="Beschreibe die Stärken des Spielers: Technik, Athletik, Entscheidungsverhalten, Mentalität, etc."
            rows={isMobile ? 6 : 5}
            style={{
              width: "100%",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.offWhite,
              minHeight: isMobile ? 130 : 120,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <PrimaryButton onClick={handleSubmit} style={{ minWidth: isMobile ? "100%" : 220 }}>
            {isEditing ? "Bewertung aktualisieren" : "Spieler anlegen"}
          </PrimaryButton>
          {isEditing ? (
            <GhostButton
              onClick={() => {
                setForm(emptyForm());
                setError("");
              }}
              style={{ minWidth: isMobile ? "100%" : "auto" }}
            >
              Bearbeitung abbrechen
            </GhostButton>
          ) : null}
        </div>
      </section>

      <section
        className="fu3"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          background: C.surface,
          padding: isMobile ? 12 : 16,
        }}
      >
        <div style={{ color: C.offWhite, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          Angelegte Spieler · <span style={{ color: C.grayLight, fontWeight: 600 }}>{playerCountLabel}</span>
        </div>

        {entries.length === 0 ? (
          <div style={{ color: C.gray, fontSize: 13 }}>
            Noch keine Spieler angelegt. Nutze oben das Formular, um den ersten Bewertungsbogen zu erstellen.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {entries.map((entry) => (
              <article
                key={entry.id}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ color: C.white, fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{entry.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11 }}>
                  <span
                    style={{
                      border: `1px solid ${C.greenBorder}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.greenLight,
                      background: C.greenDim,
                    }}
                  >
                    Verein: {entry.club || "-"}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Nr.: {normalizeJerseyNumber(entry.jerseyNumber) || "-"}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Geb.: {toDateLabel(entry.birthDate)}
                  </span>
                  <span
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: "3px 8px",
                      color: C.grayLight,
                    }}
                  >
                    Position: {entry.position || "-"}
                  </span>
                </div>

                <div
                  style={{
                    color: C.offWhite,
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {entry.strengths}
                </div>

                <div style={{ color: C.grayDark, fontSize: 11 }}>
                  Zuletzt geändert: {toDateTimeLabel(entry.updatedAt || entry.createdAt)}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  <GhostButton onClick={() => onEdit(entry)} style={{ minHeight: 36, padding: "6px 12px", fontSize: 12 }}>
                    Bearbeiten
                  </GhostButton>
                  <GhostButton
                    onClick={() => onDelete(entry.id)}
                    style={{
                      minHeight: 36,
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "#fca5a5",
                      borderColor: "rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.08)",
                    }}
                  >
                    Löschen
                  </GhostButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
