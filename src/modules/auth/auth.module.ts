import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuthService }    from './auth.service'
import { AuthController } from './auth.controller'
import { User, UserSchema } from './schema/user.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // JwtModule removido — usa o global registrado no AppModule
  ],
  controllers: [AuthController],
  providers:   [AuthService],
  exports:     [AuthService, MongooseModule],
})
export class AuthModule {}