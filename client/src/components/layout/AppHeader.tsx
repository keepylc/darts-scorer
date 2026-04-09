import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark(!isDark)}
      className="h-9 w-9"
      aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function DartboardLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      fill="none"
      aria-label="Логотип Darts"
    >
      {/* Outer ring */}
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" />
      {/* Middle ring */}
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner ring */}
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.5" />
      {/* Bull */}
      <circle cx="16" cy="16" r="2" fill="hsl(var(--primary))" />
      {/* Cross hairs */}
      <line x1="16" y1="0.5" x2="16" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="16" y1="27" x2="16" y2="31.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="0.5" y1="16" x2="5" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="27" y1="16" x2="31.5" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

export default function AppHeader() {
  const [location] = useLocation();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <DartboardLogo />
            <span className="font-semibold text-lg tracking-tight">Darts</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                size="sm"
                className="text-sm"
              >
                Главная
              </Button>
            </Link>
            <Link href="/rules">
              <Button
                variant={location === "/rules" ? "secondary" : "ghost"}
                size="sm"
                className="text-sm"
              >
                Правила
              </Button>
            </Link>
          </nav>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
