import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

export class MetadataOptionDto {
  @IsString()
  value: string

  @IsString()
  label: string

  @IsOptional()
  @IsString()
  sigla?: string
}

export class MetadataTableColumnDto {
  @IsString()
  id: string

  @IsString()
  metadataDefinitionId: string

  @IsString()
  internalName: string

  @IsString()
  externalName: string

  @IsString()
  fieldType: string

  @IsNumber()
  orderIndex: number
}

export class SaveMetadataValueItemDto {
  @IsString()
  metadataDefinitionId: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  fieldType?: string

  @IsOptional()
  @IsString()
  maskType?: string | null

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @IsOptional()
  value?: unknown

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataOptionDto)
  options?: MetadataOptionDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataTableColumnDto)
  tableColumns?: MetadataTableColumnDto[]
}

export class SaveMetadataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveMetadataValueItemDto)
  values: SaveMetadataValueItemDto[]
}

export class CreateMetadataDefinitionDto {
  @IsOptional()
  @IsString()
  accountId?: string

  @IsString()
  name: string

  @IsString()
  label: string

  @IsString()
  fieldType: string

  @IsOptional()
  @IsString()
  maskType?: string | null

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  orderIndex?: number

  @IsOptional()
  @IsString()
  metadataSetId?: string

  @IsOptional()
  @IsString()
  metadataSetName?: string

  @IsOptional()
  @IsString()
  documentTypeId?: string

  @IsOptional()
  @IsBoolean()
  multipleSelection?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataOptionDto)
  options?: MetadataOptionDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataTableColumnDto)
  tableColumns?: MetadataTableColumnDto[]
}

export class CreateMetadataSetDto {
  @IsOptional()
  @IsString()
  accountId?: string

  @IsString()
  name: string

  @IsString()
  code: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  orderIndex?: number
}