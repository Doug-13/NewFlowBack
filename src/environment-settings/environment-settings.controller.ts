import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { assertAdministrator } from '../security/admin-access'
import { EnvironmentSettingsService } from './environment-settings.service'

@UseGuards(JwtAuthGuard)
@Controller('environment-settings')
export class EnvironmentSettingsController {
  constructor(private readonly service: EnvironmentSettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: any) {
    return this.service.get(user.accountId)
  }

  @Put()
  saveSettings(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.save(user.accountId, body)
  }
}
