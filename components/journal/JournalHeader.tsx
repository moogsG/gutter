"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, Palette, Menu, Search, Sparkles, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface JournalHeaderProps {
  date: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  captureOpen?: boolean;
  onCaptureChange?: (open: boolean) => void;
  showCapture?: boolean;
  showDateNav?: boolean;
  title?: string;
  subtitle?: string;
}

const themes = [
  { id: "cyberpink", label: "Cyberpink", preview: "bg-[#ff3d9a]" },
  { id: "tokyo-night", label: "Tokyo Night", preview: "bg-[#7aa2f7]" },
  { id: "rosepine", label: "Rosé Pine", preview: "bg-[#ebbcba]" },
  { id: "catppuccin", label: "Catppuccin", preview: "bg-[#cba6f7]" },
  { id: "dracula", label: "Dracula", preview: "bg-[#bd93f9]" },
];

const journalLinks = [
  { href: "/month", label: "Monthly" },
  { href: "/future", label: "Future" },
  { href: "/collections", label: "Collections" },
  { href: "/migrate", label: "Migration" },
];

const moreGroups = [
  { label: "Daily loop", links: [{ href: "/reset", label: "Close today" }, { href: "/tomorrow", label: "Open tomorrow" }] },
  { label: "Review tools", links: [{ href: "/wip", label: "WIP" }, { href: "/backlog", label: "Backlog" }, { href: "/radar", label: "Radar" }, { href: "/status", label: "Status" }, { href: "/projects", label: "Projects" }, { href: "/truth", label: "Truth" }] },
  { label: "Calendar & life", links: [{ href: "/meetings", label: "Meetings" }, { href: "/health-cut", label: "Health" }, { href: "/habits", label: "Habits" }, { href: "/meal-plan", label: "Meals" }, { href: "/school", label: "School" }, { href: "/date-night", label: "Date Night" }, { href: "/chores", label: "Chores" }] },
  { label: "More", links: [{ href: "/linkedin", label: "LinkedIn" }, { href: "/sessions", label: "Sessions" }] },
];

export function JournalHeader({
  date,
  onPrevDay,
  onNextDay,
  onToday,
  captureOpen,
  onCaptureChange,
  showCapture = true,
  showDateNav = true,
  title,
  subtitle,
}: JournalHeaderProps) {
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
          {showDateNav ? (
            <>
              <div className="flex items-center gap-1">
                <Button aria-label="Previous day" variant="ghost" size="sm" onClick={onPrevDay} className="w-8 h-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button aria-label="Go to today" variant="outline" size="sm" onClick={onToday} className="h-8 px-2 sm:px-3">
                  <Calendar className="w-3.5 h-3.5 sm:mr-2" />
                  <span className="hidden sm:inline">Today</span>
                </Button>
                <Button aria-label="Next day" variant="ghost" size="sm" onClick={onNextDay} className="w-8 h-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <h1 className="text-sm font-semibold text-foreground sm:hidden">{formattedDate}</h1>
              <h1 className="hidden sm:block text-lg font-semibold text-foreground">{formattedDateLong}</h1>
            </>
          ) : (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground sm:text-lg">{title || "Journal"}</h1>
              {subtitle ? <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{subtitle}</p> : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden lg:flex gap-1">
            <Button asChild variant={pathname === "/" ? "default" : "ghost"} size="sm" className="h-8">
              <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Today</Link>
            </Button>
            <Button asChild variant={pathname === "/kanban" ? "default" : "ghost"} size="sm" className="h-8">
              <Link href="/kanban" aria-current={pathname === "/kanban" ? "page" : undefined}>Review</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={journalLinks.some((link) => link.href === pathname) ? "default" : "ghost"} size="sm" className="h-8">
                  Journal <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Journal horizons</DropdownMenuLabel>
                {journalLinks.map((link) => <DropdownMenuItem key={link.href} asChild><Link href={link.href}>{link.label}</Link></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={moreGroups.some((group) => group.links.some((link) => link.href === pathname)) ? "default" : "ghost"} size="sm" className="h-8">
                  More <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[75vh] w-56 overflow-y-auto">
                {moreGroups.map((group, index) => <div key={group.label}>{index > 0 ? <DropdownMenuSeparator /> : null}<DropdownMenuLabel>{group.label}</DropdownMenuLabel>{group.links.map((link) => <DropdownMenuItem key={link.href} asChild><Link href={link.href}>{link.label}</Link></DropdownMenuItem>)}</div>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile nav dropdown */}
          <DropdownMenu open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Open navigation" variant="ghost" size="sm" className="lg:hidden w-8 h-8 p-0">
                <Menu className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[75vh] w-56 overflow-y-auto">
              <DropdownMenuLabel>Navigate</DropdownMenuLabel>
              {[{ href: "/", label: "Today" }, { href: "/kanban", label: "Review" }].map((link) => (
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
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Journal horizons</DropdownMenuLabel>
              {journalLinks.map((link) => <DropdownMenuItem key={link.href} asChild><Link href={link.href} onClick={() => setMobileNavOpen(false)}>{link.label}</Link></DropdownMenuItem>)}
              {moreGroups.map((group) => <div key={group.label}><DropdownMenuSeparator /><DropdownMenuLabel>{group.label}</DropdownMenuLabel>{group.links.map((link) => <DropdownMenuItem key={link.href} asChild><Link href={link.href} onClick={() => setMobileNavOpen(false)}>{link.label}</Link></DropdownMenuItem>)}</div>)}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/settings/morning-view"
                  className={cn(
                    "w-full flex items-center gap-2",
                    pathname === "/settings/morning-view" && "bg-primary/10 text-primary font-medium"
                  )}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Settings2 className="w-4 h-4" />
                  Today Focus
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Capture button */}
          {showCapture ? (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 px-3 gap-2",
                "bg-gradient-to-r from-primary/10 to-primary/5",
                "border-primary/20 hover:border-primary/30",
                "hover:from-primary/15 hover:to-primary/10",
                "transition-all duration-200"
              )}
              onClick={() => onCaptureChange?.(true)}
              aria-label="Capture entry"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Capture</span>
            </Button>
          ) : null}

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
            aria-label="Search and commands"
          >
            <Search className="w-3.5 h-3.5" />
            <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </Button>

          {/* Theme picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Choose theme" variant="ghost" size="sm" className="w-8 h-8 p-0">
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
