import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common'
import { EnvironmentService } from './environment.service'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

@Controller()
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

  // Rota que o frontend usa: GET /tenants/:accountId/environment-configurations
  @Get('tenants/:accountId/environment-configurations')
  get(@Param('accountId') accountId: string, @CurrentUser() user: JwtUser) {
    // Garante que só acessa as próprias configurações
    return this.environmentService.get(user.accountId)
  }

  @Post('tenants/:accountId/environment-configurations')
  save(@Param('accountId') _id: string, @Body() body: any, @CurrentUser() user: JwtUser) {
    return this.environmentService.save(user.accountId, body)
  }

  @Put('tenants/:accountId/environment-configurations')
  update(@Param('accountId') _id: string, @Body() body: any, @CurrentUser() user: JwtUser) {
    return this.environmentService.save(user.accountId, body)
  }

  // Rota alternativa: GET /environment-settings
  @Get('environment-settings')
  getAlt(@CurrentUser() user: JwtUser) {
    return this.environmentService.get(user.accountId)
  }

  @Post('environment-settings')
  saveAlt(@Body() body: any, @CurrentUser() user: JwtUser) {
    return this.environmentService.save(user.accountId, body)
  }
}