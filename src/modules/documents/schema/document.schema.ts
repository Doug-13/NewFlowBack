import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type DocumentInstanceDocument = DocumentInstance & Document

export type DocumentStatus =
  | 'draft' | 'in_progress' | 'approved' | 'rejected'
  | 'published' | 'archived' | 'cancelled'

@Schema({ timestamps: true, collection: 'document_instances' })
export class DocumentInstance {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) processId: string
  @Prop() processName: string
  @Prop({ required: true }) title: string
  @Prop({ required: true, unique: true }) code: string
  @Prop({ default: '00' }) revision: string

  @Prop({ type: Types.ObjectId, ref: 'DocumentInstance', default: null })
  parentDocumentId: Types.ObjectId | null

  @Prop({
    type: String,
    enum: ['draft','in_progress','approved','rejected','published','archived','cancelled'],
    default: 'draft',
  })
  status: DocumentStatus

  @Prop({ required: true }) workflowId: string
  @Prop() workflowName: string
  @Prop({ default: null }) currentStepName: string | null
  @Prop({ type: Number, default: null }) currentStepOrderIndex: number | null
  @Prop() responsibleId: string
  @Prop() responsibleName: string
  @Prop({ required: true }) createdById: string
  @Prop() createdByName: string
  @Prop({ default: null }) dueDate: Date | null
}

export const DocumentInstanceSchema = SchemaFactory.createForClass(DocumentInstance)

DocumentInstanceSchema.index({ accountId: 1, status: 1 })
DocumentInstanceSchema.index({ accountId: 1, processId: 1 })
DocumentInstanceSchema.index({ workflowId: 1, currentStepOrderIndex: 1 })
DocumentInstanceSchema.index({ createdById: 1 })
DocumentInstanceSchema.index({ parentDocumentId: 1 })
