export function LoadingSkeleton({ 
  count = 3, 
  height = "h-16", 
  className = "" 
}: { 
  count?: number; 
  height?: string; 
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={`${height} rounded-lg bg-gradient-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 animate-pulse`}
          style={{
            animationDelay: `${i * 100}ms`,
            animationDuration: '1.5s'
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ 
  title, 
  icon, 
  color = "neon-blue",
  count = 3,
  height = "h-16"
}: { 
  title: string; 
  icon?: string;
  color?: string;
  count?: number;
  height?: string;
}) {
  return (
    <div className={`glass-card neon-border-${color} p-6`}>
      <div className="flex items-center gap-2 mb-4">
        {icon && <span>{icon}</span>}
        <span className={`text-xs font-bold uppercase tracking-wider neon-text-${color}`}>
          {title}
        </span>
      </div>
      <LoadingSkeleton count={count} height={height} />
    </div>
  );
}
