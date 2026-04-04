import { C, secH } from "../styles/theme";

export function PlanView({ plan, jugendLabel, kreisLabel, isMobile }) {
  return (
    <div
      className="fu2"
      style={{
        background: C.greenDim,
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 14,
        padding: isMobile ? 18 : 24,
        marginBottom: 16,
      }}
    >
      <div style={{ ...secH, marginBottom: 16 }}>
        <span className="section-number">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/></svg>
        </span>
        Scout-Analyse · {jugendLabel} · {kreisLabel}
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.75,
          fontSize: isMobile ? 13 : 14,
          color: C.offWhite,
          fontFamily: "'Inter',sans-serif",
        }}
      >
        {plan}
      </div>
    </div>
  );
}
