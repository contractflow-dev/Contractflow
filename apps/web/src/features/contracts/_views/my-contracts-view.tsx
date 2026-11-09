"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { MyContracts } from "../components/my-contracts";

export function MyContractsView() {
  return (
    <CompanyAdminShell>
      {(access) => (
        <MyContracts
          companyId={access.company.id}
          companyName={access.company.name}
        />
      )}
    </CompanyAdminShell>
  );
}
