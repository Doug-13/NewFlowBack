import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  OrganizationArea,  OrganizationAreaDocument,
  OrganizationRole,  OrganizationRoleDocument,
  OrganizationGroup, OrganizationGroupDocument,
} from './schema/organization.schema'
import { CreateAreaDto, CreateRoleDto, CreateGroupDto } from './dto/organization.dto'

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(OrganizationArea.name)  private readonly areaModel:  Model<OrganizationAreaDocument>,
    @InjectModel(OrganizationRole.name)  private readonly roleModel:  Model<OrganizationRoleDocument>,
    @InjectModel(OrganizationGroup.name) private readonly groupModel: Model<OrganizationGroupDocument>,
  ) {}

  private normalize(doc: any) {
    if (!doc) return doc
    const obj = doc._doc ?? doc
    return { ...obj, id: String(obj._id ?? obj.id), _id: undefined }
  }

  private normalizeList(list: any[]) {
    return list.map(this.normalize.bind(this))
  }

  // ── Unidades (reutiliza areaModel com type='unit') ─────────────────────────
  async findAllUnits(accountId: string) {
    const list = await this.areaModel.find({ accountId, type: 'unit' }).lean()
    return this.normalizeList(list)
  }
  async createUnit(dto: any) {
    const doc = await this.areaModel.create({ ...dto, type: 'unit' })
    return this.normalize(doc.toObject())
  }
  async updateUnit(id: string, dto: any) {
    const doc = await this.areaModel.findByIdAndUpdate(id, dto, { new: true }).lean()
    return this.normalize(doc)
  }
  async removeUnit(id: string) {
    await this.areaModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ── Áreas ──────────────────────────────────────────────────────────────────
  async findAllAreas(accountId: string) {
    const list = await this.areaModel.find({ accountId, type: { $ne: 'unit' } }).lean()
    return this.normalizeList(list)
  }
  async createArea(dto: any) {
    const doc = await this.areaModel.create({ ...dto, type: 'area' })
    return this.normalize(doc.toObject())
  }
  async updateArea(id: string, dto: any) {
    const doc = await this.areaModel.findByIdAndUpdate(id, dto, { new: true }).lean()
    return this.normalize(doc)
  }
  async removeArea(id: string) {
    await this.areaModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ── Disciplinas (reutiliza roleModel com type='discipline') ────────────────
  async findAllDisciplines(accountId: string) {
    const list = await this.roleModel.find({ accountId, type: 'discipline' }).lean()
    return this.normalizeList(list)
  }
  async createDiscipline(dto: any) {
    const doc = await this.roleModel.create({ ...dto, type: 'discipline' })
    return this.normalize(doc.toObject())
  }
  async updateDiscipline(id: string, dto: any) {
    const doc = await this.roleModel.findByIdAndUpdate(id, dto, { new: true }).lean()
    return this.normalize(doc)
  }
  async removeDiscipline(id: string) {
    await this.roleModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ── Funções ────────────────────────────────────────────────────────────────
  async findAllRoles(accountId: string) {
    const list = await this.roleModel.find({ accountId, type: { $ne: 'discipline' } }).lean()
    return this.normalizeList(list)
  }
  async createRole(dto: any) {
    const doc = await this.roleModel.create({ ...dto, type: 'role' })
    return this.normalize(doc.toObject())
  }
  async updateRole(id: string, dto: any) {
    const doc = await this.roleModel.findByIdAndUpdate(id, dto, { new: true }).lean()
    return this.normalize(doc)
  }
  async removeRole(id: string) {
    await this.roleModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ── Grupos ─────────────────────────────────────────────────────────────────
  async findAllGroups(accountId: string) {
    const list = await this.groupModel.find({ accountId }).lean()
    return this.normalizeList(list)
  }
  async createGroup(dto: any) {
    const doc = await this.groupModel.create(dto)
    return this.normalize(doc.toObject())
  }
  async updateGroup(id: string, dto: any) {
    const doc = await this.groupModel.findByIdAndUpdate(id, dto, { new: true }).lean()
    return this.normalize(doc)
  }
  async removeGroup(id: string) {
    await this.groupModel.findByIdAndDelete(id)
    return { success: true }
  }
}