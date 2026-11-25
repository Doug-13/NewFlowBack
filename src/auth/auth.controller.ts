import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import { LoginThrottleService } from './login-throttle.service'
import { AuthService } from './auth.service'
import { CurrentUser } from './current-user.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'

class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password: string
}

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService, private readonly throttle: LoginThrottleService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: Request) {
    // Do not trust X-Forwarded-For unless the reverse proxy is explicitly configured.
    const ip = request.ip || request.socket?.remoteAddress || 'unknown'
    this.throttle.assertAllowed(body.email, ip)
    try {
      const result = await this.service.login(body.email, body.password)
      this.throttle.clear(body.email, ip)
      return result
    } catch (error) {
      if (error instanceof UnauthorizedException) this.throttle.registerFailure(body.email, ip)
      throw error
    }
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
