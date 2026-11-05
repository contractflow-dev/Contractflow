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
      className="size-8 shrink-0"
    >
      {isDark ? (
        <RiSunLine className="size-4" aria-hidden="true" />
      ) : (
        <RiMoonLine className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
