import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator'

export class LoginDto {
  @IsEmail()  email: string
  @IsString() password: string
}

export class RegisterDto {
  @IsString()              accountId: string
  @IsString()              name: string
  @IsEmail()               email: string
  @IsString() @MinLength(6) password: string
  @IsString() @IsOptional() role?: string
}