import { randomUUID } from 'crypto'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'

export type WorkflowDocument = HydratedDocument<Workflow>

@Schema({ _id: false })
export class WorkflowPermissionEntry {
  @Prop({ type: [String], default: [] })
  userIds!: string[]

  @Prop({ type: [String], default: [] })
  groupIds!: string[]

  @Prop({ type: [String], default: [] })
  environmentIds!: string[]

  @Prop({ type: [String], default: [] })
  processIds!: string[]

  @Prop({ type: [String], default: [] })
  areaIds!: string[]

  @Prop({ type: [String], default: [] })
  disciplineIds!: string[]

  @Prop({ type: [String], default: [] })
  roleIds!: string[]

  @Prop({ type: [String], default: [] })
  unitIds!: string[]
}

export const WorkflowPermissionEntrySchema =
  SchemaFactory.createForClass(WorkflowPermissionEntry)

@Schema({ _id: false })
export class WorkflowPermissions {
  @Prop({
    type: WorkflowPermissionEntrySchema,
    default: () => ({
      userIds: [],
      groupIds: [],
      environmentIds: [],
      processIds: [],
      areaIds: [],
      disciplineIds: [],
      roleIds: [],
      unitIds: [],
    }),
  })
  visualization!: WorkflowPermissionEntry

  @Prop({
    type: WorkflowPermissionEntrySchema,
    default: () => ({
      userIds: [],
      groupIds: [],
      environmentIds: [],
      processIds: [],
      areaIds: [],
      disciplineIds: [],
      roleIds: [],
      unitIds: [],
    }),
  })
  creation!: WorkflowPermissionEntry
}

export const WorkflowPermissionsSchema =
  SchemaFactory.createForClass(WorkflowPermissions)

@Schema({
  timestamps: true,
  collection: 'workflows',
})
export class Workflow {
  @Prop({
    type: String,
    required: true,
    default: () => randomUUID(),
    unique: true,
    index: true,
  })
  id!: string

  @Prop({ required: true, index: true })
  accountId!: string

  @Prop({ type: String, default: null, index: true })
  processId?: string | null

  @Prop({ type: String, default: null })
  processName?: string | null

  @Prop({ type: String, default: null })
  environmentId?: string | null

  @Prop({ type: String, default: null })
  environmentName?: string | null

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ type: String, default: '' })
  description?: string

  @Prop({ type: String, default: '1.0' })
  version!: string

  @Prop({
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft',
  })
  status!: 'draft' | 'active' | 'inactive' | 'archived'

  @Prop({ type: String, default: null })
  documentTypeId?: string | null

  @Prop({ type: String, default: null })
  documentTypeName?: string | null

  @Prop({ type: String, default: '' })
  bpmnXml!: string

  @Prop({ type: Number, default: 0 })
  stepsCount!: number

  @Prop({
    type: WorkflowPermissionsSchema,
    default: () => ({
      visualization: {
        userIds: [],
        groupIds: [],
        environmentIds: [],
        processIds: [],
        areaIds: [],
        disciplineIds: [],
        roleIds: [],
        unitIds: [],
      },
      creation: {
        userIds: [],
        groupIds: [],
        environmentIds: [],
        processIds: [],
        areaIds: [],
        disciplineIds: [],
        roleIds: [],
        unitIds: [],
      },
    }),
  })
  permissions!: WorkflowPermissions

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  elementConfigs!: any[]

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  snapshots!: any[]

  @Prop({
    type: String,
    enum: ['account', 'environment', 'process'],
    default: 'process',
  })
  scopeLevel!: 'account' | 'environment' | 'process'

  @Prop({ type: String, default: null })
  tenantId?: string | null

  @Prop({ type: String, default: null })
  accountName?: string | null

  @Prop({ type: Date, default: null })
  publishedAt?: Date | null
}

export const WorkflowSchema = SchemaFactory.createForClass(Workflow)

WorkflowSchema.index(
  { accountId: 1, processId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      processId: { $type: 'string' },
    },
  },
)