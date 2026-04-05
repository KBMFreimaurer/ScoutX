import { card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function DateFocusPanel({ fromDate, onFromDate, focus, onFocus, jugend, jugendId }) {
  return (
    <div style={card}>
      <SectionHeader num="04">Zeitraum & Fokus</SectionHeader>

      <div className="date-focus-row">
        <div>
          <label htmlFor="scouting-from-date" style={lbl}>Scouting ab</label>
          <input
            id="scouting-from-date"
            className="scout-input"
            type="date"
            value={fromDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(event) => onFromDate(event.target.value)}
            style={inp}
          />
        </div>

        <div>
          <label htmlFor="scout-focus-input" style={lbl}>Scout-Fokus</label>
          <input
            id="scout-focus-input"
            className="scout-input"
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
