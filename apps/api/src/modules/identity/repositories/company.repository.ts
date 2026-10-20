import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BaseRepository } from '../../../common/database/repositories/base.repository';
import { Company } from '../entities/company.entity';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';

@Injectable()
export class CompanyRepository extends BaseRepository<Company> {
  constructor(
    @InjectRepository(Company)
    repository: Repository<Company>,
  ) {
    super(repository);
  }

  async findById(id: string): Promise<Company | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async createCompany(dto: CreateCompanyRequestDto): Promise<Company> {
    const company = this.repository.create({
      ...dto,
      website: dto.website ?? '',
      addressLine2: dto.addressLine2 ?? '',
    });

    return this.repository.save(company);
  }

  async findAll(): Promise<Company[]> {
    return this.repository.find();
  }
}
