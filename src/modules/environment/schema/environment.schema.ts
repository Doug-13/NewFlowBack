import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type EnvironmentDocument = Environment & Document

@Schema({ timestamps: true, collection: 'environment_settings' })
export class Environment {
  @Prop({ required: true, unique: true }) accountId: string
  @Prop({ type: Object, default: {} }) revision: Record<string, any>
  @Prop({ type: Object, default: {} }) creationMode: Record<string, any>
  @Prop({ type: Object, default: {} }) codingRule: Record<string, any>
  @Prop({ type: Object, default: {} }) sequential: Record<string, any>
  @Prop({ type: Object, default: {} }) deadlines: Record<string, any>
}

export const EnvironmentSchema = SchemaFactory.createForClass(Environment)
EnvironmentSchema.index({ accountId: 1 }, { unique: true })
