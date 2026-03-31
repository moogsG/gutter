"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Command, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ["⌘", "K"], description: "Open command palette", category: "Navigation" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "Navigation" },
  { keys: ["Esc"], description: "Close modals/dialogs", category: "Navigation" },
  { keys: ["⌘", "B"], description: "Toggle sidebar", category: "Navigation" },
  
  // Journal
  { keys: ["N"], description: "New entry (when in daily log)", category: "Journal" },
  { keys: ["⌘", "Enter"], description: "Save current entry", category: "Journal" },
  { keys: ["⌘", "/"], description: "Focus entry input", category: "Journal" },
  
  // Actions
  { keys: ["T"], description: "Mark as task", category: "Actions" },
  { keys: ["M"], description: "Mark as important", category: "Actions" },
  { keys: ["D"], description: "Mark as done", category: "Actions" },
  { keys: ["X"], description: "Kill entry (archive)", category: "Actions" },
  
  // Command Palette
  { keys: ["Type 'today'"], description: "Navigate to today", category: "Command Palette" },
  { keys: ["Type 'tomorrow'"], description: "Navigate to tomorrow", category: "Command Palette" },
  { keys: ["Type 'kanban'"], description: "Open kanban board", category: "Command Palette" },
  { keys: ["Type 'collections'"], description: "Open collections", category: "Command Palette" },
  { keys: ["Type 'migrate'"], description: "Migrate unresolved entries", category: "Command Palette" },
  { keys: ["Type '/task'"], description: "Filter by tasks", category: "Command Palette" },
  { keys: ["Type '/note'"], description: "Filter by notes", category: "Command Palette" },
];

const CATEGORIES = [
  "Navigation",
  "Journal",
  "Actions",
  "Command Palette",
];

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <Keyboard className="h-6 w-6 text-primary" />
              <Dialog.Title className="text-2xl font-bold">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-muted-foreground mb-6">
            Quick reference for all keyboard shortcuts in Gutter.
          </Dialog.Description>

          <div className="space-y-8">
            {CATEGORIES.map((category) => {
              const shortcuts = SHORTCUTS.filter((s) => s.category === category);
              if (shortcuts.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-3 text-foreground/90">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, idx) => (
                      <div
                        key={`${category}-${idx}`}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
                      >
                        <span className="text-sm text-foreground/80">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIdx) => (
                            <kbd
                              key={keyIdx}
                              className={cn(
                                "inline-flex items-center justify-center rounded border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground shadow-sm",
                                key.startsWith("Type") && "px-3"
                              )}
                            >
                              {key === "⌘" && <Command className="h-3 w-3" />}
                              {key !== "⌘" && key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-semibold">?</kbd> anytime to open this dialog
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Hook to manage keyboard shortcuts modal state.
 * Add this to your root layout or main app component.
 */
export function useKeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ? key (Shift+/) opens shortcuts modal
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Only if not in an input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
