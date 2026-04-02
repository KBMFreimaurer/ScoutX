import { C, secH } from "../styles/theme";

export function PlanView({ plan, jugendLabel, kreisLabel, isMobile }) {
  return (
    <div
      className="fu2"
      style={{
        background: C.greenDim,
        border: `1px solid ${C.greenDark}`,
        borderLeft: `4px solid ${C.green}`,
        borderRadius: 8,
        padding: isMobile ? 16 : 22,
        marginBottom: 14,
      }}
    >
      <div style={{ ...secH, marginBottom: 14 }}>
        <span className="section-number">KI</span>
        Scout-Analyse · {jugendLabel} · {kreisLabel}
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.8,
          fontSize: isMobile ? 13 : 14,
          color: "#d0f0d8",
          fontFamily: "'Barlow',sans-serif",
        }}
      >
        {plan}
      </div>
    </div>
  );
}
