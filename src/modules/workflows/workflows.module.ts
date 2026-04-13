import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WorkflowsService } from './workflows.service'
import { WorkflowsController } from './workflows.controller'
import { Workflow, WorkflowSchema } from './schema/workflow.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
    ]),
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}