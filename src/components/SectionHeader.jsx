import { secH } from "../styles/theme";

export function SectionHeader({ num, children }) {
  return (
    <div style={secH}>
      <span className="section-number">{num}</span>
      {children}
    </div>
  );
}
