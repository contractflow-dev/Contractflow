import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  RequestMethod,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { CompanyContextGuard } from '../common/guards/company-context.guard';
import { ContractContextGuard } from '../common/guards/contract-context.guard';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { ComplianceController } from './compliance/controllers/compliance-controller';
import { ComplianceService } from './compliance/services/compliance-service';
import { DeliveryController } from './delivery/controllers/delivery.controller';
import { DeliveryService } from './delivery/services/delivery.service';
import { FinancialController } from './financial/controllers/financial.controller';
import { FinancialService } from './financial/services/financial.service';
import { HseController } from './hse/controllers/hse.controller';
import { HseService } from './hse/services/hse.service';
import { SiteOperationsController } from './site-operations/controllers/site-operations.controller';
import { SiteOperationsService } from './site-operations/services/site-operations.service';

/*
 * The read endpoints of the contract workspaces (delivery, financial, HSE,
 * site operations, compliance), exercised through the real controllers,
 * services, readers and response mappers. Only the access service and the
 * repositories are replaced. Access rules themselves are covered in depth by
 * contract-access.service.spec.ts; the guards by their own specs.
 */

const COMPANY = '01JCQMPANY00000000000000AA';
const CONTRACT = '01JC0NTRACT000000000000000';
const OTHER_CONTRACT = '01JZZZZZZZZZZZZZZZZZZZZZZZ';
const USER = { id: '01JUSER0000000000000000000' };
const created = new Date('2026-03-01T08:00:00.000Z');
const updated = new Date('2026-03-02T09:30:00.000Z');

/** Fields every stored row has besides its own columns. */
const base = {
  id: 'row-1',
  contractId: CONTRACT,
  createdAt: created,
  updatedAt: updated,
};

/**
 * Relations and internal columns that a query could attach to an entity and
 * that no response may carry.
 */
const leaks = {
  contract: { id: CONTRACT, title: 'Pipeline works' },
  companyUser: { id: 'cu-1', user: { email: 'private@example.com' } },
};

interface Resource {
  name: string;
  controller:
    'delivery' | 'financial' | 'hse' | 'siteOperations' | 'compliance';
  path: string;
  list: string;
  get: string;
  workspace: 'project' | 'finance' | 'hse' | 'general';
  repository: string;
  row: Record<string, unknown>;
  keys: string[];
}

