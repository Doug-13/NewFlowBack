import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type AuditLogDocument = AuditLog & Document

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'DocumentInstance', required: true })
  documentInstanceId: Types.ObjectId

  @Prop({ required: true }) action: string
  @Prop({ default: null })  stepName: string | null
  @Prop({ default: null })  userName: string | null
  @Prop({ default: null })  comment: string | null
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog)
AuditLogSchema.index({ documentInstanceId: 1, createdAt: -1 })
