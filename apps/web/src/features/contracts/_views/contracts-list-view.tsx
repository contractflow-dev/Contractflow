"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { ContractsList } from "../components/contracts-screens";

export function ContractsListView() {
  return (
    <CompanyAdminShell>
      {(access) => (
        <ContractsList
          companyId={access.company.id}
          canViewArchived={access.membership.canManageCompany}
          canCreateContracts={access.membership.canManageCompany}
        />
      )}
    </CompanyAdminShell>
  );
}
