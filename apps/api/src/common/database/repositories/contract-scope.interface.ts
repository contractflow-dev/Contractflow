/**
 * Values must come from a validated request context, never from client input.
 * `companyId`, when present, must be a party to `contractId`.
 */
export interface IContractScope {
  contractId: string;
  companyId?: string;
}

export interface IContractCompanyScope extends IContractScope {
  companyId: string;
}

export interface IContractScopedEntity {
  id: string;
  contractId: string;
}
