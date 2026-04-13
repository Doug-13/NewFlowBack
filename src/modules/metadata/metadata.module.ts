import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MetadataController } from './metadata.controller'
import { MetadataService } from './metadata.service'
import { MetadataValue, MetadataValueSchema } from './schema/metadata-value.schema'
import { AuditLog, AuditLogSchema } from './schema/audit-log.schema'
import { MetadataDefinition, MetadataDefinitionSchema } from './schema/metadata-definition.schema'
import { MetadataSet, MetadataSetSchema } from './schema/metadata-set.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MetadataValue.name, schema: MetadataValueSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: MetadataDefinition.name, schema: MetadataDefinitionSchema },
      { name: MetadataSet.name, schema: MetadataSetSchema },
    ]),
  ],
  controllers: [MetadataController],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}