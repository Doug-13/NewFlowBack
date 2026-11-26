import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { assertAdministrator } from '../security/admin-access'
import { UsersService } from './users.service'

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.list(user.accountId)
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.create(body, user.accountId)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.update(id, body, user.accountId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    assertAdministrator(user)
    if (id === user.id) throw new ForbiddenException('Nao e permitido excluir o proprio administrador.')
    return this.service.remove(id, user.accountId)
  }
}
