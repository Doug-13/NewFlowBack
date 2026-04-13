import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type MetadataSetDocument = MetadataSet & Document

@Schema({ timestamps: true, collection: 'metadata_sets' })
export class MetadataSet {
  @Prop()
  accountId?: string

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  code: string

  @Prop()
  description?: string

  @Prop({ default: true })
  isActive: boolean

  @Prop({ default: 0 })
  orderIndex: number
}

export const MetadataSetSchema = SchemaFactory.createForClass(MetadataSet)
MetadataSetSchema.index({ accountId: 1, code: 1 }, { unique: false })