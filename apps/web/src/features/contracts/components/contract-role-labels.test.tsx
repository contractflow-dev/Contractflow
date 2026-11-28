import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EContractorContractRole } from "@contractflow/contracts-schema";
import {
  ContractRoleLabels,
  useContractRoleLabel,
  useContractSideLabel,
} from "./contract-role-labels";

function Probe() {
  const roleLabel = useContractRoleLabel();
  const sideLabel = useContractSideLabel();
  return (
    <p>
      {roleLabel(EContractorContractRole.CONTRACTOR_PROJECT_LEAD)} /{" "}
      {sideLabel("client")}
    </p>
  );
}

describe("ContractRoleLabels", () => {
  it("names roles and sides the subcontract way inside a subcontract", () => {
    expect(
      renderToStaticMarkup(
        <ContractRoleLabels isSubcontract>
          <Probe />
        </ContractRoleLabels>,
      ),
    ).toContain("Subcontractor Project Lead / main contractor");
  });

  it("keeps the main contract wording otherwise", () => {
    expect(renderToStaticMarkup(<Probe />)).toContain(
      "Contractor Project Lead / client",
    );
    expect(
      renderToStaticMarkup(
        <ContractRoleLabels isSubcontract={false}>
          <Probe />
        </ContractRoleLabels>,
      ),
    ).toContain("Contractor Project Lead / client");
  });
});
