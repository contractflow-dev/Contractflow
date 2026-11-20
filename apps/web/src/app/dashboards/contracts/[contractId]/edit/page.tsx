import { EditContractView } from "@/features/contracts/_views/edit-contract-view";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <EditContractView contractId={contractId} />;
}
