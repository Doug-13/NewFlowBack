import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator'

export class CreateUserDto {
  @IsString()  accountId: string
  @IsString()  name: string
  @IsEmail()   email: string
  @IsString()  @IsOptional() password?: string
  @IsString()  @IsOptional() role?: string
  @IsString()  @IsOptional() cpf?: string
  @IsString()  @IsOptional() phone?: string
  @IsString()  @IsOptional() photoUrl?: string
  @IsString()  @IsOptional() department?: string
  @IsString()  @IsOptional() jobTitle?: string
  @IsString()  @IsOptional() position?: string
  @IsBoolean() @IsOptional() isActive?: boolean
  @IsString()  @IsOptional() notes?: string
}

export class UpdateUserDto {
  @IsString()  @IsOptional() name?: string
  @IsEmail()   @IsOptional() email?: string
  @IsString()  @IsOptional() password?: string
  @IsString()  @IsOptional() role?: string
  @IsString()  @IsOptional() cpf?: string
  @IsString()  @IsOptional() phone?: string
  @IsString()  @IsOptional() photoUrl?: string
  @IsString()  @IsOptional() department?: string
  @IsString()  @IsOptional() jobTitle?: string
  @IsString()  @IsOptional() position?: string
  @IsBoolean() @IsOptional() isActive?: boolean
  @IsString()  @IsOptional() notes?: string
}