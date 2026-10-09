import { useId } from "react";

/**
 * HF monogram for the admin shell: italic champagne "HF" over a road
 * swoosh, echoing the public logo (green/gold HF, truck, road) in a
 * restrained dark-emerald tile. Gradient ids are unique per instance
 * (a gradient defined inside a display:none SVG will not paint in
 * another SVG that references it).
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const bg = `hfm-bg-${uid}`;
  const gold = `hfm-gold-${uid}`;
  return (
    <svg className="a-brandmark" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="HF Removals">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a6150" />
          <stop offset="1" stopColor="#061f1a" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6e7bf" />
          <stop offset="0.55" stopColor="#d9bc85" />
          <stop offset="1" stopColor="#b08a45" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="13" fill={`url(#${bg})`} stroke="#e1c895" strokeOpacity="0.55" strokeWidth="1.5" />
      <path d="M6.5 36.5C15 27.5 27 25 41.5 31" stroke={`url(#${gold})`} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M10 34.2C18 28.6 27.5 27.4 39 31.6" stroke="#f6e7bf" strokeOpacity="0.75" strokeWidth="0.9" strokeDasharray="2 3.2" fill="none" strokeLinecap="round" />
      <text
        x="24"
        y="25.5"
        textAnchor="middle"
        fontFamily="var(--a-font-display, Georgia, serif)"
        fontSize="22"
        fontWeight="600"
        fontStyle="italic"
        fill={`url(#${gold})`}
        letterSpacing="-1.2"
      >
        HF
      </text>
    </svg>
  );
}
