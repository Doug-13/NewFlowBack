import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { IsEmail, IsString } from 'class-validator'
import { AuthService } from './auth.service'
import { CurrentUser } from './current-user.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'

class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  password: string
}

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.service.login(body.email, body.password)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: any) {
    return this.service.me(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return { success: true }
  }
}
