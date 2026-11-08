import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { IAdminContractMetrics } from "@contractflow/contracts-schema";
import { ContractLifecycleCard } from "./contract-lifecycle-card";

const metrics: IAdminContractMetrics = {
  total: 10,
  active: 5,
  draft: 3,
  completed: 2,
  suspended: 0,
  expiringSoon: 0,
};

describe("ContractLifecycleCard", () => {
  it("describes the status bar in text for screen readers", () => {
    const markup = renderToStaticMarkup(
      <ContractLifecycleCard contracts={metrics} />,
    );
    expect(markup).toContain('role="img"');
    expect(markup).toContain(
      'aria-label="Contract status distribution: Active 5 (50%), Draft 3 (30%), Completed 2 (20%), Suspended 0 (0%)."',
    );
  });

  it("keys each bar segment to its labelled count with a matching swatch", () => {
    const markup = renderToStaticMarkup(
      <ContractLifecycleCard contracts={metrics} />,
    );
    const expected = {
      active: "bg-success",
      draft: "bg-muted-foreground",
      completed: "bg-info",
      suspended: "bg-warning",
    };
    for (const [status, color] of Object.entries(expected)) {
      expect(markup).toMatch(
        new RegExp(`data-swatch="${status}" class="[^"]*${color}`),
      );
    }
    for (const status of ["active", "draft", "completed"]) {
      const color = expected[status as keyof typeof expected];
      expect(markup).toMatch(
        new RegExp(`data-segment="${status}"[^>]*class="${color}`),
      );
    }
  });

  it("omits empty segments but still lists their count", () => {
    const markup = renderToStaticMarkup(
      <ContractLifecycleCard contracts={metrics} />,
    );
    expect(markup).not.toContain('data-segment="suspended"');
    expect(markup).toContain('data-swatch="suspended"');
  });

  it("uses the theme's status tokens instead of fixed palette colours", () => {
    const markup = renderToStaticMarkup(
      <ContractLifecycleCard contracts={metrics} />,
    );
    expect(markup).not.toMatch(/(emerald|blue|purple|amber)-\d{3}/);
  });
});
