import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto, UpdateUserDto } from './dto/user.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

function normalizeUser(u: any) {
  if (!u) return u
  const obj = u._doc ?? u
  return { ...obj, id: String(obj._id ?? obj.id), _id: undefined, password: undefined }
}

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  async findAll(@CurrentUser() user: JwtUser) {
    // Filtra sempre pelo accountId do usuário logado — isolamento de tenant
    const users = await this.usersService.findAll(user.accountId)
    return users.map(normalizeUser)
  }

  @Get('users/:id')
  async findOne(@Param('id') id: string) {
    return normalizeUser(await this.usersService.findOne(id))
  }

  @Post('users')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtUser) {
    // accountId sempre vem do token — não pode ser sobrescrito pelo body
    return normalizeUser(await this.usersService.create({ ...dto, accountId: user.accountId }))
  }

  @Put('users/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return normalizeUser(await this.usersService.update(id, dto))
  }

  @Patch('users/:id')
  async patch(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return normalizeUser(await this.usersService.update(id, dto))
  }

  @Delete('users/:id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id)
  }

  @Get('userProcessMemberships')
  getMemberships(@CurrentUser() user: JwtUser, @Query() q: any) {
    return this.usersService.findMemberships({
      userId:    q.userId,
      accountId: user.accountId,  // sempre do token
      processId: q.processId,
    })
  }

  @Get('user-process-memberships')
  getMembershipsAlt(@CurrentUser() user: JwtUser, @Query() q: any) {
    return this.usersService.findMemberships({
      userId:    q.userId,
      accountId: user.accountId,
      processId: q.processId,
    })
  }

  @Post('userProcessMemberships')
  createMembership(@Body() b: any, @CurrentUser() user: JwtUser) {
    return this.usersService.createMembership({ ...b, accountId: user.accountId })
  }

  @Get('userAccountMemberships')
  getAccountMemberships(@CurrentUser() user: JwtUser) {
    return this.usersService.findMemberships({ accountId: user.accountId })
  }

  @Get('user-account-memberships')
  getAccountMembershipsAlt(@CurrentUser() user: JwtUser) {
    return this.usersService.findMemberships({ accountId: user.accountId })
  }
}