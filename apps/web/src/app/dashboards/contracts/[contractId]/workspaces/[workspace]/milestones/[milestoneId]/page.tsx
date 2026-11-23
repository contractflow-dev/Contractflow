import { notFound } from "next/navigation";
import { ContractWorkspaceView } from "@/features/contracts/_views/contract-workspace-view";
import { parseContractWorkspace } from "@/features/contracts/contract-workspaces";

/** One milestone of the Project workspace, with its history. */
export default async function ContractWorkspaceMilestonePage({
  params,
}: {
  params: Promise<{
    contractId: string;
    workspace: string;
    milestoneId: string;
  }>;
}) {
  const { contractId, workspace: segment, milestoneId } = await params;
  const workspace = parseContractWorkspace(segment);
  if (workspace !== "project") notFound();
  return (
    <ContractWorkspaceView
      contractId={contractId}
      workspace={workspace}
      view="milestones"
      milestoneId={milestoneId}
    />
  );
}
