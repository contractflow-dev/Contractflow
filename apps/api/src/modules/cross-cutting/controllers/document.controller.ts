import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentContractId } from '../../../common/decorators/current-contract-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { ContractContextGuard } from '../../../common/guards/contract-context.guard';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import {
  CreateDocumentUploadRequestDto,
  DocumentDownloadQueryDto,
  DocumentFileRequestDto,
} from '../dto/document-request.dto';
import {
  DocumentService,
  type IDocumentActor,
} from '../services/document.service';

/**
 * Documents of the contract named by X-Contract-Id, within the company named
 * by X-Company-Id. Access is decided by DocumentService.
 */
@Controller('contract/documents')
@UseGuards(CompanyContextGuard, ContractContextGuard)
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.documents.list(actor(user, companyId, contractId), query);
  }

  @Post('upload-url')
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: CreateDocumentUploadRequestDto,
  ) {
    return this.documents.createUpload(
      actor(user, companyId, contractId),
      body,
    );
  }

  @Get(':documentId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.get(actor(user, companyId, contractId), documentId);
  }

  @Post(':documentId/versions/upload-url')
  createVersionUpload(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('documentId') documentId: string,
    @Body() body: DocumentFileRequestDto,
  ) {
    return this.documents.createVersionUpload(
      actor(user, companyId, contractId),
      documentId,
      body,
    );
  }

  @Post(':documentId/versions/:versionId/complete')
  @HttpCode(HttpStatus.OK)
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documents.completeUpload(
      actor(user, companyId, contractId),
      documentId,
      versionId,
    );
  }

  @Get(':documentId/download-url')
  createDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('documentId') documentId: string,
    @Query() query: DocumentDownloadQueryDto,
  ) {
    return this.documents.createDownloadUrl(
      actor(user, companyId, contractId),
      documentId,
      query.versionId,
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.delete(
      actor(user, companyId, contractId),
      documentId,
    );
  }
}

function actor(
  user: AuthenticatedUser,
  companyId: string,
  contractId: string,
): IDocumentActor {
  return { userId: user.id, companyId, contractId };
}
