export function BMGBadge({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">
      <path d="M62 8 L106 26 L106 70 Q106 98 62 116 Q18 98 18 70 L18 26 Z" fill="#000" opacity="0.3" transform="translate(2,2)" />
      <path d="M60 6 L104 24 L104 68 Q104 96 60 114 Q16 96 16 68 L16 24 Z" fill="#00873E" />
      <rect x="16" y="38" width="88" height="14" fill="#111111" />
      <rect x="16" y="66" width="88" height="14" fill="#111111" />
      <rect x="16" y="52" width="88" height="14" fill="#ffffff" />
      <rect x="16" y="80" width="88" height="14" fill="#ffffff" opacity="0.15" />
      <path
        d="M60 6 L104 24 L104 68 Q104 96 60 114 Q16 96 16 68 L16 24 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
      <text
        x="60"
        y="62"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Arial Black', Impact, sans-serif"
        fontWeight="900"
        fontSize="36"
        fill="#ffffff"
        letterSpacing="-1"
      >
        B
      </text>
      <text x="60" y="22" textAnchor="middle" dominantBaseline="middle" fontFamily="serif" fontSize="12" fill="#ffffff">
        ★ ★ ★
      </text>
    </svg>
  );
}
