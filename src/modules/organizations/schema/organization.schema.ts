import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

// ── Area / Unit ───────────────────────────────────────────────────────────────

export type OrganizationAreaDocument = OrganizationArea & Document

@Schema({ timestamps: true, collection: 'organization_areas' })
export class OrganizationArea {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) name: string
  @Prop() code: string
  @Prop() description: string
  @Prop({ default: 'area' }) type: string   // 'area' | 'unit'
  @Prop() unitId: string                     // área pode pertencer a uma unidade
  @Prop({ default: true }) isActive: boolean
}

export const OrganizationAreaSchema = SchemaFactory.createForClass(OrganizationArea)
OrganizationAreaSchema.index({ accountId: 1, type: 1 })

// ── Role / Discipline ─────────────────────────────────────────────────────────

export type OrganizationRoleDocument = OrganizationRole & Document

@Schema({ timestamps: true, collection: 'organization_roles' })
export class OrganizationRole {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) name: string
  @Prop() code: string
  @Prop() description: string
  @Prop({ default: 'role' }) type: string   // 'role' | 'discipline'
  @Prop({ default: true }) isActive: boolean
}

export const OrganizationRoleSchema = SchemaFactory.createForClass(OrganizationRole)
OrganizationRoleSchema.index({ accountId: 1, type: 1 })

// ── Group ─────────────────────────────────────────────────────────────────────

export type OrganizationGroupDocument = OrganizationGroup & Document

@Schema({ timestamps: true, collection: 'organization_groups' })
export class OrganizationGroup {
  @Prop({ required: true }) accountId: string
  @Prop({ required: true }) name: string
  @Prop() code: string
  @Prop() description: string
  @Prop({ type: [String], default: [] }) memberIds: string[]
  @Prop({ type: [String], default: [] }) memberNames: string[]
  @Prop({ default: true }) isActive: boolean
}

export const OrganizationGroupSchema = SchemaFactory.createForClass(OrganizationGroup)
OrganizationGroupSchema.index({ accountId: 1 })