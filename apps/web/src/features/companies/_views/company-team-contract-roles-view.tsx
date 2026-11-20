"use client";

import { PageHeader } from "@/components/page-header/page-header";
import { CompanyAdminShell } from "../CompanyAdminShell";
import { CompanyContractRoles } from "../components/company-contract-roles";
import { TeamDialogs } from "../components/team-dialogs";

/** Team → Contract roles: every contract role the company's members hold. */
export function CompanyTeamContractRolesView() {
  return (
    <CompanyAdminShell>
      {(access) => (
        <div className="space-y-8">
          <PageHeader
            eyebrow="Team"
            title="Contract roles"
            description="Assign, review and revoke the contract roles your members hold. Each role opens one workspace of one contract."
          />
          <CompanyContractRoles companyId={access.company.id} />
          {/* Invitations and Invite member open here from the Team menu. */}
          <TeamDialogs companyId={access.company.id} />
        </div>
      )}
    </CompanyAdminShell>
  );
}
