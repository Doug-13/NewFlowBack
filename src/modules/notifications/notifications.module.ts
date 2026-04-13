import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { NotificationsService }    from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationTemplate, NotificationTemplateSchema } from './schema/notification-template.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers:   [NotificationsService],
  exports:     [NotificationsService],
})
export class NotificationsModule {}
