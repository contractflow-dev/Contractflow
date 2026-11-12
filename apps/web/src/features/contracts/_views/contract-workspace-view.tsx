"use client";

import type { AssignableContractWorkspace } from "@contractflow/contracts-schema";
import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { ContractWorkspace } from "../components/contract-workspace-screens";
import type { ContractWorkspaceView as WorkspaceView } from "../contract-workspaces";

export function ContractWorkspaceView({
  contractId,
  workspace,
  view,
}: {
  contractId: string;
  workspace: AssignableContractWorkspace;
  view: WorkspaceView;
}) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <ContractWorkspace
          companyId={access.company.id}
          contractId={contractId}
          workspace={workspace}
          view={view}
        />
      )}
    </CompanyAdminShell>
  );
}
