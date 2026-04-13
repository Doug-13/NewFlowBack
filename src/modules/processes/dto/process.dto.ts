import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class PermissionSetDto {
  @IsArray() @IsOptional() userIds?:  string[]
  @IsArray() @IsOptional() groupIds?: string[]
}

export class CreateProcessDto {
  @IsString()            accountId:    string
  @IsString()            name:         string
  @IsString() @IsOptional() code?:     string
  @IsString() @IsOptional() description?: string
  @IsString() @IsOptional() workflowId?:  string
  @IsString() @IsOptional() parentProcessId?: string
  @IsBoolean() @IsOptional() isActive?: boolean

  @ValidateNested() @Type(() => PermissionSetDto) @IsOptional()
  permissions?: PermissionSetDto

  @ValidateNested() @Type(() => PermissionSetDto) @IsOptional()
  documentCreation?: PermissionSetDto

  @ValidateNested() @Type(() => PermissionSetDto) @IsOptional()
  documentVisualization?: PermissionSetDto
}

export class UpdateProcessDto {
  @IsString()  @IsOptional() name?:            string
  @IsString()  @IsOptional() code?:            string
  @IsString()  @IsOptional() description?:     string
  @IsString()  @IsOptional() workflowId?:      string
  @IsString()  @IsOptional() parentProcessId?: string
  @IsString()  @IsOptional() status?:          string
  @IsBoolean() @IsOptional() isActive?:        boolean

  @ValidateNested() @Type(() => PermissionSetDto) @IsOptional()
  permissions?: PermissionSetDto

  @ValidateNested() @Type(() => PermissionSetDto) @IsOptional()
  documentCreation?: PermissionSetDto

  @ValidateNested() @Type(() => PermissionSetDto) @IsOptional()
  documentVisualization?: PermissionSetDto
}