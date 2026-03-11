export function SparkleAccent({ color = "neon-pink" }: { color?: string }) {
  const colors: Record<string, string> = {
    "neon-pink": "#ff6ec7",
    "neon-blue": "#00d9ff",
    "neon-purple": "#7b68ee",
  };

  return (
    <div className="flex items-center justify-center gap-2 my-6">
      <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-600" />
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 0 L9 7 L16 8 L9 9 L8 16 L7 9 L0 8 L7 7 Z"
          fill={colors[color]}
          opacity="0.8"
        />
      </svg>
      <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-600" />
    </div>
  );
}
