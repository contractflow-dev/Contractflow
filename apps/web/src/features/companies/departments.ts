import { ECompanyDepartment } from "@contractflow/contracts-schema";

/**
 * The Company Administrator's department pages. Each looks at one contract
 * workspace across the company's contracts; "Contractor" and "Client
 * Project Mgmt" both open the Project page with a party-type filter.
 */
export const DEPARTMENTS: Record<
  ECompanyDepartment,
  { label: string; description: string }
> = {
  [ECompanyDepartment.PROJECT]: {
    label: "Project",
    description:
      "Contracts with a Project workspace: who from your company staffs it, and what is holding each contract up.",
  },
  [ECompanyDepartment.HSE]: {
    label: "HSE",
    description:
      "Contracts with an HSE workspace: who from your company staffs it, and what is holding each contract up.",
  },
  [ECompanyDepartment.FINANCE]: {
    label: "Finance",
    description:
      "Contracts with a Finance workspace: who from your company staffs it, and what is holding each contract up.",
  },
};

/** The department named by a URL segment, or null for anything else. */
export function parseDepartment(segment: string): ECompanyDepartment | null {
  return (Object.values(ECompanyDepartment) as string[]).includes(segment)
    ? (segment as ECompanyDepartment)
    : null;
}

/** Team → Contract roles, filtered to the department's workspace (D1). */
export function departmentStaffingHref(department: ECompanyDepartment): string {
  return `/dashboards/team?workspace=${department}#contract-roles`;
}

/** A contract's Roles section, opened on one workspace. */
export function contractRolesHref(
  contractId: string,
  department: ECompanyDepartment,
): string {
  return `/dashboards/contracts/${encodeURIComponent(contractId)}/roles?workspace=${department}`;
}
