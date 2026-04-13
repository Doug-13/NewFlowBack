import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserDocument = User & Document

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) name: string
  @Prop({ required: true, unique: true }) email: string
  @Prop({ required: true, select: false }) password: string
  @Prop({ default: 'user' }) role: string
  @Prop({ default: true }) isActive: boolean
}

export const UserSchema = SchemaFactory.createForClass(User)
UserSchema.index({ accountId: 1 })
UserSchema.index({ email: 1 }, { unique: true })
