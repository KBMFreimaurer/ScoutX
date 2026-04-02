import { C } from "../styles/theme";

export function SkeletonLoader({ rows = 3 }) {
  return (
    <div
      style={{
        marginTop: 12,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
      }}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{
            height: 16,
            marginBottom: index < rows - 1 ? 10 : 0,
            width: index % 2 === 0 ? "100%" : "85%",
          }}
        />
      ))}
    </div>
  );
}
