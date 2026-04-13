import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UsersService }    from './users.service'
import { UsersController } from './users.controller'
import { AuthModule }      from '../auth/auth.module'
import { UserMembership, UserMembershipSchema } from './schema/user-membership.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserMembership.name, schema: UserMembershipSchema },
    ]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
