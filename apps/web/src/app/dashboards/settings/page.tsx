"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { CompanyProfileEditor } from "@/features/companies/CompanyProfileEditor";

export default function CompanySettingsPage() {
  return (
    <CompanyAdminShell>
      {(access) =>
        access.membership.canManageCompany ? (
          <CompanyProfileEditor
            key={access.company.id}
            company={access.company}
          />
        ) : (
          <p role="alert" className="rounded-lg border bg-card p-4 text-sm">
            Company Administrator access is required to edit company settings.
          </p>
        )
      }
    </CompanyAdminShell>
  );
}
