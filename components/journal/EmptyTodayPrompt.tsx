"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, ListTodo, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { MorningView } from "./MorningView";

interface EmptyTodayPromptProps {
  date: string;
  onOpenCapture: () => void;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  
  return date.toLocaleDateString("en-US", { 
    weekday: "long", 
    month: "short", 
    day: "numeric" 
  });
}

export function EmptyTodayPrompt({ date, onOpenCapture }: EmptyTodayPromptProps) {
  const dateLabel = formatDateLabel(date);
  const isToday = dateLabel === "Today";
  
  // Show morning view for today
  if (isToday) {
    return (
      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full">
        <MorningView date={date} onOpenCapture={onOpenCapture} />
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <div className="flex justify-center">
            <div className={cn(
              "p-4 rounded-full",
              "bg-gradient-to-br from-primary/10 to-primary/5",
              "border border-primary/20"
            )}>
              <Calendar className="w-8 h-8 text-primary/70" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {isToday ? "Ready to start your day?" : `Nothing logged for ${dateLabel.toLowerCase()}`}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isToday 
              ? "Open Capture to brain dump, plan your day, or just talk through what's on your mind."
              : "Open Capture to add thoughts, tasks, or notes for this day."
            }
          </p>
        </div>
        
        <div className="space-y-3">
          <Button
            onClick={onOpenCapture}
            size="lg"
            className={cn(
              "w-full gap-2",
              "bg-gradient-to-r from-primary to-primary/90",
              "hover:from-primary/90 hover:to-primary/80",
              "shadow-sm hover:shadow-md transition-all duration-200"
            )}
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Open Capture</span>
          </Button>
          
          {isToday && (
            <div className="pt-2 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                Try saying...
              </p>
              <div className="grid gap-2">
                <div className={cn(
                  "px-3 py-2 rounded-lg text-left",
                  "bg-card/60 border border-border/50",
                  "text-sm text-foreground/80"
                )}>
                  <div className="flex items-start gap-2">
                    <ListTodo className="w-4 h-4 mt-0.5 text-primary/60 shrink-0" />
                    <span>"What do I need to get done today?"</span>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-2 rounded-lg text-left",
                  "bg-card/60 border border-border/50",
                  "text-sm text-foreground/80"
                )}>
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 mt-0.5 text-primary/60 shrink-0" />
                    <span>"I need to call the dentist and finish the report"</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
