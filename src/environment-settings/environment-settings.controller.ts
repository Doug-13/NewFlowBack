import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { EnvironmentSettingsService } from './environment-settings.service'

@UseGuards(JwtAuthGuard)
@Controller('environment-settings')
export class EnvironmentSettingsController {
  constructor(private readonly service: EnvironmentSettingsService) {}

  @Get()
  getSettings(
    @Query('accountId') accountId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.get(accountId || user.accountId)
  }

  @Put()
  saveSettings(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.save(user.accountId, body)
  }
}
