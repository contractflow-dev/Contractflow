import { notFound } from "next/navigation";
import { ContractWorkspaceView } from "@/features/contracts/_views/contract-workspace-view";
import { parseContractWorkspace } from "@/features/contracts/contract-workspaces";

/** Project workspace only; the other workspaces have no milestones screen. */
export default async function ContractWorkspaceMilestonesPage({
  params,
}: {
  params: Promise<{ contractId: string; workspace: string }>;
}) {
  const { contractId, workspace: segment } = await params;
  const workspace = parseContractWorkspace(segment);
  if (workspace !== "project") notFound();
  return (
    <ContractWorkspaceView
      contractId={contractId}
      workspace={workspace}
      view="milestones"
    />
  );
}
