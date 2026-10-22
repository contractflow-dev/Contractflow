"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { ContractsList } from "../components/contracts-screens";

export function ContractsListView() {
  return (
    <CompanyAdminShell>
      {(access) => <ContractsList companyId={access.company.id} />}
    </CompanyAdminShell>
  );
}
