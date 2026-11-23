"use client";

import type { AssignableContractWorkspace } from "@contractflow/contracts-schema";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { ContractWorkspace } from "../components/contract-workspace-screens";
import type { ContractWorkspaceView as WorkspaceView } from "../contract-workspaces";

export function ContractWorkspaceView({
  contractId,
  workspace,
  view,
  milestoneId,
}: {
  contractId: string;
  workspace: AssignableContractWorkspace;
  view: WorkspaceView;
  /** One milestone's page, within the milestones view. */
  milestoneId?: string;
}) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <ContractWorkspace
          companyId={access.company.id}
          contractId={contractId}
          workspace={workspace}
          view={view}
          milestoneId={milestoneId}
          viewer={{
            membershipId: access.membership.id,
            companyName: access.company.name,
          }}
        />
      )}
    </CompanyAdminShell>
  );
}
