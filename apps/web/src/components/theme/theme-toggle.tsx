"use client";

import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      className="size-11 shrink-0 sm:w-auto sm:px-3"
    >
      {isDark ? (
        <RiSunLine className="size-4" aria-hidden="true" />
      ) : (
        <RiMoonLine className="size-4" aria-hidden="true" />
      )}
      <span className="hidden text-sm font-medium sm:inline">
        {isDark ? "Light mode" : "Dark mode"}
      </span>
    </Button>
  );
}
