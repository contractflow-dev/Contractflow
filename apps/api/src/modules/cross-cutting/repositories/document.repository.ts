import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  DeepPartial,
  FindOptionsWhere,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { Document } from '../entities/document.entity';

@Injectable()
export class DocumentRepository extends BaseRepository<
  Document,
  ICompanyScope
> {
  constructor(
    @InjectRepository(Document)
    repository: Repository<Document>,
    @InjectRepository(ContractParty)
    private readonly contractParties: Repository<ContractParty>,
  ) {
    super(repository);
  }

  protected override applyScope(
    qb: SelectQueryBuilder<Document>,
    scope: ICompanyScope,
  ): void {
    qb.andWhere(`${qb.alias}.ownerCompanyId = :__scopeCompanyId`, {
      __scopeCompanyId: requireCompanyId(scope),
    });
  }

  protected override scopeWhere(
    scope: ICompanyScope,
  ): FindOptionsWhere<Document> {
    return { ownerCompanyId: requireCompanyId(scope) };
  }

  protected override scopeValues(
    scope: ICompanyScope,
  ): DeepPartial<Document> {
    return { ownerCompanyId: requireCompanyId(scope) };
  }

  override async findById(
    id: string,
    scope: ICompanyScope,
  ): Promise<Document | null> {
    return this.repository.findOne({
      where: { id, ...this.scopeWhere(scope) },
    });
  }

  async createForContract(
    data: DeepPartial<Document>,
    scope: ICompanyScope,
  ): Promise<Document> {
    const companyId = requireCompanyId(scope);
    if (!data.contractId) {
      throw new BadRequestException('A contract is required for a document');
    }

    const party = await this.contractParties.findOne({
      where: { contractId: data.contractId, companyId },
      select: { id: true },
    });
    if (!party) {
      throw new BadRequestException(
        'The company must be a party to the document contract',
      );
    }

    return this.save(this.create(data, scope), scope);
  }
}

function requireCompanyId(scope: ICompanyScope): string {
  const companyId = scope?.companyId?.trim();
  if (!companyId) {
    throw new BadRequestException('Company context is required');
  }
  return companyId;
}
