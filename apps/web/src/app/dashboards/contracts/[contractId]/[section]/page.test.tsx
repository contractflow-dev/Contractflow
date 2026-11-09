import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import ContractSectionPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT ${href}`);
  },
}));

vi.mock("@/features/contracts/_views/contract-details-view", () => ({
  ContractDetailsView: () => null,
}));

function open(section: string) {
  return ContractSectionPage({
    params: Promise.resolve({ contractId: "c-1", section }),
  });
}

describe("contract section route", () => {
  it("renders a known section of the requested contract", async () => {
    const page = (await open("history")) as ReactElement<{
      contractId: string;
      section: string;
    }>;

    expect(page.props).toEqual({ contractId: "c-1", section: "history" });
  });

  it("returns not found for an unknown section", async () => {
    await expect(open("milestones")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends /overview to the contract's own URL", async () => {
    await expect(open("overview")).rejects.toThrow(
      "NEXT_REDIRECT /dashboards/contracts/c-1",
    );
  });
});
