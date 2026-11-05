import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EContractRole,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
  EUserStatus,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { ActivityLog } from '../../src/modules/cross-cutting/entities/activity-log.entity';
import { AppUser } from '../../src/modules/identity/entities/app-user.entity';
import { Company } from '../../src/modules/identity/entities/company.entity';
import { CompanyUser } from '../../src/modules/identity/entities/company-user.entity';
import { Contract } from '../../src/modules/contract/entities/contract.entity';
import { ContractParty } from '../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractStatusHistory } from '../../src/modules/contract/entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from '../../src/modules/contract/entities/contract-workspace.entity';

export interface LifecycleFixture {
  company: Company;
  actor: CompanyUser;
  contract: Contract;
  party: ContractParty;
}

export interface RoleAssignmentFixture {
  company: Company;
  actor: CompanyUser;
  target: CompanyUser;
  contract: Contract;
  party: ContractParty;
}

export class ContractTestFactory {
  private readonly contractIds = new Set<string>();
  private readonly companyIds = new Set<string>();
  private readonly userIds = new Set<string>();
  private sequence = 0;

  constructor(private readonly dataSource: DataSource) {}

  async createLifecycleFixture(): Promise<LifecycleFixture> {
    const company = await this.createCompany();
    const actor = await this.createMember(
      company,
      ECompanyRole.FINANCE_OFFICER,
    );
    const contract = await this.createContract(company);
    const party = await this.createParty(contract, company);
    await this.createWorkspace(contract, actor, 'project');
    const assignmentRepository = this.dataSource.getRepository(
      ContractRoleAssignment,
    );
    await assignmentRepository.save(
      assignmentRepository.create({
        contractPartyId: party.id,
        companyUserId: actor.id,
        companyId: company.id,
        role: EContractRole.CONTRACTOR_PROJECT_LEAD,
        isWorkspaceAdmin: false,
        assignedAt: new Date(),
        assignedById: actor.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
    return { company, actor, contract, party };
  }

  async createRoleAssignmentFixture(): Promise<RoleAssignmentFixture> {
    const company = await this.createCompany();
    const actor = await this.createMember(company, ECompanyRole.COMPANY_ADMIN);
    const target = await this.createMember(
      company,
      ECompanyRole.FINANCE_OFFICER,
    );
    const contract = await this.createContract(company);
    const party = await this.createParty(contract, company);
    await this.createWorkspace(contract, actor, 'finance');
    return { company, actor, target, contract, party };
  }

  async createCompanyMember(
    companyRole: ECompanyRole = ECompanyRole.COMPANY_ADMIN,
  ): Promise<{ company: Company; member: CompanyUser }> {
    const company = await this.createCompany();
    const member = await this.createMember(company, companyRole);
    return { company, member };
  }

  async createAdditionalParty(
    contract: Contract,
    company: Company,
  ): Promise<ContractParty> {
    return this.createParty(contract, company);
  }

  async createAdditionalMember(
    company: Company,
    companyRole: ECompanyRole = ECompanyRole.FINANCE_OFFICER,
  ): Promise<CompanyUser> {
    return this.createMember(company, companyRole);
  }

  async createAdditionalContract(company: Company): Promise<Contract> {
    return this.createContract(company);
  }

  async createAdditionalWorkspace(
    contract: Contract,
    actor: CompanyUser,
    workspace: 'project' | 'hse' | 'finance',
  ): Promise<void> {
    await this.createWorkspace(contract, actor, workspace);
  }

  async cleanup(): Promise<void> {
    for (const id of this.contractIds) {
      await this.dataSource.getRepository(Contract).delete({ id });
    }
    for (const id of this.companyIds) {
      await this.dataSource.getRepository(Company).delete({ id });
    }
    for (const id of this.userIds) {
      await this.dataSource.getRepository(AppUser).delete({ id });
    }
    this.contractIds.clear();
    this.companyIds.clear();
    this.userIds.clear();
  }

  private uniqueSuffix(): string {
    this.sequence += 1;
    return `${Date.now()}_${this.sequence}`;
  }

  private async createCompany(): Promise<Company> {
    const suffix = this.uniqueSuffix();
    const company = await this.dataSource.getRepository(Company).save(
      this.dataSource.getRepository(Company).create({
        name: `Integration Company ${suffix}`,
        legalName: `Integration Company ${suffix} Ltd`,
        registrationNumber: `REG-${suffix}`,
        taxIdentificationNumber: `TAX-${suffix}`,
        email: `company-${suffix}@integration.contractflow.test`,
        phoneNumber: `+23480${String(this.sequence).padStart(8, '0')}`,
        website: 'https://integration.contractflow.test',
        addressLine1: '1 Test Street',
        addressLine2: '',
        city: 'Lagos',
        stateRegion: 'Lagos',
        postalCode: '100001',
        countryCode: 'NG',
        defaultCurrencyCode: ECurrencyCode.NGN,
        status: ECompanyStatus.ACTIVE,
        verifiedAt: new Date(),
      }),
    );
    this.companyIds.add(company.id);
    return company;
  }

  private async createMember(
    company: Company,
    companyRole: ECompanyRole,
  ): Promise<CompanyUser> {
    const suffix = this.uniqueSuffix();
    const user = await this.dataSource.getRepository(AppUser).save(
      this.dataSource.getRepository(AppUser).create({
        email: `user-${suffix}@integration.contractflow.test`,
        firstName: 'Integration',
        lastName: `User${this.sequence}`,
        middleName: '',
        phoneNumber: `+23481${String(this.sequence).padStart(8, '0')}`,
        passwordHash: 'integration-only-not-a-real-password-hash',
        status: EUserStatus.ACTIVE,
        isPlatformAdmin: false,
        mfaEnabled: false,
        timezone: 'Africa/Lagos',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
      }),
    );
    this.userIds.add(user.id);
    return this.dataSource.getRepository(CompanyUser).save(
      this.dataSource.getRepository(CompanyUser).create({
        companyId: company.id,
        userId: user.id,
        companyRole,
        jobTitle: 'Integration test member',
        status: ECompanyUserStatus.ACTIVE,
        joinedAt: new Date(),
        leftAt: null,
      }),
    );
  }

  private async createContract(company: Company): Promise<Contract> {
    const suffix = this.uniqueSuffix();
    const contract = await this.dataSource.getRepository(Contract).save(
      this.dataSource.getRepository(Contract).create({
        referenceNumber: `IT-${suffix}`,
        title: `Integration contract ${suffix}`,
        description: null,
        contractType: EContractType.SERVICE,
        status: EContractStatus.DRAFT,
        parentContractId: null,
        originalValueMinor: 100_000,
        currentValueMinor: 100_000,
        currencyCode: ECurrencyCode.NGN,
        retentionRateBps: 500,
        advancePaymentRateBps: null,
        paymentTermsDays: 30,
        liquidatedDamagesPerDayMinor: null,
        awardDate: new Date('2026-01-01T00:00:00.000Z'),
        startDate: new Date('2026-01-02T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
        revisedEndDate: null,
        actualCompletionDate: null,
        defectsLiabilityDays: 365,
        timezone: 'Africa/Lagos',
        createdByCompanyId: company.id,
        deletedAt: null,
        deletedByCompanyUserId: null,
      }),
    );
    this.contractIds.add(contract.id);
    return contract;
  }

  private async createParty(
    contract: Contract,
    company: Company,
  ): Promise<ContractParty> {
    return this.dataSource.getRepository(ContractParty).save(
      this.dataSource.getRepository(ContractParty).create({
        contractId: contract.id,
        companyId: company.id,
        partyType: EPartyType.CONTRACTOR,
        signatoryFirstName: null,
        signatoryLastName: null,
        signatoryTitle: null,
        signedAt: null,
      }),
    );
  }

  private async createWorkspace(
    contract: Contract,
    actor: CompanyUser,
    workspace: 'project' | 'hse' | 'finance',
  ): Promise<void> {
    await this.dataSource.getRepository(ContractWorkspaceEntity).save(
      this.dataSource.getRepository(ContractWorkspaceEntity).create({
        contractId: contract.id,
        workspace,
        createdByCompanyUserId: actor.id,
      }),
    );
  }
}

export async function countLifecycleWrites(
  dataSource: DataSource,
  contractId: string,
): Promise<{ history: number; activity: number }> {
  const [history, activity] = await Promise.all([
    dataSource.getRepository(ContractStatusHistory).count({
      where: { contractId },
    }),
    dataSource.getRepository(ActivityLog).count({
      where: { contractId },
    }),
  ]);
  return { history, activity };
}
