import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type NotificationTemplateDocument = NotificationTemplate & Document

@Schema({ timestamps: true, collection: 'notification_templates' })
export class NotificationTemplate {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) name: string
  @Prop({ required: true }) code: string
  @Prop() description: string
  @Prop({ required: true, enum: ['email', 'system', 'whatsapp'] }) channel: string
  @Prop() subject: string
  @Prop({ required: true }) body: string
  @Prop({ default: true }) isActive: boolean
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate)
NotificationTemplateSchema.index({ accountId: 1 })
NotificationTemplateSchema.index({ accountId: 1, code: 1 }, { unique: true })
