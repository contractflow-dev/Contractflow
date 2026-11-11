"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { ContractDetail } from "../components/contracts-screens";
import type { ContractSection } from "../contract-sections";

export function ContractDetailsView({
  contractId,
  section,
}: {
  contractId: string;
  section: ContractSection;
}) {
  return (
    <CompanyAdminShell>
      {(access) => (
        <ContractDetail
          companyId={access.company.id}
          contractId={contractId}
          section={section}
          viewer={{
            membershipId: access.membership.id,
            companyName: access.company.name,
          }}
        />
      )}
    </CompanyAdminShell>
  );
}
