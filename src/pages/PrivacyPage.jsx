import { C } from "../styles/theme";
import { SUPPORT_EMAIL } from "../config/release";

const POINTS = [
  "ScoutX speichert Konfigurations- und Planungsdaten lokal im App-Container.",
  "An den Adapter-Service werden nur für den Spielabruf und optionale Anreicherungen notwendige Nutzdaten gesendet.",
  "Es werden keine Tracking-IDs für Drittanbieter-Werbung erhoben.",
  "Exportfunktionen (PDF/CSV/JSON/ICS) erzeugen Dateien nur auf explizite Nutzeraktion.",
  "Löschanfragen und Supportanfragen laufen über den ausgewiesenen Support-Kanal.",
];

export function PrivacyPage() {
  return (
    <div style={{ maxWidth: 920 }}>
      <h1
        style={{
          margin: 0,
          color: C.white,
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        Datenschutz
      </h1>
      <p style={{ color: C.grayLight, marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
        Diese Kurzfassung beschreibt die aktuelle ScoutX-Datenverarbeitung für den iOS-Release.
      </p>

      <section
        style={{
          marginTop: 16,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          background: C.surface,
          padding: 16,
          display: "grid",
          gap: 10,
        }}
      >
        {POINTS.map((line) => (
          <div key={line} style={{ color: C.offWhite, fontSize: 14, lineHeight: 1.55 }}>
            {line}
          </div>
        ))}
      </section>

      <p style={{ color: C.grayLight, marginTop: 14, fontSize: 13 }}>
        Vollständige Privacy-Anfragen:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: C.greenLight }}>
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
