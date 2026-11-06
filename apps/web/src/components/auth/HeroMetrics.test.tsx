import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroMetrics } from "./HeroMetrics";

describe("HeroMetrics", () => {
  it("describes capabilities instead of presenting unmeasured statistics", () => {
    const markup = renderToStaticMarkup(<HeroMetrics />);

    expect(markup).toContain("Role-based access");
    expect(markup).not.toMatch(/\d+(\.\d+)?\s*(%|Days)/);
    expect(markup).not.toContain("performance");
  });
});
