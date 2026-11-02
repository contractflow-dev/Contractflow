import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { ECompanyStatus } from '@contractflow/contracts-schema';
import { CurrentCompanyId } from '../../src/common/decorators/current-company-id.decorator';
import { CompanyContextGuard } from '../../src/common/guards/company-context.guard';
import type { AuthenticatedRequest } from '../../src/common/guards/session-auth.guard';
import { Company } from '../../src/modules/identity/entities/company.entity';
import { CompanyUser } from '../../src/modules/identity/entities/company-user.entity';
import { CompanyUserRepository } from '../../src/modules/identity/repositories/company-user.respository';
import { CompanyScopeService } from '../../src/modules/identity/services/company/company-scope.service';
import { ContractTestFactory } from '../fixtures/contract-test.factory';
import { integrationEntities } from './database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from './database/postgres-test-database';

@Controller('company-context-test/:companyId')
@UseGuards(CompanyContextGuard)
class CompanyContextTestController {
  @Get()
  get(@CurrentCompanyId() companyId: string) {
    return { companyId };
  }
}

describe('Company context PostgreSQL integration', () => {
  let app: INestApplication | undefined;
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let currentUserId = '';

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const companyUsers = new CompanyUserRepository(
      dataSource.getRepository(CompanyUser),
    );
    const companyScope = new CompanyScopeService(companyUsers);
    const moduleRef = await Test.createTestingModule({
      controllers: [CompanyContextTestController],
      providers: [
        { provide: CompanyScopeService, useValue: companyScope },
        CompanyContextGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((request: Request, _response: Response, next: NextFunction) => {
      (request as AuthenticatedRequest).user = {
        id: currentUserId,
        email: 'integration@example.com',
        emailVerifiedAt: new Date(),
        isPlatformAdmin: false,
      };
      next();
    });
    await app.init();
  }, 60_000);

  afterEach(async () => {
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  it('accepts a company header only for the authenticated active membership', async () => {
    const fixture = await factory.createCompanyMember();
    currentUserId = fixture.member.userId;

    await request(app!.getHttpServer())
      .get(`/company-context-test/${fixture.company.id}`)
      .set('X-Company-Id', fixture.company.id)
      .expect(200)
      .expect({ companyId: fixture.company.id });
  });

  it('rejects missing headers, conflicting route IDs, and another company', async () => {
    const ownCompany = await factory.createCompanyMember();
    const otherCompany = await factory.createCompanyMember();
    currentUserId = ownCompany.member.userId;

    await request(app!.getHttpServer())
      .get(`/company-context-test/${ownCompany.company.id}`)
      .expect(400);

    await request(app!.getHttpServer())
      .get(`/company-context-test/${ownCompany.company.id}`)
      .set('X-Company-Id', otherCompany.company.id)
      .expect(400);

    await request(app!.getHttpServer())
      .get(`/company-context-test/${otherCompany.company.id}`)
      .set('X-Company-Id', otherCompany.company.id)
      .expect(403);
  });

  it('rejects inactive companies and memberships that have been left', async () => {
    const fixture = await factory.createCompanyMember();
    currentUserId = fixture.member.userId;

    fixture.company.status = ECompanyStatus.INACTIVE;
    await dataSource.getRepository(Company).save(fixture.company);
    await request(app!.getHttpServer())
      .get(`/company-context-test/${fixture.company.id}`)
      .set('X-Company-Id', fixture.company.id)
      .expect(403);

    fixture.company.status = ECompanyStatus.ACTIVE;
    await dataSource.getRepository(Company).save(fixture.company);
    fixture.member.leftAt = new Date();
    await dataSource.getRepository(CompanyUser).save(fixture.member);
    await request(app!.getHttpServer())
      .get(`/company-context-test/${fixture.company.id}`)
      .set('X-Company-Id', fixture.company.id)
      .expect(403);
  });
});
