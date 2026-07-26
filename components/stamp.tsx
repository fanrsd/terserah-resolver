/**
 * The signature motif: an inked rubber stamp struck across the decree.
 * Edges are roughened with turbulence so it reads as pressed rubber rather
 * than a vector rectangle.
 */
export function Stamp({
  label,
  sub,
  tone = "stamp",
  className = "",
}: {
  label: string;
  sub: string;
  tone?: "stamp" | "seal";
  className?: string;
}) {
  // Deep variants: the 10.5px sub-line is an image of text and needs 4.5:1
  // against the sheet, which the display-weight tones do not clear.
  const color =
    tone === "seal" ? "var(--color-seal-deep)" : "var(--color-stamp-deep)";
  const id = `rough-${tone}`;

  return (
    <svg
      viewBox="0 0 320 116"
      className={className}
      role="img"
      aria-label={`${label}. ${sub}.`}
    >
      <filter id={id} x="-15%" y="-30%" width="130%" height="160%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.045 0.09"
          numOctaves={3}
          seed={7}
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="4.5"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

      <g filter={`url(#${id})`} fill="none" stroke={color}>
        <rect x="6" y="6" width="308" height="104" rx="3" strokeWidth="6" />
        <rect x="17" y="17" width="286" height="82" rx="2" strokeWidth="2" />
        <text
          x="160"
          y="58"
          fill={color}
          stroke="none"
          textAnchor="middle"
          fontFamily="var(--font-decree)"
          fontSize="34"
          letterSpacing="0.02em"
        >
          {label.toUpperCase()}
        </text>
        <text
          x="160"
          y="83"
          fill={color}
          stroke="none"
          textAnchor="middle"
          fontFamily="var(--font-typed)"
          fontWeight="700"
          fontSize="10.5"
          letterSpacing="0.18em"
        >
          {sub.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}
