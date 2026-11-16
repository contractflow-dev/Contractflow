// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoMark } from "@workspace/ui/components/logo";

describe("LogoMark", () => {
  it("is decorative without a title", () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelectorAll("path")).toHaveLength(3);
  });

  it("exposes an accessible name when titled", () => {
    const { getByRole } = render(<LogoMark title="ContractFlow" />);
    expect(getByRole("img", { name: "ContractFlow" })).toBeTruthy();
  });

  it.each([
    ["color", "#C24B0B", "#0A2139"],
    ["inverse", "#C24B0B", "#FFFFFF"],
    ["mono", "currentColor", "currentColor"],
  ] as const)("applies %s fills", (variant, arc, bars) => {
    const { container } = render(<LogoMark variant={variant} />);
    expect(container.querySelector("path")!.getAttribute("fill")).toBe(arc);
    expect(container.querySelector("g")!.getAttribute("fill")).toBe(bars);
  });

  it("switches bar colour with the theme in auto mode", () => {
    const { container } = render(<LogoMark variant="auto" />);
    expect(container.querySelector("g")!.getAttribute("class")).toContain(
      "dark:fill-white",
    );
  });
});
