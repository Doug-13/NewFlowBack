import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type TaskDocument = Task & Document

export class TaskAction {
  id: string
  label: string
  color: string
  outcome: string
  requiresComment: boolean
}

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) processId: string
  @Prop() processName: string

  @Prop({ type: Types.ObjectId, ref: 'DocumentInstance', required: true })
  documentInstanceId: Types.ObjectId

  @Prop() documentTitle: string
  @Prop() documentCode: string
  @Prop({ required: true }) stepName: string
  @Prop({ type: Number, required: true }) stepOrderIndex: number
  @Prop() elementId: string
  @Prop({ required: true }) assignedUserId: string
  @Prop() assignedUserName: string

  @Prop({ type: String, enum: ['pending','completed','cancelled'], default: 'pending' })
  status: string

  @Prop({ type: [String], default: [] }) allowedActions: string[]
  @Prop({ type: [Object], default: [] }) taskActions: TaskAction[]
  @Prop({ default: null }) actionTaken: string | null
  @Prop({ default: null }) comment: string | null
  @Prop() deadlineMode: string
  @Prop() deadlineValue: number
  @Prop({ default: null }) dueDate: Date | null
  @Prop({ default: null }) completedAt: Date | null
}

export const TaskSchema = SchemaFactory.createForClass(Task)
TaskSchema.index({ documentInstanceId: 1, status: 1 })
TaskSchema.index({ assignedUserId: 1, status: 1 })
TaskSchema.index({ accountId: 1, status: 1 })
