import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the WCAG AA (4.5:1) colour fixes in globals.css by computing the
// ratios from the oklch tokens themselves, so a token edit can't regress them.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

type Rgb = [number, number, number];

function themeTokens(selector: ":root" | ".dark"): Record<string, Rgb> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const tokens: Record<string, Rgb> = {};
  for (const [, name, l, c, h] of block.matchAll(
    /--([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);/g,
  )) {
    tokens[name!] = oklchToSrgb(Number(l), Number(c), Number(h));
  }
  return tokens;
}

function oklchToSrgb(lightness: number, chroma: number, hue: number): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((channel) => Math.min(1, Math.max(0, channel))) as Rgb;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: Rgb, second: Rgb): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (x, y) => y - x,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

/** `color` at `alpha` over `backdrop`, as Tailwind's `bg-brand/90` renders. */
function over(color: Rgb, backdrop: Rgb, alpha: number): Rgb {
  const encode = (value: number) =>
    value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  const decode = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return color.map((channel, index) =>
    decode(encode(channel) * alpha + encode(backdrop[index]!) * (1 - alpha)),
  ) as Rgb;
}

const AA = 4.5;

describe.each([":root", ".dark"] as const)("%s colour tokens", (selector) => {
  const t = themeTokens(selector);

  it.each(["brand", "primary"])(
    "%s is readable as text on the page and on cards",
    (token) => {
      expect(contrast(t[token]!, t.background!)).toBeGreaterThanOrEqual(AA);
      expect(contrast(t[token]!, t.card!)).toBeGreaterThanOrEqual(AA);
    },
  );

  it("keeps button text readable on primary and brand fills", () => {
    expect(
      contrast(t["primary-foreground"]!, t.primary!),
    ).toBeGreaterThanOrEqual(AA);
    expect(contrast(t["primary-foreground"]!, t.brand!)).toBeGreaterThanOrEqual(
      AA,
    );
  });

  it("keeps brand fills readable in their 90% hover state", () => {
    const hover = over(t.brand!, t.background!, 0.9);
    expect(contrast(t["primary-foreground"]!, hover)).toBeGreaterThanOrEqual(
      AA,
    );
  });
});
