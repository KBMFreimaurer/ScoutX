import { C } from "../styles/theme";
import { SUPPORT_EMAIL } from "../config/release";

export function SupportPage() {
  return (
    <div style={{ maxWidth: 880 }}>
      <h1
        style={{
          margin: 0,
          color: C.white,
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        Support
      </h1>
      <p style={{ color: C.grayLight, marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
        Für Hilfe, Feedback oder Datenlöschanfragen bitte an den Support schreiben.
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
        <div style={{ color: C.gray, fontSize: 12 }}>E-Mail</div>
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: C.greenLight, fontSize: 15 }}>
          {SUPPORT_EMAIL}
        </a>
        <div style={{ color: C.gray, fontSize: 12 }}>
          Bitte Betreff mit <strong style={{ color: C.offWhite }}>ScoutX iOS</strong> beginnen.
        </div>
      </section>
    </div>
  );
}
