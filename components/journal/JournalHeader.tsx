"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, Calendar, Palette, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface JournalHeaderProps {
  date: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}

const themes = [
  { id: "cyberpink", label: "Cyberpink", preview: "bg-[#ff3d9a]" },
  { id: "tokyo-night", label: "Tokyo Night", preview: "bg-[#7aa2f7]" },
  { id: "rosepine", label: "Rosé Pine", preview: "bg-[#ebbcba]" },
  { id: "catppuccin", label: "Catppuccin", preview: "bg-[#cba6f7]" },
  { id: "dracula", label: "Dracula", preview: "bg-[#bd93f9]" },
];

const navLinks = [
  { href: "/", label: "Daily" },
  { href: "/month", label: "Monthly" },
  { href: "/future", label: "Future" },
  { href: "/collections", label: "Collections" },
];

export function JournalHeader({ date, onPrevDay, onNextDay, onToday }: JournalHeaderProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const setTheme = (theme: string) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("journal-theme", theme);
  };

  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const formattedDateLong = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      {/* Top row: date nav + actions */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onPrevDay} className="w-8 h-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday} className="h-8 px-2 sm:px-3">
              <Calendar className="w-3.5 h-3.5 sm:mr-2" />
              <span className="hidden sm:inline">Today</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onNextDay} className="w-8 h-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {/* Short date on mobile, long on desktop */}
          <h1 className="text-sm font-semibold text-foreground sm:hidden">{formattedDate}</h1>
          <h1 className="hidden sm:block text-lg font-semibold text-foreground">{formattedDateLong}</h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={pathname === link.href ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Mobile nav dropdown */}
          <DropdownMenu open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden w-8 h-8 p-0">
                <Menu className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {navLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    className={cn(
                      "w-full",
                      pathname === link.href && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Omni bar trigger */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex items-center gap-2 h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true })
              );
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </Button>

          {/* Theme picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                <Palette className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {themes.map((theme) => (
                <DropdownMenuItem key={theme.id} onClick={() => setTheme(theme.id)}>
                  <span className={cn("w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10", theme.preview)} />
                  <span>{theme.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
