"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ThemeMode = "jynx" | "work";

interface ThemeContextType {
  mode: ThemeMode;
  toggleMode: () => void;
  t: (jynxText: string, workText: string) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage immediately to prevent flash
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("gutter-theme-mode") as ThemeMode;
      if (saved === "work" || saved === "jynx") {
        return saved;
      }
    }
    return "jynx";
  });

  // Apply theme class to body whenever mode changes
  useEffect(() => {
    document.body.className = `theme-${mode} bg-slate-900 text-text-primary antialiased`;
  }, [mode]);

  // Save to localStorage when changed
  const toggleMode = () => {
    setMode((current) => {
      const next = current === "jynx" ? "work" : "jynx";
      localStorage.setItem("gutter-theme-mode", next);
      return next;
    });
  };

  // Text helper: returns jynxText in jynx mode, workText in work mode
  const t = (jynxText: string, workText: string) => {
    return mode === "jynx" ? jynxText : workText;
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
