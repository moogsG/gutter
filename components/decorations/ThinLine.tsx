export function ThinLine({ color = "neon-pink", length = "short", className = "" }: { color?: string, length?: string, className?: string }) {
  const colors: Record<string, string> = {
    "neon-pink": "#ff6ec7",
    "neon-blue": "#00d9ff",
  };

  const widths: Record<string, string> = {
    short: "w-8",
    medium: "w-16",
    long: "w-24",
  };

  return (
    <div
      className={`h-px ${widths[length]} ${className}`}
      style={{
        background: `linear-gradient(90deg, transparent, ${colors[color]}, transparent)`,
        boxShadow: `0 0 4px ${colors[color]}`,
      }}
    />
  );
}
