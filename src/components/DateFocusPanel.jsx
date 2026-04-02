import { card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function DateFocusPanel({ fromDate, onFromDate, focus, onFocus, jugend, jugendId }) {
  return (
    <div style={card}>
      <SectionHeader num="04">Zeitraum & Fokus</SectionHeader>

      <div className="date-focus-row">
        <div>
          <label style={lbl}>Scouting ab</label>
          <input
            className="scout-input"
            type="date"
            value={fromDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(event) => onFromDate(event.target.value)}
            style={inp}
          />
        </div>

        <div>
          <label style={lbl}>Scout-Fokus</label>
          <input
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
