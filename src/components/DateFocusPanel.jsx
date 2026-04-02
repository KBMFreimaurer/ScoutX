import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function DateFocusPanel({ fromDate, onFromDate, focus, onFocus, jugend, jugendId }) {
  return (
    <div style={card}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />
      <SectionHeader num="04">Zeitraum & Scout-Fokus</SectionHeader>

      <div className="date-focus-row">
        <div>
          <label style={lbl}>Scouting ab</label>
          <input
            type="date"
            value={fromDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(event) => onFromDate(event.target.value)}
            style={inp}
          />
        </div>

        <div>
          <label style={lbl}>Scout-Fokus (optional)</label>
          <input
            placeholder={jugendId ? `z.B. Torhüter ${jugend?.label}, Außenspieler...` : "z.B. Stürmer, Innenverteidiger..."}
            value={focus}
            onChange={(event) => onFocus(event.target.value)}
            style={inp}
          />
        </div>
      </div>
    </div>
  );
}
