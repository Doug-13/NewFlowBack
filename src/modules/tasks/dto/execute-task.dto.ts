import { IsString, IsOptional, IsArray } from 'class-validator'

export class ExecuteTaskDto {
  @IsString()
  action: string

  @IsString()
  @IsOptional()
  comment?: string

  // Steps e elementConfigs enviados pelo frontend para o motor de workflow
  @IsArray()
  @IsOptional()
  steps?: any[]

  @IsArray()
  @IsOptional()
  elementConfigs?: any[]
}
