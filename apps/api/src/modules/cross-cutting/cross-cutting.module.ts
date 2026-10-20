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
import { ActivityController } from './controllers/activity.controller';
import { ActivityService } from './services/activity.service';

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
  controllers: [ActivityController],
  providers: [...REPOSITORIES, ActivityService],
  exports: [...REPOSITORIES, ActivityService],
})
export class CrossCuttingModule {}
