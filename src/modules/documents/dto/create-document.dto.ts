import { IsString, IsOptional, IsObject, IsArray } from 'class-validator'

export class CreateDocumentDto {
  @IsString() title: string
  @IsString() accountId: string
  @IsString() processId: string
  @IsString() @IsOptional() processName?: string
  @IsString() workflowId: string
  @IsString() @IsOptional() workflowName?: string
  @IsString() @IsOptional() createdById?: string
  @IsString() @IsOptional() createdByName?: string
  @IsObject() @IsOptional() initialMetadataValues?: Record<string, unknown>
  // Steps e configs do workflowStorage (frontend) — temporário até backend ter parser BPMN
  @IsArray() @IsOptional() steps?: any[]
  @IsArray() @IsOptional() elementConfigs?: any[]
}
