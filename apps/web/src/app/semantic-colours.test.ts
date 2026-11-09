import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Colours come from the semantic tokens in globals.css (success, warning,
// info, destructive, chart-*, …), so both themes and future palette changes
// apply everywhere. Raw Tailwind palette classes bypass them (DS-06).
const SOURCE_DIR = fileURLToPath(new URL("..", import.meta.url));
const RAW_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

function sourceFiles(): string[] {
  return readdirSync(SOURCE_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(SOURCE_DIR, file));
}

describe("semantic colours", () => {
  it("uses no raw Tailwind palette colours in the web app", () => {
    const files = sourceFiles();
    // Guards against the scan silently finding nothing.
    expect(files.some((file) => file.endsWith("overview-kpi-grid.tsx"))).toBe(
      true,
    );
    const offenders = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(RAW_PALETTE)].map(
        ([match]) => `${file.slice(SOURCE_DIR.length)}: ${match}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("detects a raw palette class", () => {
    expect("text-emerald-600 bg-success".match(RAW_PALETTE)).toEqual([
      "text-emerald-600",
    ]);
  });
});
