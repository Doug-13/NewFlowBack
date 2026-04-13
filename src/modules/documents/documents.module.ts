import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { DocumentsService }    from './documents.service'
import { DocumentsController } from './documents.controller'
import { WorkflowModule }      from '../workflow/workflow.module'
import { DocumentInstance, DocumentInstanceSchema } from './schema/document.schema'
import { MetadataValue, MetadataValueSchema } from '../metadata/schema/metadata-value.schema'
import { AuditLog, AuditLogSchema }           from '../metadata/schema/audit-log.schema'
import { Task, TaskSchema }                   from '../tasks/schema/task.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentInstance.name, schema: DocumentInstanceSchema },
      { name: MetadataValue.name,    schema: MetadataValueSchema    },
      { name: AuditLog.name,         schema: AuditLogSchema         },
      { name: Task.name,             schema: TaskSchema             },
    ]),
    WorkflowModule,
  ],
  controllers: [DocumentsController],
  providers:   [DocumentsService],
  exports:     [DocumentsService],
})
export class DocumentsModule {}
