"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { OmniBar } from "@/components/journal/OmniBar";
import { KeyboardShortcuts, useKeyboardShortcuts } from "@/components/KeyboardShortcuts";

export function JournalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } = useKeyboardShortcuts();

  useEffect(() => {
    const savedTheme = localStorage.getItem("journal-theme") || "cyberpink";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);


  // Don't show OmniBar or shortcuts on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <OmniBar 
        onOpenShortcuts={() => setShortcutsOpen(true)} 
      />
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      {children}
    </div>
  );
}
