import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { MetadataValue, MetadataValueDocument } from './schema/metadata-value.schema'
import { AuditLog, AuditLogDocument } from './schema/audit-log.schema'
import { MetadataDefinition, MetadataDefinitionDocument } from './schema/metadata-definition.schema'
import { MetadataSet, MetadataSetDocument } from './schema/metadata-set.schema'
import {
  CreateMetadataDefinitionDto,
  CreateMetadataSetDto,
  SaveMetadataDto,
} from './dto/save-metadata.dto'

@Injectable()
export class MetadataService {
  constructor(
    @InjectModel(MetadataValue.name)
    private readonly metadataValueModel: Model<MetadataValueDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(MetadataDefinition.name)
    private readonly metadataDefinitionModel: Model<MetadataDefinitionDocument>,
    @InjectModel(MetadataSet.name)
    private readonly metadataSetModel: Model<MetadataSetDocument>,
  ) {}

  private normalize<T = any>(doc: any): T {
    if (!doc) return doc
    const obj = doc._doc ?? doc

    return {
      ...obj,
      id: String(obj._id ?? obj.id),
      _id: undefined,
      __v: undefined,
    }
  }

  private normalizeList<T = any>(list: any[]): T[] {
    return list.map((item) => this.normalize<T>(item))
  }

  private isValidObjectId(value?: string | null) {
    return !!value && Types.ObjectId.isValid(value)
  }

  private async resolveMetadataSetName(metadataSetId?: string | null) {
    if (!this.isValidObjectId(metadataSetId)) return undefined

    const set = await this.metadataSetModel.findById(metadataSetId).lean()
    return set?.name
  }

  // ── Valores por documento ──────────────────────────────────────────────────

  async getByDocument(documentId: string, steps: any[] = []) {
    const opSteps = steps.filter(
      (s: any) => !['start', 'end', 'gateway', 'flow'].includes(s.kind ?? ''),
    )

    const savedValues = await this.metadataValueModel
      .find({ documentInstanceId: new Types.ObjectId(documentId) })
      .lean()

    const savedMap = new Map(savedValues.map((v: any) => [v.metadataDefinitionId, v]))

    if (!opSteps.length) {
      return savedValues.map((v: any) => ({
        metadataDefinitionId: v.metadataDefinitionId,
        name: v.name ?? '',
        label: v.label ?? '',
        fieldType: v.fieldType ?? 'text',
        maskType: v.maskType ?? null,
        isRequired: Boolean(v.isRequired),
        isReadOnly: true,
        value: v.value ?? null,
        options: v.options ?? [],
        tableColumns: v.tableColumns ?? [],
      }))
    }

    return savedValues.map((v: any) => ({
      metadataDefinitionId: v.metadataDefinitionId,
      name: v.name ?? '',
      label: v.label ?? '',
      fieldType: v.fieldType ?? 'text',
      maskType: v.maskType ?? null,
      isRequired: Boolean(v.isRequired),
      isReadOnly: false,
      value: savedMap.get(v.metadataDefinitionId)?.value ?? null,
      options: v.options ?? [],
      tableColumns: v.tableColumns ?? [],
    }))
  }

