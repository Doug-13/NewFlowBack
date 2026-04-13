import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type MetadataValueDocument = MetadataValue & Document

@Schema({ timestamps: true, collection: 'metadata_values' })
export class MetadataValue {
  @Prop({ type: Types.ObjectId, ref: 'DocumentInstance', required: true })
  documentInstanceId: Types.ObjectId

  @Prop({ required: true }) metadataDefinitionId: string
  @Prop({ required: true }) accountId: string
  @Prop() processId: string
  @Prop() name: string
  @Prop() label: string
  @Prop({ default: 'text' }) fieldType: string
  @Prop({ default: false }) isRequired: boolean
  @Prop({ type: Object }) value: unknown
}

export const MetadataValueSchema = SchemaFactory.createForClass(MetadataValue)
MetadataValueSchema.index({ documentInstanceId: 1 })
MetadataValueSchema.index(
  { documentInstanceId: 1, metadataDefinitionId: 1 },
  { unique: true },
)
