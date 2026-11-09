import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractParty } from '../contract/entities/contract-party.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Company } from '../identity/entities/company.entity';
import { CompanyUser } from '../identity/entities/company-user.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { DocumentLink } from './entities/document-link.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { Document } from './entities/document.entity';
import { ActivityLogRepository } from './repositories/activity-log.repository';
import { DocumentRepository } from './repositories/document.repository';
import { CommentRepository } from './repositories/comment.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { Comment } from './entities/comment.entity';
import { Conversation } from './entities/conversation.entity';
import { Notification } from './entities/notification.entity';
import { ContractModule } from '../contract/contract-module';
import { IdentityModule } from '../identity/identity.module';
import { ActivityController } from './controllers/activity.controller';
import { ActivityService } from './services/activity.service';
import { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../common/database/typeorm-unit-of-work';
import { StorageModule } from '../../common/storage/storage.module';
import { CompanyDocumentController } from './controllers/company-document.controller';
import { DocumentController } from './controllers/document.controller';
import { DocumentService } from './services/document.service';
import {
  DocumentContextFactory,
  TypeOrmDocumentContext,
} from './repositories/document-context.factory';
import {
  DOCUMENT_PERSISTENCE,
  DOCUMENT_UNIT_OF_WORK,
  type IDocumentContext,
} from './interfaces/document-persistence.interface';

const REPOSITORIES = [
  ActivityLogRepository,
  DocumentRepository,
  CommentRepository,
  ConversationRepository,
  NotificationRepository,
];

@Module({
  imports: [
    ContractModule,
    IdentityModule,
    StorageModule,
    TypeOrmModule.forFeature([
      ActivityLog,
      Comment,
      Conversation,
      Notification,
      Document,
      DocumentVersion,
      DocumentLink,
      Contract,
      ContractParty,
      Company,
      CompanyUser,
    ]),
  ],
  controllers: [ActivityController, DocumentController, CompanyDocumentController],
  providers: [
    ...REPOSITORIES,
    ActivityService,
    DocumentService,
    {
      provide: DOCUMENT_PERSISTENCE,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmDocumentContext(dataSource.manager),
      inject: [DataSource],
    },
    {
      provide: DOCUMENT_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<IDocumentContext>(
          dataSource,
          new DocumentContextFactory(),
        ),
      inject: [DataSource],
    },
  ],
  exports: [...REPOSITORIES, ActivityService],
})
export class CrossCuttingModule {}
