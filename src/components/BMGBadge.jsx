export function BMGBadge({ size = 36, variant = "mark" }) {
  const isFull = String(variant || "").toLowerCase() === "full";

  if (isFull) {
    return (
      <span
        aria-label="ScoutX Logo"
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          color: "#f8fafc",
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: 0,
          whiteSpace: "nowrap",
        }}
      >
        Scout
        <span style={{ color: "#00d060" }}>X</span>
      </span>
    );
  }

  return (
    <img
      src="/scoutx-icon.png"
      alt="ScoutX Icon"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        borderRadius: 8,
      }}
    />
  );
}
