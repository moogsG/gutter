import { Square, CheckSquare, Triangle, Circle, Heart, Star } from "lucide-react";
import type { Signifier, EntryStatus } from "@/types/journal";
import { cn } from "@/lib/utils";

interface SignifierIconProps {
  signifier: Signifier;
  status: EntryStatus;
  className?: string;
}

export function SignifierIcon({ signifier, status, className }: SignifierIconProps) {
  const baseClasses = "w-4 h-4";
  
  // Tasks and appointments toggle between open/done
  if (signifier === "task") {
    if (status === "done") {
      return <CheckSquare className={cn(baseClasses, "text-primary fill-primary", className)} />;
    }
    if (status === "migrated") {
      return <Square className={cn(baseClasses, "text-muted-foreground opacity-60", className)} />;
    }
    if (status === "killed") {
      return <Square className={cn(baseClasses, "text-muted-foreground opacity-40", className)} />;
    }
    return <Square className={cn(baseClasses, "text-foreground", className)} />;
  }

  if (signifier === "appointment") {
    if (status === "done") {
      return <Triangle className={cn(baseClasses, "text-accent fill-accent", className)} />;
    }
    if (status === "migrated") {
      return <Triangle className={cn(baseClasses, "text-muted-foreground opacity-60", className)} />;
    }
    if (status === "killed") {
      return <Triangle className={cn(baseClasses, "text-muted-foreground opacity-40", className)} />;
    }
    return <Triangle className={cn(baseClasses, "text-foreground", className)} />;
  }

  if (signifier === "note") {
    return <Circle className={cn(baseClasses, "text-foreground fill-foreground", className)} />;
  }

  if (signifier === "memory") {
    return <Heart className={cn(baseClasses, "text-destructive fill-destructive", className)} />;
  }

  if (signifier === "important") {
    return <Star className={cn(baseClasses, "text-chart-3 fill-chart-3", className)} />;
  }

  return null;
}
