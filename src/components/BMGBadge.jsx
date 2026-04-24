export function BMGBadge({ size = 36, variant = "mark" }) {
  const isFull = String(variant || "").toLowerCase() === "full";

  if (isFull) {
    return (
      <>
        <img
          src="/scoutx-logo.png"
          alt="ScoutX Logo"
          width={Math.round(size * 3.2)}
          height={size}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.nextElementSibling;
            if (fallback) {
              fallback.style.display = "inline-flex";
            }
          }}
          style={{
            width: Math.round(size * 3.2),
            height: size,
            objectFit: "contain",
            display: "block",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            display: "none",
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
      </>
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
