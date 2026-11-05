"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { ContractDetail } from "../components/contracts-screens";

export function ContractDetailsView({
  contractId,
}: {
  contractId: string;
}) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <ContractDetail companyId={access.company.id} contractId={contractId} />
      )}
    </CompanyAdminShell>
  );
}
