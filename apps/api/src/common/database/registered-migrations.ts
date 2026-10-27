import { IdentitySchemaBootstrap1749000000000 } from './migrations/1749000000000-identity-schema-bootstrap';
import { AuthCompanyMembership1760000000000 } from './migrations/1760000000000-auth-company-membership';
import { CompanyAdminWorkflows1761000000000 } from './migrations/1761000000000-company-admin-workflows';
import { CreateDomainSchema1791882600000 } from './migrations/1750000000000-create-domain-schema';
import { ContractRoleRevocationNullable1791882600001 } from './migrations/1791882600001-contract-role-revocation-nullable';
import { NullableActivityRequestContext1791882600002 } from './migrations/1791882600002-nullable-activity-request-context';
import { WorkspaceAdminRole1791882600003 } from './migrations/1791882600003-workspace-admin-role';
import { ContractRoleInvitations1791882600004 } from './migrations/1791882600004-contract-role-invitations';
import { ContractLifecycle1792862700000 } from './migrations/1792862700000-contract-lifecycle';
import { CompanyInvitationExpiryIndex1792862700001 } from './migrations/1792862700001-company-invitation-expiry-index';
import { CompanyInvitationOptionalNames1793100000000 } from './migrations/1793100000000-company-invitation-optional-names';

export const registeredMigrations = [
  IdentitySchemaBootstrap1749000000000,
  AuthCompanyMembership1760000000000,
  CompanyAdminWorkflows1761000000000,
  CreateDomainSchema1791882600000,
  ContractRoleRevocationNullable1791882600001,
  NullableActivityRequestContext1791882600002,
  WorkspaceAdminRole1791882600003,
  ContractRoleInvitations1791882600004,
  ContractLifecycle1792862700000,
  CompanyInvitationExpiryIndex1792862700001,
  CompanyInvitationOptionalNames1793100000000,
];
