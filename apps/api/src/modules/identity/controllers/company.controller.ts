import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../services/auth.service';
import { CreateCompanyRequestDto } from '../dto/company/requests/create-company-request.dto';
import { CompanyService } from '../services/company.service';

@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCompanyRequestDto,
  ) {
    return this.companyService.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.listForUser(user.id);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getCurrent(user.id);
  }

  @Get(':companyId/membership')
  getMembership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
  ) {
    return this.companyService.getMembership(user.id, companyId);
  }

  @Get(':companyId/dashboard')
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
  ) {
    return this.companyService.getDashboard(user.id, companyId);
  }
}
