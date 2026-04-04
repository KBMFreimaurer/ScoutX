import { C } from "../styles/theme";

export function SkeletonLoader({ rows = 3 }) {
  return (
    <div
      className="fu"
      style={{
        marginTop: 14,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{
            height: 14,
            marginBottom: index < rows - 1 ? 10 : 0,
            width: index % 3 === 0 ? "100%" : index % 3 === 1 ? "85%" : "70%",
          }}
        />
      ))}
    </div>
  );
}