const resources: Resource[] = [
  {
    name: 'contract stages',
    controller: 'delivery',
    path: 'contract/stages',
    list: 'listStages',
    get: 'getStage',
    workspace: 'project',
    repository: 'stages',
    row: {
      ...base,
      name: 'Mobilisation',
      description: 'Site set-up',
      sequence: '1',
      status: 'in_progress',
      weightBps: 2500,
      plannedStartDate: '2026-03-01',
      plannedEndDate: '2026-04-01',
      actualStartDate: '2026-03-02',
      actualEndDate: '',
    },
    keys: [
      'id',
      'contractId',
      'name',
      'description',
      'sequence',
      'status',
      'weightBps',
      'plannedStartDate',
      'plannedEndDate',
      'actualStartDate',
      'actualEndDate',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'milestones',
    controller: 'delivery',
    path: 'contract/milestones',
    list: 'listMilestones',
    get: 'getMilestone',
    workspace: 'project',
    repository: 'milestones',
    row: {
      ...base,
      contractStageId: 'stage-1',
      title: 'Foundations',
      description: 'Pour foundations',
      sequence: 1,
      status: 'submitted',
      progressBps: 10000,
      weightBps: 2000,
      isPaymentMilestone: true,
      amountMinor: '9007199254740993',
      currencyCode: 'NGN',
      dueDate: '2026-05-01',
      revisedDueDate: '',
      completedDate: '2026-04-28',
      submittedAt: new Date('2026-04-29T10:00:00Z'),
      submittedById: 'cu-1',
      approvedAt: null,
      approvedById: '',
      rejectionReason: '',
    },
    keys: [
      'id',
      'contractId',
      'contractStageId',
      'title',
      'description',
      'sequence',
      'status',
      'progressBps',
      'weightBps',
      'isPaymentMilestone',
      'amountMinor',
      'currencyCode',
      'dueDate',
      'revisedDueDate',
      'completedDate',
      'submittedAt',
      'submittedById',
      'approvedAt',
      'approvedById',
      'rejectionReason',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'variations',
    controller: 'delivery',
    path: 'contract/variations',
    list: 'listVariations',
    get: 'getVariation',
    workspace: 'project',
    repository: 'variations',
    row: {
      ...base,
      raisedByPartyId: 'party-1',
      referenceNumber: 'VO-001',
      title: 'Extra drainage',
      description: 'Add drainage',
      variationType: 'scope',
      status: 'submitted',
      amountDeltaMinor: '-150000',
      currencyCode: 'NGN',
      timeExtensionDays: 5,
      submittedAt: new Date('2026-04-01T00:00:00Z'),
      submittedById: 'cu-1',
      decidedAt: null,
      decidedById: '',
      decisionNote: '',
    },
    keys: [
      'id',
      'contractId',
      'raisedByPartyId',
      'referenceNumber',
      'title',
      'description',
      'variationType',
      'status',
      'amountDeltaMinor',
      'currencyCode',
      'timeExtensionDays',
      'submittedAt',
      'submittedById',
      'decidedAt',
      'decidedById',
      'decisionNote',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'invoices',
    controller: 'financial',
    path: 'contract/invoices',
    list: 'listInvoices',
    get: 'getInvoice',
    workspace: 'finance',
    repository: 'invoices',
    row: {
      ...base,
      issuedByPartyId: 'party-2',
      billedToPartyId: 'party-1',
      invoiceNumber: 'INV-1',
      invoiceType: 'interim',
      status: 'submitted',
      issueDate: '2026-04-01',
      dueDate: '2026-05-01',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      currencyCode: 'NGN',
      grossAmountMinor: '1000000',
      adjustmentsTotalMinor: '-50000',
      netPayableMinor: '950000',
      amountPaidMinor: '0',
      submittedAt: new Date('2026-04-01T12:00:00Z'),
      submittedById: 'cu-2',
      certifiedAt: null,
      certifiedById: '',
      rejectionReason: '',
    },
    keys: [
      'id',
      'contractId',
      'issuedByPartyId',
      'billedToPartyId',
      'invoiceNumber',
      'invoiceType',
      'status',
      'issueDate',
      'dueDate',
      'periodStart',
      'periodEnd',
      'currencyCode',
      'grossAmountMinor',
      'adjustmentsTotalMinor',
      'netPayableMinor',
      'amountPaidMinor',
      'submittedAt',
      'submittedById',
      'certifiedAt',
      'certifiedById',
      'rejectionReason',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'payments',
    controller: 'financial',
    path: 'contract/payments',
    list: 'listPayments',
    get: 'getPayment',
    workspace: 'finance',
    repository: 'payments',
    row: {
      ...base,
      invoiceId: 'inv-1',
      paymentReference: 'PAY-1',
      idempotencyKey: 'internal-dedupe-key',
      amountMinor: '950000',
      currencyCode: 'NGN',
      invoiceAmountMinor: '950000',
      invoiceCurrencyCode: 'NGN',
      fxBaseCurrencyCode: '',
      fxRateMicro: null,
      fxRateSource: '',
      fxRateAt: null,
      paymentMethod: 'bank_transfer',
      status: 'recorded',
      paymentDate: '2026-05-02',
      externalReference: 'BANK-REF',
      recordedAt: new Date('2026-05-02T10:00:00Z'),
      recordedById: 'cu-1',
      approvedAt: null,
      approvedById: '',
      receiptConfirmedAt: null,
      receiptConfirmedById: '',
      notes: '',
    },
    keys: [
      'id',
      'contractId',
      'invoiceId',
      'paymentReference',
      'amountMinor',
      'currencyCode',
      'invoiceAmountMinor',
      'invoiceCurrencyCode',
      'fxBaseCurrencyCode',
      'fxRateMicro',
      'fxRateSource',
      'fxRateAt',
      'paymentMethod',
      'status',
      'paymentDate',
      'externalReference',
      'recordedAt',
      'recordedById',
      'approvedAt',
      'approvedById',
      'receiptConfirmedAt',
      'receiptConfirmedById',
      'notes',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'HSE incidents',
    controller: 'hse',
    path: 'contract/hse/incidents',
    list: 'listIncidents',
    get: 'getIncident',
    workspace: 'hse',
    repository: 'incidents',
    row: {
      ...base,
      contractSiteId: 'site-1',
      referenceNumber: 'INC-1',
      incidentType: 'injury',
      severity: 'serious',
      status: 'reported',
      occurredAt: new Date('2026-04-10T07:15:00Z'),
      locationDetail: 'Trench 3',
      description: 'Slip on wet ground',
      immediateActionTaken: 'First aid',
      rootCause: '',
      investigationSummary: '',
      lostTimeDays: 2,
      estimatedCostMinor: '0',
      currencyCode: 'NGN',
      isNotifiable: true,
      authorityNotifiedAt: null,
      reportedAt: new Date('2026-04-10T08:00:00Z'),
      reportedById: 'cu-3',
      investigatedById: '',
      closedAt: null,
      closedById: '',
    },
    keys: [
      'id',
      'contractId',
      'contractSiteId',
      'referenceNumber',
      'incidentType',
      'severity',
      'status',
      'occurredAt',
      'locationDetail',
      'description',
      'immediateActionTaken',
      'rootCause',
      'investigationSummary',
      'lostTimeDays',
      'estimatedCostMinor',
      'currencyCode',
      'isNotifiable',
      'authorityNotifiedAt',
      'reportedAt',
      'reportedById',
      'investigatedById',
      'closedAt',
      'closedById',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'HSE inspections',
    controller: 'hse',
    path: 'contract/hse/inspections',
    list: 'listInspections',
    get: 'getInspection',
    workspace: 'hse',
    repository: 'inspections',
    row: {
      ...base,
      contractSiteId: 'site-1',
      inspectorCompanyUserId: '',
      referenceNumber: 'INS-1',
      inspectionType: 'planned',
      status: 'completed',
      scheduledDate: '2026-04-15',
      conductedAt: new Date('2026-04-15T09:00:00Z'),
      externalInspectorFirstName: 'Ngozi',
      externalInspectorLastName: 'Eze',
      externalInspectorOrganization: 'SafeWorks Ltd',
      overallResult: 'satisfactory',
      scoreBps: 9200,
      summary: 'All clear',
    },
    keys: [
      'id',
      'contractId',
      'contractSiteId',
      'inspectorCompanyUserId',
      'referenceNumber',
      'inspectionType',
      'status',
      'scheduledDate',
      'conductedAt',
      'externalInspectorFirstName',
      'externalInspectorLastName',
      'externalInspectorOrganization',
      'overallResult',
      'scoreBps',
      'summary',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'corrective actions',
    controller: 'hse',
    path: 'contract/hse/corrective-actions',
    list: 'listCorrectiveActions',
    get: 'getCorrectiveAction',
    workspace: 'hse',
    repository: 'correctiveActions',
    row: {
      ...base,
      hseIncidentId: 'inc-1',
      hseInspectionFindingId: '',
      assignedToCompanyUserId: 'cu-4',
      description: 'Add warning signs',
      priority: 'high',
      status: 'open',
      dueDate: '2026-04-20',
      completedAt: null,
      verifiedAt: null,
      verifiedById: '',
      closureNote: '',
    },
    keys: [
      'id',
      'contractId',
      'hseIncidentId',
      'hseInspectionFindingId',
      'assignedToCompanyUserId',
      'description',
      'priority',
      'status',
      'dueDate',
      'completedAt',
      'verifiedAt',
      'verifiedById',
      'closureNote',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'sites',
    controller: 'siteOperations',
    path: 'contract/sites',
    list: 'listSites',
    get: 'getSite',
    workspace: 'project',
    repository: 'sites',
    row: {
      ...base,
      name: 'Main yard',
      siteCode: 'MY-1',
      addressLine1: '1 Port Road',
      city: 'Port Harcourt',
      stateRegion: 'Rivers',
      countryCode: 'NG',
      latitudeE6: 4815000,
      longitudeE6: 7049000,
      status: 'active',
    },
    keys: [
      'id',
      'contractId',
      'name',
      'siteCode',
      'addressLine1',
      'city',
      'stateRegion',
      'countryCode',
      'latitudeE6',
      'longitudeE6',
      'status',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'daily logs',
    controller: 'siteOperations',
    path: 'contract/daily-logs',
    list: 'listDailyLogs',
    get: 'getDailyLog',
    workspace: 'project',
    repository: 'dailyLogs',
    row: {
      ...base,
      contractSiteId: 'site-1',
      contractPartyId: 'party-2',
      logDate: '2026-04-10',
      weatherCondition: 'rain',
      temperatureCelsius: 27,
      weatherDelayMinutes: 45,
      workPerformed: 'Excavation',
      workPlannedNext: 'Backfill',
      issuesAndDelays: 'Rain',
      status: 'submitted',
      submittedAt: new Date('2026-04-10T18:00:00Z'),
      submittedById: 'cu-1',
      approvedAt: null,
      approvedById: '',
      rejectionReason: '',
    },
    keys: [
      'id',
      'contractId',
      'contractSiteId',
      'contractPartyId',
      'logDate',
      'weatherCondition',
      'temperatureCelsius',
      'weatherDelayMinutes',
      'workPerformed',
      'workPlannedNext',
      'issuesAndDelays',
      'status',
      'submittedAt',
      'submittedById',
      'approvedAt',
      'approvedById',
      'rejectionReason',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'inventory items',
    controller: 'siteOperations',
    path: 'contract/inventory-items',
    list: 'listInventoryItems',
    get: 'getInventoryItem',
    workspace: 'project',
    repository: 'inventoryItems',
    row: {
      ...base,
      contractSiteId: 'site-1',
      contractPartyId: 'party-2',
      itemCode: 'CEM-50',
      name: 'Cement 50kg',
      category: 'Materials',
      unitOfMeasure: 'bag',
      quantityOnHandMilli: '120000',
      reorderLevelMilli: '20000',
    },
    keys: [
      'id',
      'contractId',
      'contractSiteId',
      'contractPartyId',
      'itemCode',
      'name',
      'category',
      'unitOfMeasure',
      'quantityOnHandMilli',
      'reorderLevelMilli',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'inventory transactions',
    controller: 'siteOperations',
    path: 'contract/inventory-transactions',
    list: 'listInventoryTransactions',
    get: 'getInventoryTransaction',
    workspace: 'project',
    repository: 'inventoryTransactions',
    row: {
      ...base,
      inventoryItemId: 'item-1',
      siteDailyLogId: '',
      transactionType: 'receipt',
      quantityMilli: '10000',
      unitCostMinor: '850000',
      currencyCode: 'NGN',
      referenceNumber: 'GRN-1',
      counterPartyName: 'Supplier Ltd',
      transactionAt: '2026-04-10T11:00:00.000Z',
      performedById: 'cu-1',
      remarks: '',
    },
    keys: [
      'id',
      'contractId',
      'inventoryItemId',
      'siteDailyLogId',
      'transactionType',
      'quantityMilli',
      'unitCostMinor',
      'currencyCode',
      'referenceNumber',
      'counterPartyName',
      'transactionAt',
      'performedById',
      'remarks',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'compliance requirements',
    controller: 'compliance',
    path: 'contract/compliance/requirements',
    list: 'listRequirements',
    get: 'getRequirement',
    workspace: 'general',
    repository: 'requirements',
    row: {
      ...base,
      name: 'Insurance',
      description: 'Contractor all-risk insurance',
      category: 'insurance',
      appliesToPartyType: 'contractor',
      isMandatory: true,
      frequency: 'annual',
      firstDueDate: '2026-03-15',
    },
    keys: [
      'id',
      'contractId',
      'name',
      'description',
      'category',
      'appliesToPartyType',
      'isMandatory',
      'frequency',
      'firstDueDate',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: 'compliance records',
    controller: 'compliance',
    path: 'contract/compliance/records',
    list: 'listRecords',
    get: 'getRecord',
    workspace: 'general',
    repository: 'records',
    row: {
      ...base,
      complianceRequirementId: 'req-1',
      contractPartyId: 'party-2',
      referenceNumber: 'POL-1',
      issuingAuthority: 'Insurer plc',
      issueDate: '2026-03-01',
      expiryDate: '2027-03-01',
      coveredAmountMinor: '500000000',
      currencyCode: 'NGN',
      status: 'submitted',
      verifiedAt: null,
      verifiedById: '',
      remarks: '',
    },
    keys: [
      'id',
      'contractId',
      'complianceRequirementId',
      'contractPartyId',
      'referenceNumber',
      'issuingAuthority',
      'issueDate',
      'expiryDate',
      'coveredAmountMinor',
      'currencyCode',
      'status',
      'verifiedAt',
      'verifiedById',
      'remarks',
      'createdAt',
      'updatedAt',
    ],
  },
];

const controllerClasses = {
  delivery: DeliveryController,
  financial: FinancialController,
  hse: HseController,
  siteOperations: SiteOperationsController,
  compliance: ComplianceController,
} as const;

type RepositoryMock = {
  findPage: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
};
type Handler = (...args: unknown[]) => Promise<unknown>;

function repositoryMock(): RepositoryMock {
  return { findPage: vi.fn(), findById: vi.fn() };
}

/** Builds every workspace controller on top of shared access and repository mocks. */
function buildControllers() {
  const access = { authorize: vi.fn() };
  const repositories: Record<string, RepositoryMock> = Object.fromEntries(
    resources.map(({ repository }) => [repository, repositoryMock()]),
  );
  const r = (name: string) => repositories[name] as never;
  const controllers = {
    delivery: new DeliveryController(
      new DeliveryService(
        access as never,
        r('stages'),
        r('milestones'),
        r('variations'),
      ),
    ),
    financial: new FinancialController(
      new FinancialService(access as never, r('invoices'), r('payments')),
    ),
    hse: new HseController(
      new HseService(
        access as never,
        r('incidents'),
        r('inspections'),
        r('correctiveActions'),
      ),
    ),
    siteOperations: new SiteOperationsController(
      new SiteOperationsService(
        access as never,
        r('sites'),
        r('dailyLogs'),
        r('inventoryItems'),
        r('inventoryTransactions'),
      ),
    ),
    compliance: new ComplianceController(
      new ComplianceService(access as never, r('requirements'), r('records')),
    ),
  };
  return { access, repositories, controllers };
}

function handlerOf(controller: object, name: string): Handler {
  const handler = Reflect.get(controller, name) as Handler | undefined;
  if (typeof handler !== 'function') throw new Error(`Missing handler ${name}`);
  return handler.bind(controller);
}

/** An execution context for a real workspace handler. */
function httpContext(
  resource: Resource,
  request: {
    user?: { id: string };
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
  },
): ExecutionContext {
  const controllerClass = controllerClasses[resource.controller];
  const handler = Reflect.get(
    controllerClass.prototype,
    resource.list,
  ) as Handler;
  const req = { headers: {}, query: {}, params: {}, ...request };
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const page = { page: 1, limit: 20 };

describe('workspace read endpoints', () => {
  describe('route inventory', () => {
    it('exposes exactly a list and a get route per resource, all GET', () => {
      const routes = Object.values(controllerClasses).flatMap((controller) => {
        const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
        return Object.getOwnPropertyNames(controller.prototype)
          .filter((name) => name !== 'constructor')
          .map((name) => {
            const handler = Reflect.get(controller.prototype, name) as object;
            const method = Reflect.getMetadata(
              METHOD_METADATA,
              handler,
            ) as RequestMethod;
            const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
            // Normalise the record parameter name (:stageId, :invoiceId...).
            return `${RequestMethod[method]} ${prefix}/${path}`.replace(
              /\/:\w+$/,
              '/:id',
            );
          });
      });

      expect(routes.sort()).toEqual(
        resources
          .flatMap(({ path }) => [`GET ${path}`, `GET ${path}/:id`])
          .sort(),
      );
    });
  });

  describe('guards', () => {
    it.each(Object.entries(controllerClasses))(
      '%s requires company then contract context',
      (_name, controller) => {
        expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([
          CompanyContextGuard,
          ContractContextGuard,
        ]);
      },
    );

    it('marks no workspace route public, so sign-in is always required', () => {
      for (const controller of Object.values(controllerClasses)) {
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller)).toBeUndefined();
        for (const name of Object.getOwnPropertyNames(controller.prototype)) {
          const handler = Reflect.get(controller.prototype, name) as object;
          expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
        }
      }
    });

    describe.each(resources)('$path', (resource) => {
      it('refuses a request without a session', async () => {
        const auth = {
          sessionCookieName: () => 'cf_session',
          authenticate: vi.fn(),
        };
        const guard = new SessionAuthGuard(auth as never, new Reflector());

        await expect(
          guard.canActivate(httpContext(resource, {})),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(auth.authenticate).not.toHaveBeenCalled();
      });

      it('refuses missing, malformed or misplaced company context', async () => {
        const companyScope = { contextForUser: vi.fn() };
        const guard = new CompanyContextGuard(companyScope as never);
        const run = (request: Parameters<typeof httpContext>[1]) =>
          guard.canActivate(httpContext(resource, request));

        await expect(run({})).rejects.toBeInstanceOf(UnauthorizedException);
        await expect(run({ user: USER })).rejects.toBeInstanceOf(
          BadRequestException,
        );
        await expect(
          run({ user: USER, headers: { 'x-company-id': 'not-a-ulid' } }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          run({
            user: USER,
            headers: { 'x-company-id': COMPANY },
            query: { companyId: COMPANY },
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(companyScope.contextForUser).not.toHaveBeenCalled();
      });

      it('refuses a company the user is not an active member of', async () => {
        const companyScope = {
          contextForUser: vi
            .fn()
            .mockRejectedValue(new ForbiddenException('Not a member')),
        };
        const guard = new CompanyContextGuard(companyScope as never);

        await expect(
          guard.canActivate(
            httpContext(resource, {
              user: USER,
              headers: { 'x-company-id': COMPANY },
            }),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(companyScope.contextForUser).toHaveBeenCalledWith(
          USER.id,
          COMPANY,
        );
      });

      it('refuses missing, malformed or misplaced contract context', () => {
        const guard = new ContractContextGuard();
        const run = (request: Parameters<typeof httpContext>[1]) => () =>
          guard.canActivate(httpContext(resource, request));

        expect(run({ user: USER })).toThrow(BadRequestException);
        expect(
          run({ user: USER, headers: { 'x-contract-id': 'contract-1' } }),
        ).toThrow(BadRequestException);
        expect(
          run({
            user: USER,
            headers: { 'x-contract-id': CONTRACT },
            params: { contractId: OTHER_CONTRACT },
          }),
        ).toThrow(BadRequestException);
      });
    });
  });

  describe.each(resources)('$path', (resource) => {
    let access: { authorize: ReturnType<typeof vi.fn> };
    let repository: RepositoryMock;
    let list: Handler;
    let get: Handler;

    beforeEach(() => {
      const built = buildControllers();
      access = built.access;
      repository = built.repositories[resource.repository];
      const controller = built.controllers[resource.controller];
      list = handlerOf(controller, resource.list);
      get = handlerOf(controller, resource.get);
      access.authorize.mockResolvedValue({
        contractId: CONTRACT,
        companyId: COMPANY,
      });
    });

    it(`checks access to the ${resource.workspace} workspace before reading`, async () => {
      repository.findPage.mockResolvedValue({ items: [], total: 0 });
      repository.findById.mockResolvedValue({ ...resource.row });

      await list(USER, COMPANY, CONTRACT, page);
      await get(USER, COMPANY, CONTRACT, 'row-1');

      expect(access.authorize).toHaveBeenCalledTimes(2);
      for (const call of access.authorize.mock.calls) {
        expect(call).toEqual([USER.id, COMPANY, CONTRACT, resource.workspace]);
      }
      expect(access.authorize.mock.invocationCallOrder[0]).toBeLessThan(
        repository.findPage.mock.invocationCallOrder[0],
      );
      // Reads are limited to the scope the access check returned.
      expect(repository.findPage.mock.calls[0][0]).toEqual({
        contractId: CONTRACT,
        companyId: COMPANY,
      });
      expect(repository.findById).toHaveBeenCalledWith(
        { contractId: CONTRACT, companyId: COMPANY },
        'row-1',
      );
    });

    it.each([
      [
        'a member without a role on the contract',
        new NotFoundException('Contract was not found'),
      ],
      [
        'a contract the company is not a party to',
        new NotFoundException('Contract was not found'),
      ],
      [
        'a role in another workspace, or Company Administrator status alone',
        new ForbiddenException(
          'Your role does not have access to this contract workspace',
        ),
      ],
      [
        'a workspace the contract has not enabled',
        new ForbiddenException('This contract workspace is unavailable'),
      ],
    ])('reads nothing for %s', async (_case, error) => {
      access.authorize.mockRejectedValue(error);

      await expect(list(USER, COMPANY, CONTRACT, page)).rejects.toBe(error);
      await expect(get(USER, COMPANY, CONTRACT, 'row-1')).rejects.toBe(error);
      expect(repository.findPage).not.toHaveBeenCalled();
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('returns an empty page when there are no records', async () => {
      repository.findPage.mockResolvedValue({ items: [], total: 0 });

      await expect(list(USER, COMPANY, CONTRACT, page)).resolves.toEqual({
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 20,
          totalPages: 0,
          currentPage: 1,
        },
      });
    });

    it('answers 404 for a record outside the contract scope', async () => {
      // The scoped repository finds nothing for another contract's record.
      repository.findById.mockResolvedValue(null);

      await expect(
        get(USER, COMPANY, CONTRACT, 'other-contract-row'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns exactly the documented response fields', async () => {
      const stored = { ...resource.row, ...leaks };
      repository.findPage.mockResolvedValue({ items: [stored], total: 1 });
      repository.findById.mockResolvedValue(stored);

      const listed = (await list(USER, COMPANY, CONTRACT, page)) as {
        data: Record<string, unknown>[];
      };
      const single = (await get(USER, COMPANY, CONTRACT, 'row-1')) as Record<
        string,
        unknown
      >;

      for (const response of [listed.data[0], single]) {
        expect(Object.keys(response).sort()).toEqual([...resource.keys].sort());
        expect(response.createdAt).toBe('2026-03-01T08:00:00.000Z');
        expect(response.updatedAt).toBe('2026-03-02T09:30:00.000Z');
        // Plain JSON: no entity prototypes or loaded relations.
        expect(JSON.parse(JSON.stringify(response))).toEqual(response);
      }
    });
  });
});
