import { Controller, Post, Get, Body, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto, RegisterDto } from './dto/auth.dto'
import { Public, CurrentUser, type JwtUser } from '../../common/auth.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.authService.getMe(user.id)
  }

  @Public()
  @Post('logout')
  logout() {
    return { success: true }
  }
}