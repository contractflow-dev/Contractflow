"use client";

import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      className="inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-md border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:w-auto sm:px-3"
    >
      {isDark ? (
        <RiSunLine className="size-4" aria-hidden="true" />
      ) : (
        <RiMoonLine className="size-4" aria-hidden="true" />
      )}
      <span className="hidden text-sm font-medium sm:inline">
        {isDark ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}
