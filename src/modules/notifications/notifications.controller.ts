import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { CreateNotificationTemplateDto, UpdateNotificationTemplateDto } from './dto/notification-template.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

@Controller('notificationTemplates')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser) {
    return this.notificationsService.findAll(user.accountId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.findOne(id, user.accountId)
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateNotificationTemplateDto, @CurrentUser() user: JwtUser) {
    return this.notificationsService.create(dto, user.accountId)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNotificationTemplateDto, @CurrentUser() user: JwtUser) {
    return this.notificationsService.update(id, dto, user.accountId)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.remove(id, user.accountId)
  }
}
