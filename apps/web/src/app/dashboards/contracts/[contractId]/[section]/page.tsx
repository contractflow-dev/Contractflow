import { notFound, redirect } from "next/navigation";
import { ContractDetailsView } from "@/features/contracts/_views/contract-details-view";
import {
  contractSectionHref,
  parseContractSection,
} from "@/features/contracts/contract-sections";

export default async function ContractSectionPage({
  params,
}: {
  params: Promise<{ contractId: string; section: string }>;
}) {
  const { contractId, section: segment } = await params;
  const section = parseContractSection(segment);
  if (!section) notFound();
  // Overview lives at the contract's own URL.
  if (section === "overview") {
    redirect(contractSectionHref(contractId, "overview"));
  }
  return <ContractDetailsView contractId={contractId} section={section} />;
}
