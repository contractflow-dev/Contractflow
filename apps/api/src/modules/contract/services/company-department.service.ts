import { Inject, Injectable } from '@nestjs/common';
import {
  EDepartmentContractSort,
  type DepartmentContract,
  type DepartmentContractsResponse,
  type DepartmentWaitingOn,
  type ECompanyDepartment,
  type EContractStatus,
  type EPartyType,
} from '@contractflow/contracts-schema';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import {
  COMPANY_DEPARTMENT_PERSISTENCE,
  type ICompanyDepartmentPersistence,
  type IDepartmentContractRecord,
} from '../interfaces/company-department-persistence.interface';
import { ContractAccessService } from './contract-access.service';
import { WORKSPACE_ROLES } from './contract-workspace';
import {
  daysSince,
  evaluateDepartmentBlockers,
  lastMovementAt,
} from './department-blockers';

/** Avatars shown on a row; the count covers the rest. */
const MEMBER_PREVIEW = 4;

export interface DepartmentContractsListQuery extends IPageQuery {
  search?: string;
  status?: EContractStatus;
  partyType?: EPartyType;
  waitingOn?: DepartmentWaitingOn;
  sort?: EDepartmentContractSort;
  includeArchived?: boolean;
}

type Row = DepartmentContract;

const byWaitingThenStalled = (a: Row, b: Row) =>
  Number(waitsOnUs(b)) - Number(waitsOnUs(a)) ||
  b.daysSinceMovement - a.daysSinceMovement ||
  a.referenceNumber.localeCompare(b.referenceNumber);

const SORTS: Record<EDepartmentContractSort, (a: Row, b: Row) => number> = {
  [EDepartmentContractSort.WAITING_ON_US]: byWaitingThenStalled,
  [EDepartmentContractSort.LONGEST_STALLED]: (a, b) =>
    b.daysSinceMovement - a.daysSinceMovement ||
    a.referenceNumber.localeCompare(b.referenceNumber),
  [EDepartmentContractSort.REFERENCE]: (a, b) =>
    a.referenceNumber.localeCompare(b.referenceNumber),
  [EDepartmentContractSort.TITLE]: (a, b) =>
    a.title.localeCompare(b.title) ||
    a.referenceNumber.localeCompare(b.referenceNumber),
};

function waitsOnUs(row: Row): boolean {
  return row.primaryBlocker?.holder.myCompany === true;
}

function waitsOnOthers(row: Row): boolean {
  return (
    row.primaryBlocker !== null &&
    !row.primaryBlocker.holder.myCompany &&
    row.primaryBlocker.holder.companyId !== null
  );
}

/**
 * The Company Administrator's department pages: every contract where the
 * department's workspace exists and the company is a party, who from the
 * company staffs it, and what holds its progress. Read-only oversight: it
 * grants no workspace access and shows nobody from another company.
 *
 * Contracts are evaluated, filtered and ordered here, then paged, because
 * the order depends on the blockers. A company's contracts in one workspace
 * are few enough (hundreds) for that.
 */
@Injectable()
export class CompanyDepartmentService {
  constructor(
    private readonly access: ContractAccessService,
    @Inject(COMPANY_DEPARTMENT_PERSISTENCE)
    private readonly persistence: ICompanyDepartmentPersistence,
  ) {}

  async listContracts(
    userId: string,
    companyId: string,
    department: ECompanyDepartment,
    query: DepartmentContractsListQuery,
    now: Date = new Date(),
  ): Promise<DepartmentContractsResponse> {
    const scope = await this.access.authorizeCompanyOversight(
      userId,
      companyId,
    );
    const records = await this.persistence.listContracts(
      scope,
      department,
      WORKSPACE_ROLES[department],
      { includeArchived: query.includeArchived === true, now },
    );
    const rows = records.map((record) =>
      this.toRow(record, scope.companyId, now),
    );

    const current = rows.filter((row) => !row.archived);
    const summary = {
      contractCount: current.length,
      memberCount: new Set(
        records
          .filter((record) => !record.archived)
          .flatMap((record) => record.members.map((m) => m.companyUserId)),
      ).size,
      waitingOnMyCompanyCount: current.filter(waitsOnUs).length,
      waitingOnOtherCompaniesCount: current.filter(waitsOnOthers).length,
    };

    const search = query.search?.trim().toLowerCase();
    const filtered = rows
      .filter(
        (row) =>
          !search ||
          row.title.toLowerCase().includes(search) ||
          row.referenceNumber.toLowerCase().includes(search),
      )
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => !query.partyType || row.partyType === query.partyType)
      .filter(
        (row) =>
          !query.waitingOn ||
          (query.waitingOn === 'us' ? waitsOnUs(row) : waitsOnOthers(row)),
      )
      .sort(SORTS[query.sort ?? EDepartmentContractSort.WAITING_ON_US]);

    const offset = pageOffset(query);
    const page = toPaginatedResponse(
      {
        items: filtered.slice(offset, offset + query.limit),
        total: filtered.length,
      },
      query,
    );
    return { ...page, summary };
  }

  private toRow(
    record: IDepartmentContractRecord,
    companyId: string,
    now: Date,
  ): Row {
    const blockers = evaluateDepartmentBlockers({ record, companyId, now });
    const moved = lastMovementAt(record);
    const people = [...record.members].sort(
      (a, b) =>
        Number(b.isWorkspaceAdmin) - Number(a.isWorkspaceAdmin) ||
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );
    const person = ({
      companyUserId,
      firstName,
      lastName,
    }: (typeof people)[number]) => ({ companyUserId, firstName, lastName });
    return {
      contractId: record.contractId,
      referenceNumber: record.referenceNumber,
      title: record.title,
      status: record.status,
      archived: record.archived,
      partyType: record.partyType,
      memberCount: people.length,
      members: people.slice(0, MEMBER_PREVIEW).map(person),
      workspaceAdmins: people.filter((m) => m.isWorkspaceAdmin).map(person),
      primaryBlocker: blockers[0] ?? null,
      otherBlockerCount: Math.max(0, blockers.length - 1),
      lastMovementAt: moved.toISOString(),
      daysSinceMovement: daysSince(moved, now),
      hasWorkspaceRole: record.requesterHasRole,
    };
  }
}
