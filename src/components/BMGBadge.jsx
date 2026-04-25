export function BMGBadge({ size = 36, variant = "mark" }) {
  const isFull = String(variant || "").toLowerCase() === "full";
  const imageSrc = isFull ? "/scoutx-mark.png" : "/scoutx-icon.png";
  const imageAlt = isFull ? "ScoutX Logo" : "ScoutX Icon";

  return (
    <img
      src={imageSrc}
      alt={imageAlt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        background: "transparent",
      }}
    />
  );
}