  async save(
    documentId: string,
    dto: SaveMetadataDto,
    accountId: string,
    processId: string,
    stepName: string,
    userName: string,
  ) {
    const ids = dto.values
      .map((item) => item.metadataDefinitionId)
      .filter((id) => this.isValidObjectId(id))
      .map((id) => new Types.ObjectId(id))

    const definitions = ids.length
      ? await this.metadataDefinitionModel.find({ _id: { $in: ids } }).lean()
      : []

    const definitionMap = new Map(definitions.map((item: any) => [String(item._id), item]))

    const ops = dto.values.map((value) => {
      const def = definitionMap.get(value.metadataDefinitionId)

      return {
        updateOne: {
          filter: {
            documentInstanceId: new Types.ObjectId(documentId),
            metadataDefinitionId: value.metadataDefinitionId,
          },
          update: {
            $set: {
              documentInstanceId: new Types.ObjectId(documentId),
              metadataDefinitionId: value.metadataDefinitionId,
              accountId,
              processId,
              name: value.name ?? def?.name ?? '',
              label: value.label ?? def?.label ?? '',
              fieldType: value.fieldType ?? def?.fieldType ?? 'text',
              maskType: value.maskType ?? def?.maskType ?? null,
              isRequired: Boolean(value.isRequired ?? def?.isRequired),
              options: value.options ?? def?.options ?? [],
              tableColumns: value.tableColumns ?? def?.tableColumns ?? [],
              value: value.value,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      }
    })

    if (ops.length) {
      await this.metadataValueModel.bulkWrite(ops)
    }

    await this.auditLogModel.create({
      documentInstanceId: new Types.ObjectId(documentId),
      action: 'MetadataSaved',
      stepName: stepName ?? null,
      userName: userName ?? null,
      comment: null,
    })

    return { success: true }
  }

  // ── Definições ─────────────────────────────────────────────────────────────

  async findAllDefinitions(params?: {
    accountId?: string
    metadataSetId?: string
    documentTypeId?: string
  }) {
    const query: Record<string, any> = {}

    if (params?.accountId) query.accountId = params.accountId
    if (params?.metadataSetId) query.metadataSetId = params.metadataSetId
    if (params?.documentTypeId) query.documentTypeId = params.documentTypeId

    const list = await this.metadataDefinitionModel
      .find(query)
      .sort({ orderIndex: 1, label: 1 })
      .lean()

    const setIds = Array.from(
      new Set(
        list
          .map((item: any) => item.metadataSetId)
          .filter((id: string | undefined) => this.isValidObjectId(id)),
      ),
    )

    const sets = setIds.length
      ? await this.metadataSetModel.find({ _id: { $in: setIds } }).lean()
      : []

    const setNameMap = new Map(sets.map((item: any) => [String(item._id), item.name]))

    return this.normalizeList(list).map((item: any) => ({
      ...item,
      metadataSetName: item.metadataSetName ?? setNameMap.get(item.metadataSetId) ?? '',
      options: item.options ?? [],
      tableColumns: item.tableColumns ?? [],
    }))
  }

  async createDefinition(dto: CreateMetadataDefinitionDto) {
    const metadataSetName =
      dto.metadataSetName ?? (await this.resolveMetadataSetName(dto.metadataSetId)) ?? ''

    const doc = await this.metadataDefinitionModel.create({
      ...dto,
      metadataSetName,
      maskType: dto.maskType ?? null,
      isRequired: dto.isRequired ?? false,
      isActive: dto.isActive ?? true,
      orderIndex: dto.orderIndex ?? 1,
      multipleSelection: dto.multipleSelection ?? false,
      options: dto.options ?? [],
      tableColumns: dto.tableColumns ?? [],
    })

    return this.normalize(doc.toObject())
  }

  async updateDefinition(id: string, dto: Partial<CreateMetadataDefinitionDto>) {
    const metadataSetName = dto.metadataSetId
      ? await this.resolveMetadataSetName(dto.metadataSetId)
      : dto.metadataSetName

    const def = await this.metadataDefinitionModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          ...(metadataSetName !== undefined ? { metadataSetName } : {}),
        },
        { new: true },
      )
      .lean()

    if (!def) {
      throw new NotFoundException(`Definição ${id} não encontrada`)
    }

    return this.normalize(def)
  }

  async removeDefinition(id: string) {
    await this.metadataDefinitionModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ── Conjuntos ──────────────────────────────────────────────────────────────

  async findAllSets(accountId?: string) {
    const query = accountId ? { accountId } : {}

    const list = await this.metadataSetModel
      .find(query)
      .sort({ orderIndex: 1, name: 1 })
      .lean()

    return this.normalizeList(list)
  }

  async createSet(dto: CreateMetadataSetDto) {
    const doc = await this.metadataSetModel.create({
      ...dto,
      isActive: dto.isActive ?? true,
      orderIndex: dto.orderIndex ?? 0,
    })

    return this.normalize(doc.toObject())
  }

  async updateSet(id: string, dto: Partial<CreateMetadataSetDto>) {
    const doc = await this.metadataSetModel.findByIdAndUpdate(id, dto, { new: true }).lean()

    if (!doc) {
      throw new NotFoundException(`Conjunto ${id} não encontrado`)
    }

    return this.normalize(doc)
  }

  async removeSet(id: string) {
    const linkedDefinitions = await this.metadataDefinitionModel.countDocuments({ metadataSetId: id })

    if (linkedDefinitions > 0) {
      throw new BadRequestException(
        'Não é possível remover o conjunto porque existem metadados vinculados a ele.',
      )
    }

    await this.metadataSetModel.findByIdAndDelete(id)
    return { success: true }
  }
}