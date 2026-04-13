import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type ProcessDocument = Process & Document

class PermissionSet {
  userIds:  string[]
  groupIds: string[]
}

@Schema({ timestamps: true, collection: 'processes' })
export class Process {
  @Prop({ required: true }) accountId:    string
  @Prop({ required: true }) name:         string
  @Prop()                   code:         string
  @Prop()                   description:  string
  @Prop()                   workflowId:   string
  @Prop()                   parentProcessId: string
  @Prop({ default: 'active' }) status:   string
  @Prop({ default: true })  isActive:    boolean

  @Prop({ type: { userIds: [String], groupIds: [String] }, default: { userIds: [], groupIds: [] } })
  permissions: PermissionSet

  @Prop({ type: { userIds: [String], groupIds: [String] }, default: { userIds: [], groupIds: [] } })
  documentCreation: PermissionSet

  @Prop({ type: { userIds: [String], groupIds: [String] }, default: { userIds: [], groupIds: [] } })
  documentVisualization: PermissionSet
}

export const ProcessSchema = SchemaFactory.createForClass(Process)
ProcessSchema.index({ accountId: 1 })
ProcessSchema.index({ accountId: 1, status: 1 })