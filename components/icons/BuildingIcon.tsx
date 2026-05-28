export function BuildingIcon({
  label,
  sublabel,
  active = false,
  size = 52,
}: {
  label?: string;
  sublabel?: string;
  active?: boolean;
  size?: number;
}) {
  const fill = active ? "#1D9E75" : "#888780";
  const stroke = active ? "#085041" : "#444441";

  return (
    <div
      className={`building-icon${active ? " building-icon-active" : ""}`}
      title={label}
    >
      <svg
        width={size}
        height={Math.round(size * 1.25)}
        viewBox="0 0 64 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect
          x="8"
          y="20"
          width="48"
          height="56"
          rx="4"
          fill={active ? "#E1F5EE" : "#F1EFE8"}
          stroke={stroke}
          strokeWidth="1.5"
        />
        <rect x="14" y="28" width="10" height="10" rx="1" fill={fill} />
        <rect x="27" y="28" width="10" height="10" rx="1" fill={fill} />
        <rect x="40" y="28" width="10" height="10" rx="1" fill={fill} />
        <rect x="14" y="42" width="10" height="10" rx="1" fill={fill} />
        <rect x="27" y="42" width="10" height="10" rx="1" fill={fill} />
        <rect x="40" y="42" width="10" height="10" rx="1" fill={fill} />
        <rect x="22" y="58" width="20" height="18" rx="1" fill={fill} />
        <polygon
          points="32,6 56,22 8,22"
          fill={active ? "#1D9E75" : "#C4C3BB"}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {label && <span className="building-icon-label">{label}</span>}
      {sublabel && <span className="building-icon-sublabel">{sublabel}</span>}
    </div>
  );
}
