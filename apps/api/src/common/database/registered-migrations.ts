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
import { CompanyEmailVerification1793200000000 } from './migrations/1793200000000-company-email-verification';
import { DocumentObjectStorage1793300000000 } from './migrations/1793300000000-document-object-storage';
import { PasswordResetToken1793400000000 } from './migrations/1793400000000-password-reset-token';
import { CompanyLevelDocuments1793500000000 } from './migrations/1793500000000-company-level-documents';
import { CompanyRoleAssignmentIndex1793500000001 } from './migrations/1793500000001-company-role-assignment-index';
import { CompanyMembershipRoles1793600000000 } from './migrations/1793600000000-company-membership-roles';

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
  CompanyEmailVerification1793200000000,
  DocumentObjectStorage1793300000000,
  PasswordResetToken1793400000000,
  CompanyLevelDocuments1793500000000,
  CompanyRoleAssignmentIndex1793500000001,
  CompanyMembershipRoles1793600000000,
];
