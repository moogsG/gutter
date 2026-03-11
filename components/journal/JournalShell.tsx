"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { OmniBar } from "@/components/journal/OmniBar";

export function JournalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem("journal-theme") || "cyberpink";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const handleNavigateDate = useCallback((date: string) => {
    window.dispatchEvent(new CustomEvent("omnibar-navigate-date", { detail: date }));
  }, []);

  // Don't show OmniBar on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <OmniBar onNavigateDate={handleNavigateDate} />
      {children}
    </div>
  );
}
