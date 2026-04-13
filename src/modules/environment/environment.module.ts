import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { EnvironmentService }    from './environment.service'
import { EnvironmentController } from './environment.controller'
import { Environment, EnvironmentSchema } from './schema/environment.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Environment.name, schema: EnvironmentSchema },
    ]),
  ],
  controllers: [EnvironmentController],
  providers:   [EnvironmentService],
  exports:     [EnvironmentService],
})
export class EnvironmentModule {}
