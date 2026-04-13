import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator'

export class CreateNotificationTemplateDto {
  @IsString()  name: string
  @IsString()  code: string
  @IsString()  @IsOptional() description?: string
  @IsString()  @IsIn(['email', 'system', 'whatsapp']) channel: string
  @IsString()  @IsOptional() subject?: string
  @IsString()  body: string
  @IsBoolean() @IsOptional() isActive?: boolean
}

export class UpdateNotificationTemplateDto {
  @IsString()  @IsOptional() name?: string
  @IsString()  @IsOptional() code?: string
  @IsString()  @IsOptional() description?: string
  @IsString()  @IsOptional() @IsIn(['email', 'system', 'whatsapp']) channel?: string
  @IsString()  @IsOptional() subject?: string
  @IsString()  @IsOptional() body?: string
  @IsBoolean() @IsOptional() isActive?: boolean
}
