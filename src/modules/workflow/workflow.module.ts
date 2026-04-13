import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WorkflowEngineService } from './workflow.service'
import { DocumentInstance, DocumentInstanceSchema } from '../documents/schema/document.schema'
import { Task, TaskSchema }                         from '../tasks/schema/task.schema'
import { MetadataValue, MetadataValueSchema }       from '../metadata/schema/metadata-value.schema'
import { AuditLog, AuditLogSchema }                 from '../metadata/schema/audit-log.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentInstance.name, schema: DocumentInstanceSchema },
      { name: Task.name,             schema: TaskSchema             },
      { name: MetadataValue.name,    schema: MetadataValueSchema    },
      { name: AuditLog.name,         schema: AuditLogSchema         },
    ]),
  ],
  providers: [WorkflowEngineService],
  exports:   [WorkflowEngineService],
})
export class WorkflowModule {}
