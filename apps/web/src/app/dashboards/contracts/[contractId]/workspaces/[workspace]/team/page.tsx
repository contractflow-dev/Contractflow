import { notFound } from "next/navigation";
import { ContractWorkspaceView } from "@/features/contracts/_views/contract-workspace-view";
import { parseContractWorkspace } from "@/features/contracts/contract-workspaces";

export default async function ContractWorkspaceTeamPage({
  params,
}: {
  params: Promise<{ contractId: string; workspace: string }>;
}) {
  const { contractId, workspace: segment } = await params;
  const workspace = parseContractWorkspace(segment);
  if (!workspace) notFound();
  return (
    <ContractWorkspaceView
      contractId={contractId}
      workspace={workspace}
      view="team"
    />
  );
}
