import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProcessesService }    from './processes.service'
import { ProcessesController } from './processes.controller'
import { Process, ProcessSchema } from './schema/process.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Process.name, schema: ProcessSchema },
    ]),
  ],
  controllers: [ProcessesController],
  providers:   [ProcessesService],
  exports:     [ProcessesService],
})
export class ProcessesModule {}
