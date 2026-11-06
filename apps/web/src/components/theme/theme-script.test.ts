import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, themeInitScript } from "./theme-script";

function runScript({
  stored,
  systemDark,
}: {
  stored: string | null;
  systemDark: boolean;
}) {
  const classes = new Set<string>();
  const documentElement = {
    classList: {
      toggle: (name: string, force: boolean) => {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
    style: { colorScheme: "" },
  };
  const getItem = vi.fn(() => stored);
  vi.stubGlobal("document", { documentElement });
  vi.stubGlobal("localStorage", { getItem });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: systemDark }),
  });

  new Function(themeInitScript)();

  return { dark: classes.has("dark"), documentElement, getItem };
}

describe("theme init script", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies a saved dark theme before hydration", () => {
    const result = runScript({ stored: "dark", systemDark: false });

    expect(result.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(result.dark).toBe(true);
    expect(result.documentElement.style.colorScheme).toBe("dark");
  });

  it("keeps a saved light theme even when the system prefers dark", () => {
    const result = runScript({ stored: "light", systemDark: true });

    expect(result.dark).toBe(false);
    expect(result.documentElement.style.colorScheme).toBe("light");
  });

  it("falls back to the system theme when nothing valid is saved", () => {
    expect(runScript({ stored: null, systemDark: true }).dark).toBe(true);
    expect(runScript({ stored: "purple", systemDark: false }).dark).toBe(false);
  });

  it("does not throw when storage is unavailable", () => {
    vi.stubGlobal("document", { documentElement: {} });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() => new Function(themeInitScript)()).not.toThrow();
  });
});
