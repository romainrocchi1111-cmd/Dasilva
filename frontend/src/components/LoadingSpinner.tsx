interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { px: 16, sw: 2 },
  md: { px: 32, sw: 2.5 },
  lg: { px: 48, sw: 3 },
} as const;

const TEXT_CLASS = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

export default function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  const { px, sw } = SIZES[size];
  const r = px / 2 - sw;
  const circ = 2 * Math.PI * r;
  const cx = px / 2;
  const cy = px / 2;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        aria-label="Chargement"
        style={{
          animation: 'spin 0.85s linear infinite',
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
        {/* Spinning arc — 70 % of circumference */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#2563eb"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${circ * 0.7} ${circ * 0.3}`}
        />
      </svg>

      {message && (
        <p className={`font-body text-text-secondary ${TEXT_CLASS[size]}`}>
          {message}
        </p>
      )}

      {/* Keyframes — injected once, harmless if duplicated */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
