import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EContractStatus } from "@contractflow/contracts-schema";
import {
  ParentContractLine,
  SubcontractNote,
  SubcontractsCard,
} from "./related-contracts";

const main = {
  id: "main-1",
  referenceNumber: "MAIN-001",
  title: "Main works",
  status: EContractStatus.ACTIVE,
};

describe("related contracts", () => {
  it("names a listed subcontract's main contract, or only that it is one", () => {
    const note = (
      parentContract: typeof main | null,
      parentContractId: string | null,
    ) =>
      renderToStaticMarkup(
        <SubcontractNote contract={{ parentContractId, parentContract }} />,
      );
    expect(note(main, "main-1")).toBe(" · Subcontract of MAIN-001");
    expect(note(null, "main-1")).toBe(" · Subcontract");
    expect(note(null, null)).toBe("");
  });

  it("links a subcontract's main contract when the reader may open it", () => {
    expect(
      renderToStaticMarkup(
        <ParentContractLine parentContractId="main-1" parentContract={main} />,
      ),
    ).toContain('href="/dashboards/contracts/main-1"');
    const hidden = renderToStaticMarkup(
      <ParentContractLine parentContractId="main-1" parentContract={null} />,
    );
    expect(hidden).toContain("a main contract your company is not a party to");
    expect(hidden).not.toContain("href=");
  });

  it("lists visible subcontracts with their status, and nothing when there are none", () => {
    const markup = renderToStaticMarkup(
      <SubcontractsCard
        contractId="main-1"
        subcontracts={[
          { ...main, id: "sub-1", referenceNumber: "SUB-001", title: "Piling" },
        ]}
      />,
    );
    expect(markup).toContain(">Subcontracts</h2>");
    expect(markup).toContain('href="/dashboards/contracts/sub-1"');
    expect(markup).toContain("SUB-001 · Piling");
    expect(markup).toContain("Active");
    expect(
      renderToStaticMarkup(
        <SubcontractsCard contractId="main-1" subcontracts={[]} />,
      ),
    ).toBe("");
  });

  it("offers the Contractor Project Lead a new subcontract, even before the first", () => {
    const markup = renderToStaticMarkup(
      <SubcontractsCard contractId="main-1" subcontracts={[]} canCreate />,
    );
    expect(markup).toContain("No subcontracts yet.");
    expect(markup).toContain('href="/dashboards/contracts/new?parent=main-1"');
    expect(markup).toContain("New subcontract");
    // Without the permission (for example the client), nothing is offered.
    expect(
      renderToStaticMarkup(
        <SubcontractsCard contractId="main-1" subcontracts={[]} />,
      ),
    ).toBe("");
  });
});
