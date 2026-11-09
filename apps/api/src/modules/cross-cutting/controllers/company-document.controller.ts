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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import {
  CreateCompanyDocumentUploadRequestDto,
  DocumentDownloadQueryDto,
  DocumentFileRequestDto,
} from '../dto/document-request.dto';
import {
  DocumentService,
  type ICompanyDocumentActor,
} from '../services/document.service';

/**
 * Company-wide documents of the company named by X-Company-Id. They are
 * private to that company: no contract, and no other company, reaches them.
 * Access is decided by DocumentService.
 */
@Controller('company/documents')
@UseGuards(CompanyContextGuard)
export class CompanyDocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.documents.listCompany(actor(user, companyId), query);
  }

  @Post('upload-url')
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Body() body: CreateCompanyDocumentUploadRequestDto,
  ) {
    return this.documents.createCompanyUpload(actor(user, companyId), body);
  }

  @Get(':documentId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.getCompany(actor(user, companyId), documentId);
  }

  @Post(':documentId/versions/upload-url')
  createVersionUpload(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('documentId') documentId: string,
    @Body() body: DocumentFileRequestDto,
  ) {
    return this.documents.createCompanyVersionUpload(
      actor(user, companyId),
      documentId,
      body,
    );
  }

  @Post(':documentId/versions/:versionId/complete')
  @HttpCode(HttpStatus.OK)
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documents.completeCompanyUpload(
      actor(user, companyId),
      documentId,
      versionId,
    );
  }

  @Get(':documentId/download-url')
  createDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('documentId') documentId: string,
    @Query() query: DocumentDownloadQueryDto,
  ) {
    return this.documents.createCompanyDownloadUrl(
      actor(user, companyId),
      documentId,
      query.versionId,
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.deleteCompany(actor(user, companyId), documentId);
  }
}

function actor(
  user: AuthenticatedUser,
  companyId: string,
): ICompanyDocumentActor {
  return { userId: user.id, companyId };
}
