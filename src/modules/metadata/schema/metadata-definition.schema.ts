import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type MetadataOption = {
  value: string
  label: string
  sigla?: string
}

export type MetadataTableColumn = {
  id: string
  metadataDefinitionId: string
  internalName: string
  externalName: string
  fieldType: string
  orderIndex: number
}

export type MetadataDefinitionDocument = MetadataDefinition & Document

@Schema({ timestamps: true, collection: 'metadata_definitions' })
export class MetadataDefinition {
  @Prop()
  accountId?: string

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  label: string

  @Prop({ required: true })
  fieldType: string

  @Prop({ default: null })
  maskType?: string | null

  @Prop({ default: false })
  isRequired: boolean

  @Prop({ default: true })
  isActive: boolean

  @Prop({ default: 1 })
  orderIndex: number

  @Prop()
  metadataSetId?: string

  @Prop()
  metadataSetName?: string

  @Prop()
  documentTypeId?: string

  @Prop({ default: false })
  multipleSelection?: boolean

  @Prop({
    type: [
      {
        value: { type: String, required: true },
        label: { type: String, required: true },
        sigla: { type: String, required: false },
      },
    ],
    default: [],
  })
  options?: MetadataOption[]

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        metadataDefinitionId: { type: String, required: true },
        internalName: { type: String, required: true },
        externalName: { type: String, required: true },
        fieldType: { type: String, required: true },
        orderIndex: { type: Number, required: true, default: 0 },
      },
    ],
    default: [],
  })
  tableColumns?: MetadataTableColumn[]
}

export const MetadataDefinitionSchema = SchemaFactory.createForClass(MetadataDefinition)

MetadataDefinitionSchema.index({ accountId: 1, metadataSetId: 1, orderIndex: 1 })
MetadataDefinitionSchema.index({ accountId: 1, name: 1 })