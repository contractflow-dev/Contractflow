import { CompanyContractDetailPage } from "@/features/company-dashboard/company-contracts-page";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <CompanyContractDetailPage contractId={contractId} />;
}
