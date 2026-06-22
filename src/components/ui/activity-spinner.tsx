const NUM_SPOKES = 12;
const DURATION = 1.2;

export function ActivitySpinner({
  size = 48,
  color = "#111827",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-label="Loading"
      role="status"
    >
      {Array.from({ length: NUM_SPOKES }).map((_, i) => {
        const angle = (i * 360) / NUM_SPOKES;
        const delay = -((NUM_SPOKES - 1 - i) * DURATION) / NUM_SPOKES;
        return (
          <rect
            key={i}
            x="46.5"
            y="8"
            width="7"
            height="22"
            rx="3.5"
            fill={color}
            transform={`rotate(${angle}, 50, 50)`}
            style={{
              animation: `spinner-fade ${DURATION}s linear infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </svg>
  );
}
