import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { EntityManager, FindManyOptions, Repository } from 'typeorm';

import { ECompanyStatus } from '@contractflow/contracts-schema';

import { BaseRepository } from '../../../common/database/repositories/base.repository';

import { Company } from '../entities/company.entity';

import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';
import { CompanyProfileUpdateData } from '../types/company-profile-upadte.type';

@Injectable()
export class CompanyRepository extends BaseRepository<Company> {
  constructor(
    @InjectRepository(Company)
    repository: Repository<Company>,
  ) {
    super(repository);
  }

  /**
   * Create a company.
   *
   * Accepts an optional EntityManager so the operation
   * can participate in an existing transaction.
   */
  async createCompany(
    dto: CreateCompanyRequestDto,
    manager?: EntityManager,
  ): Promise<Company> {
    const repository = this.getRepository(manager);

    const company = repository.create({
      ...dto,
      website: dto.website ?? '',
      addressLine2: dto.addressLine2 ?? '',
      status: ECompanyStatus.ACTIVE,
      verifiedAt: null,
    });

    return repository.save(company);
  }

  /**
   * Find a company by its ID.
   */
  async findCompanyById(
    companyId: string,
    manager?: EntityManager,
  ): Promise<Company | null> {
    return this.getRepository(manager).findOne({
      where: { id: companyId },
    });
  }

  /**
   * Find a company by its registered email.
   */
  async findCompanyByEmail(
    email: string,
    manager?: EntityManager,
  ): Promise<Company | null> {
    return this.getRepository(manager).findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  /**
   * Find a company by its registration number.
   */
  async findByRegistrationNumber(
    registrationNumber: string,
    manager?: EntityManager,
  ): Promise<Company | null> {
    return this.getRepository(manager).findOne({
      where: {
        registrationNumber: registrationNumber.trim(),
      },
    });
  }

  /**
   * Check whether a registration number already exists.
   *
   * An optional company ID allows profile updates to exclude
   * the company currently being updated.
   */
  async existsByRegistrationNumber(
    registrationNumber: string,
    excludeCompanyId?: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const query = this.getRepository(manager)
      .createQueryBuilder('company')
      .where('company.registrationNumber = :registrationNumber', {
        registrationNumber: registrationNumber.trim(),
      });

    if (excludeCompanyId) {
      query.andWhere('company.id != :excludeCompanyId', { excludeCompanyId });
    }

    return query.getExists();
  }

  /**
   * Find and lock a company for an update operation.
   *
   * Must be called using the EntityManager of an active
   * transaction.
   */
  async findCompanyForUpdate(
    companyId: string,
    manager: EntityManager,
  ): Promise<Company | null> {
    return manager.getRepository(Company).findOne({
      where: { id: companyId },
      lock: {
        mode: 'pessimistic_write',
      },
    });
  }

  /**
   * Update permitted company profile fields.
   */
  async updateCompanyProfile(
    companyId: string,
    data: CompanyProfileUpdateData,
    manager?: EntityManager,
  ): Promise<Company | null> {
    const repository = this.getRepository(manager);

    const company = await repository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      return null;
    }

    repository.merge(company, data);

    return repository.save(company);
  }

  /**
   * Find companies using TypeORM find options.
   *
   * Restrict use of this operation to authorized
   * platform-level administration workflows.
   */
  async findCompanies(
    options?: FindManyOptions<Company>,
    manager?: EntityManager,
  ): Promise<Company[]> {
    return this.getRepository(manager).find(options);
  }

  /**
   * Resolve the correct repository.
   *
   * Uses the transaction manager when supplied;
   * otherwise uses the injected repository.
   */
  private getRepository(manager?: EntityManager): Repository<Company> {
    return manager ? manager.getRepository(Company) : this.repository;
  }
}
