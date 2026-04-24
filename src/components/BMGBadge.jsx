export function BMGBadge({ size = 36, variant = "mark" }) {
  const isFull = String(variant || "").toLowerCase() === "full";
  const src = isFull ? "/scoutx-logo.png" : "/scoutx-icon.png";
  const width = isFull ? Math.round(size * 3.2) : size;

  return (
    <img
      src={src}
      alt={isFull ? "ScoutX Logo" : "ScoutX Icon"}
      width={width}
      height={size}
      style={{
        width,
        height: size,
        objectFit: "contain",
        display: "block",
        borderRadius: isFull ? 0 : 8,
      }}
    />
  );
}
