import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { TasksService }    from './tasks.service'
import { TasksController } from './tasks.controller'
import { WorkflowModule }  from '../workflow/workflow.module'
import { Task, TaskSchema } from './schema/task.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
    ]),
    WorkflowModule,
  ],
  controllers: [TasksController],
  providers:   [TasksService],
  exports:     [TasksService],
})
export class TasksModule {}
