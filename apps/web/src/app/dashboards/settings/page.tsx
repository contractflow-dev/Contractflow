"use client";

import { CompanyAdminShell } from "@/features/companies/CompanyAdminShell";
import { CompanyProfileEditor } from "@/features/companies/CompanyProfileEditor";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";

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
          <Alert>
            <AlertDescription>
              Company Administrator access is required to edit company settings.
            </AlertDescription>
          </Alert>
        )
      }
    </CompanyAdminShell>
  );
}
