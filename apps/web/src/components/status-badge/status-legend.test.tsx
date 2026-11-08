import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EContractStatus,
  EInvitationStatus,
} from "@contractflow/contracts-schema";
import { StatusLegend, StatusLegendDisclosure } from "./status-legend";

const items = [
  { status: EContractStatus.DRAFT, description: "Being set up." },
  { status: EContractStatus.SUSPENDED, description: "On hold." },
  { status: EInvitationStatus.EXPIRED, description: "No longer works." },
];

describe("StatusLegend", () => {
  it("pairs each status label with its meaning in a description list", () => {
    const markup = renderToStaticMarkup(<StatusLegend items={items} />);
    expect(markup).toMatch(/^<dl[^>]*data-slot="status-legend"/);
    expect(markup.match(/<dt/g)).toHaveLength(3);
    expect(markup.match(/<dd/g)).toHaveLength(3);
    expect(markup).toContain(">Draft</span>");
    expect(markup).toContain("Being set up.");
    expect(markup).toContain(">Suspended</span>");
    expect(markup).toContain(">Expired</span>");
  });

  it("uses the same badge tones as StatusBadge", () => {
    const markup = renderToStaticMarkup(<StatusLegend items={items} />);
    // Suspended is a warning tone; expired is inactive (outline).
    expect(markup).toMatch(
      /class="[^"]*bg-warning-soft[^"]*"[^>]*data-legend-status="suspended"/,
    );
    expect(markup).toMatch(
      /class="[^"]*border-border[^"]*"[^>]*data-legend-status="expired"/,
    );
  });

  it("can sit on a card surface like the lists it explains", () => {
    // Regression: on the page background its badges lost contrast.
    const markup = renderToStaticMarkup(
      <StatusLegend items={items} className="bg-card" />,
    );
    expect(markup).toMatch(/^<dl[^>]*class="[^"]*bg-card/);
  });

  it("never marks legend badges as a record's status", () => {
    const markup = renderToStaticMarkup(<StatusLegend items={items} />);
    expect(markup).not.toContain("data-status=");
    expect(markup).toContain('data-legend-status="draft"');
  });
});

describe("StatusLegendDisclosure", () => {
  it("starts collapsed behind an accessible toggle", () => {
    const markup = renderToStaticMarkup(
      <StatusLegendDisclosure
        items={items}
        label="What do contract statuses mean?"
      />,
    );
    expect(markup).toContain("What do contract statuses mean?");
    expect(markup).toContain('aria-expanded="false"');
    const controls = markup.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(markup).toMatch(new RegExp(`id="${controls}" hidden`));
    expect(markup).not.toContain("status-legend");
  });
});
