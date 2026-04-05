export function BMGBadge({ size = 36 }) {
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
