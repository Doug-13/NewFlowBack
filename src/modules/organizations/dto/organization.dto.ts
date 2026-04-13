import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator'

export class CreateAreaDto {
  @IsString()  @IsOptional() accountId?: string
  @IsString()  name: string
  @IsString()  @IsOptional() code?: string
  @IsString()  @IsOptional() description?: string
  @IsString()  @IsOptional() unitId?: string
  @IsBoolean() @IsOptional() isActive?: boolean
}

export class CreateRoleDto {
  @IsString()  @IsOptional() accountId?: string
  @IsString()  name: string
  @IsString()  @IsOptional() code?: string
  @IsString()  @IsOptional() description?: string
  @IsBoolean() @IsOptional() isActive?: boolean
}

export class CreateGroupDto {
  @IsString()  @IsOptional() accountId?: string
  @IsString()  name: string
  @IsString()  @IsOptional() code?: string
  @IsString()  @IsOptional() description?: string
  @IsArray()   @IsOptional() memberIds?: string[]
  @IsArray()   @IsOptional() memberNames?: string[]
  @IsBoolean() @IsOptional() isActive?: boolean
}