import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserMembershipDocument = UserMembership & Document

@Schema({ timestamps: true, collection: 'user_process_memberships' })
export class UserMembership {
  @Prop({ required: true }) userId: string
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) processId: string
  @Prop({ default: 'member' }) role: string
  @Prop({ default: true }) isActive: boolean
}

export const UserMembershipSchema = SchemaFactory.createForClass(UserMembership)
UserMembershipSchema.index({ userId: 1 })
UserMembershipSchema.index({ accountId: 1, processId: 1 })