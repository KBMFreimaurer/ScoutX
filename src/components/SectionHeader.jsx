import { secH } from "../styles/theme";

export function SectionHeader({ num, children }) {
  return (
    <div style={secH}>
      {num ? <span className="section-number">{num}</span> : null}
      {children}
    </div>
  );
}
