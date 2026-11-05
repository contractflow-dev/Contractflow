import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { AdminOverviewResponseDto } from '../dto/admin-overview-response.dto';
import { AdminOverviewService } from '../services/admin-overview.service';

@Controller('admin')
@UseGuards(PlatformAdminGuard)
export class AdminOverviewController {
  constructor(private readonly adminOverviewService: AdminOverviewService) {}

  @Get('overview')
  async getOverview(): Promise<AdminOverviewResponseDto> {
    return this.adminOverviewService.getOverview();
  }
}
