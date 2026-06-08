export function HouseIcon({
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
  const wall = active ? "#E1F5EE" : "#F1EFE8";

  return (
    <div
      className={`building-icon${active ? " building-icon-active" : ""}`}
      title={label}
    >
      <svg
        width={size}
        height={Math.round(size * 1.1)}
        viewBox="0 0 64 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M32 8L56 28V64H8V28L32 8Z"
          fill={wall}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect x="24" y="40" width="16" height="24" rx="1" fill={fill} />
        <rect x="14" y="32" width="10" height="10" rx="1" fill={fill} />
        <rect x="40" y="32" width="10" height="10" rx="1" fill={fill} />
      </svg>
      {label && <span className="building-icon-label">{label}</span>}
      {sublabel && <span className="building-icon-sublabel">{sublabel}</span>}
    </div>
  );
}
