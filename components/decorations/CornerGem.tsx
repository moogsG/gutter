export function CornerGem({ position = "top-right", color = "neon-pink" }: { position?: string, color?: string }) {
  const colors: Record<string, string> = {
    "neon-pink": "#ff6ec7",
    "neon-blue": "#00d9ff",
    "neon-purple": "#7b68ee",
  };

  const positionClasses: Record<string, string> = {
    "top-right": "absolute top-2 right-2",
    "top-left": "absolute top-2 left-2",
    "bottom-right": "absolute bottom-2 right-2",
    "bottom-left": "absolute bottom-2 left-2",
  };

  return (
    <div className={`corner-gem ${positionClasses[position]}`}>
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: colors[color],
          boxShadow: `0 0 8px ${colors[color]}, 0 0 16px ${colors[color]}`,
        }}
      />
    </div>
  );
}
