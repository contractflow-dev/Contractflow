"use client";

import { PageHeader } from "@/components/page-header/page-header";
import { CompanyDocuments } from "@/features/contracts/components/contract-documents";
import { CompanyAdminShell } from "../CompanyAdminShell";

export function CompanyDocumentsView() {
  return (
    <CompanyAdminShell>
      {(access) => (
        <div className="space-y-6">
          <PageHeader
            eyebrow={access.company.name}
            title="Company documents"
            description="Documents that belong to your company, kept private from the companies you work with."
          />
          <CompanyDocuments
            companyId={access.company.id}
            canManage={access.membership.canManageCompany}
          />
        </div>
      )}
    </CompanyAdminShell>
  );
}
