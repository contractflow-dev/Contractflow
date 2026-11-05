import { ContractDetailsView } from "@/features/contracts/_views/contract-details-view";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <ContractDetailsView contractId={contractId} />;
}
