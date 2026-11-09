"use client";

import { ECompanyRole } from "@contractflow/contracts-schema";
import { useGetCompanyMembershipQuery } from "@/services/companiesApi";
import {
  useGetContractLifecyclePermissionsQuery,
  useGetContractRoleManagementPermissionsQuery,
  type Contract,
} from "@/services/contractApi";
import type { RestrictedContractSection } from "../contract-sections";

/**
 * Whether the user can use each restricted contract section, using the same
 * server permission queries as the section components themselves (so the
 * results come from the shared cache). `undefined` means not known yet.
 *
 * This only decides which tabs to show. The API enforces access.
 */
export function useContractSectionAccess({
  companyId,
  contractId,
  contract,
}: {
  companyId: string;
  contractId: string;
  /** The loaded contract, or undefined while it loads. */
  contract: Contract | undefined;
}): Record<RestrictedContractSection, boolean | undefined> {
  const query = { companyId, contractId };
  // The roles section opens on the project workspace, so it asks about that.
  const roles = useGetContractRoleManagementPermissionsQuery({
    ...query,
    workspace: "project",
  });
  const lifecycle = useGetContractLifecyclePermissionsQuery(query);
  const membership = useGetCompanyMembershipQuery({ companyId });

  return {
    roles: settled(roles, roles.data?.canManage === true),
    sites: settled(lifecycle, lifecycle.data?.canManage === true),
    // Matches ContractSignatoryManagement: company administrators record
    // their own company's signatory on contracts that aren't archived.
    signatories: contract
      ? settled(
          membership,
          membership.data?.membership.companyRole ===
            ECompanyRole.COMPANY_ADMIN && !contract.deletedAt,
        )
      : undefined,
  };
}

function settled(
  query: { isLoading: boolean; isError: boolean },
  allowed: boolean,
): boolean | undefined {
  if (query.isLoading) return undefined;
  return query.isError ? false : allowed;
}
