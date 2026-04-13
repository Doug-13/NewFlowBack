import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export const WORKFLOW_STATUS_VALUES = [
  'draft',
  'active',
  'inactive',
  'archived',
] as const

export type WorkflowStatus = (typeof WORKFLOW_STATUS_VALUES)[number]

export const WORKFLOW_SCOPE_LEVEL_VALUES = [
  'account',
  'environment',
  'process',
] as const

export type WorkflowScopeLevel = (typeof WORKFLOW_SCOPE_LEVEL_VALUES)[number]

export class WorkflowPermissionEntryDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  groupIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  environmentIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  processIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  areaIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  disciplineIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  roleIds: string[] = []

  @IsArray()
  @IsString({ each: true })
  unitIds: string[] = []
}

export class WorkflowPermissionsDto {
  @ValidateNested()
  @Type(() => WorkflowPermissionEntryDto)
  visualization: WorkflowPermissionEntryDto = new WorkflowPermissionEntryDto()

  @ValidateNested()
  @Type(() => WorkflowPermissionEntryDto)
  creation: WorkflowPermissionEntryDto = new WorkflowPermissionEntryDto()
}

export class CreateWorkflowDto {
  @IsString()
  @MaxLength(200)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  version?: string

  @IsOptional()
  @IsIn(WORKFLOW_STATUS_VALUES)
  status?: WorkflowStatus

  @IsOptional()
  @IsString()
  documentTypeId?: string

  @IsOptional()
  @IsString()
  documentTypeName?: string

  @IsOptional()
  @IsString()
  processId?: string | null

  @IsOptional()
  @IsString()
  processName?: string | null

  @IsOptional()
  @IsString()
  environmentId?: string | null

  @IsOptional()
  @IsString()
  environmentName?: string | null

  @IsOptional()
  @IsIn(WORKFLOW_SCOPE_LEVEL_VALUES)
  scopeLevel?: WorkflowScopeLevel

  @IsOptional()
  @IsString()
  tenantId?: string | null

  @IsOptional()
  @IsString()
  accountName?: string | null

  @IsOptional()
  @IsString()
  bpmnXml?: string

  @IsOptional()
  stepsCount?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowPermissionsDto)
  permissions?: WorkflowPermissionsDto

  @IsOptional()
  @IsArray()
  elementConfigs?: any[]

  @IsOptional()
  @IsArray()
  snapshots?: any[]

  @IsOptional()
  @IsString()
  publishedAt?: string | null
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  version?: string

  @IsOptional()
  @IsIn(WORKFLOW_STATUS_VALUES)
  status?: WorkflowStatus

  @IsOptional()
  @IsString()
  documentTypeId?: string

  @IsOptional()
  @IsString()
  documentTypeName?: string

  @IsOptional()
  @IsString()
  processId?: string | null

  @IsOptional()
  @IsString()
  processName?: string | null

  @IsOptional()
  @IsString()
  environmentId?: string | null

  @IsOptional()
  @IsString()
  environmentName?: string | null

  @IsOptional()
  @IsIn(WORKFLOW_SCOPE_LEVEL_VALUES)
  scopeLevel?: WorkflowScopeLevel

  @IsOptional()
  @IsString()
  tenantId?: string | null

  @IsOptional()
  @IsString()
  accountName?: string | null

  @IsOptional()
  @IsString()
  bpmnXml?: string

  @IsOptional()
  stepsCount?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowPermissionsDto)
  permissions?: WorkflowPermissionsDto

  @IsOptional()
  @IsArray()
  elementConfigs?: any[]

  @IsOptional()
  @IsArray()
  snapshots?: any[]

  @IsOptional()
  @IsString()
  publishedAt?: string | null
}