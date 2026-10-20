import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import type { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { Notification } from '../entities/notification.entity';

/** Notifications are personal: reads are narrowed to the recipient as well. */
@Injectable()
export class NotificationRepository extends ContractScopedRepository<Notification> {
  constructor(
    @InjectRepository(Notification) repository: Repository<Notification>,
  ) {
    super(repository);
  }

  async findPageForRecipient(
    recipientUserId: string,
    scope: IContractScope,
    options: { skip?: number; take?: number } = {},
  ): Promise<{ items: Notification[]; total: number }> {
    return this.findPage(scope, {
      where: { recipientUserId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: options.skip,
      take: options.take,
    });
  }
}
