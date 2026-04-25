export function BMGBadge({ size = 36, variant = "mark" }) {
  const isFull = String(variant || "").toLowerCase() === "full";
  const assetVersion = "2026-04-25-2";
  const imageSrc = isFull ? `/scoutx-mark.png?v=${assetVersion}` : `/scoutx-icon.png?v=${assetVersion}`;
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
