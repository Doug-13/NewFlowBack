import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DashboardService } from './dashboard.service'

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(
    @Query('accountId') accountId: string,
    @Query('processId') processId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.summary(accountId || user.accountId, processId)
  }
}
