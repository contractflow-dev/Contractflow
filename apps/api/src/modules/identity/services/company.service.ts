import { Injectable, NotFoundException } from '@nestjs/common';

import { CompanyRepository } from '../repositories/company.repository';
import { CompanyResponseDto } from '../dto/company/responses/company-response.dto';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';

import type { ICompanyProfileResponse } from '@contractflow/contracts-schema';

@Injectable()
export class CompanyService {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async findById(id: string): Promise<ICompanyProfileResponse> {
    const company = await this.companyRepository.findById(id);

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return CompanyResponseDto.fromEntity(company);
  }

  async create(
    userId: string,
    dto: CreateCompanyRequestDto,
  ): Promise<ICompanyProfileResponse> {
    // TODO: Create the company and its initial membership
    // atomically once the membership repository is available.
    void userId;

    const company = await this.companyRepository.createCompany(dto);

    return CompanyResponseDto.fromEntity(company);
  }

  async listForUser(userId: string): Promise<ICompanyProfileResponse[]> {
    // TODO: Query only companies belonging to this user.
    void userId;

    throw new Error('listForUser requires a company membership repository');
  }

  async getCurrent(userId: string): Promise<ICompanyProfileResponse> {
    // TODO: Resolve the user's current company through membership.
    void userId;

    throw new Error(
      'getCurrent requires a current-company selection or membership model',
    );
  }

  async getMembership(userId: string, companyId: string) {
    // TODO: Query membership and verify access.
    void userId;
    void companyId;

    throw new Error('getMembership requires a company membership repository');
  }

  async getDashboard(userId: string, companyId: string) {
    // TODO: Verify membership and return a defined dashboard DTO.
    void userId;
    void companyId;

    throw new Error(
      'getDashboard requires dashboard contracts and membership checks',
    );
  }
}
