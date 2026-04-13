import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, isValidObjectId, Model } from 'mongoose'
import { Workflow, WorkflowDocument } from './schema/workflow.schema'
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto'

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectModel(Workflow.name)
    private readonly workflowModel: Model<WorkflowDocument>,
  ) {}

  private buildWorkflowIdentityFilter(
    id: string,
    accountId: string,
  ): FilterQuery<WorkflowDocument> {
    if (isValidObjectId(id)) {
      return {
        accountId,
        $or: [{ id }, { _id: id }],
      }
    }

    return {
      accountId,
      id,
    }
  }

  private isSameWorkflowRecord(existing: any, compareId?: string) {
    if (!existing || !compareId) return false

    const existingStringId =
      typeof existing.id === 'string' ? existing.id : undefined

    const existingMongoId =
      existing._id ? String(existing._id) : undefined

    return (
      existingStringId === compareId ||
      existingMongoId === compareId
    )
  }

  async findAll(accountId: string) {
    return this.workflowModel
      .find({ accountId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()
  }

  async findOne(id: string, accountId: string) {
    const wf = await this.workflowModel
      .findOne(this.buildWorkflowIdentityFilter(id, accountId))
      .lean()

    if (!wf) {
      throw new NotFoundException(`Workflow ${id} não encontrado`)
    }

    return wf
  }

  async findByProcess(processId: string, accountId: string) {
    return this.workflowModel
      .findOne({ processId, accountId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()
  }

  private async ensureUniqueProcessWorkflow(
    processId: string | null | undefined,
    accountId: string,
    ignoreId?: string,
  ) {
    if (!processId) return

    const existing = await this.workflowModel
      .findOne({ accountId, processId })
      .lean()

    if (!existing) return

    if (this.isSameWorkflowRecord(existing, ignoreId)) {
      return
    }

    throw new ConflictException(
      `O processo ${processId} já possui um workflow vinculado.`,
    )
  }

  async create(dto: CreateWorkflowDto, accountId: string) {
    await this.ensureUniqueProcessWorkflow(dto.processId, accountId)

    const created = await this.workflowModel.create({
      ...dto,
      accountId,
      tenantId: dto.tenantId ?? accountId,
      version: dto.version ?? '1.0',
      status: dto.status ?? 'draft',
      bpmnXml: dto.bpmnXml ?? '',
      stepsCount: dto.stepsCount ?? 0,
      elementConfigs: dto.elementConfigs ?? [],
      snapshots: dto.snapshots ?? [],
      scopeLevel:
        dto.scopeLevel ??
        (dto.processId ? 'process' : dto.environmentId ? 'environment' : 'account'),
      permissions: dto.permissions ?? {
        visualization: {
          userIds: [],
          groupIds: [],
          environmentIds: [],
          processIds: [],
          areaIds: [],
          disciplineIds: [],
          roleIds: [],
          unitIds: [],
        },
        creation: {
          userIds: [],
          groupIds: [],
          environmentIds: [],
          processIds: [],
          areaIds: [],
          disciplineIds: [],
          roleIds: [],
          unitIds: [],
        },
      },
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
    })

    return created.toObject()
  }

  async update(id: string, dto: UpdateWorkflowDto, accountId: string) {
    const current = await this.workflowModel
      .findOne(this.buildWorkflowIdentityFilter(id, accountId))
      .lean()

    if (!current) {
      throw new NotFoundException(`Workflow ${id} não encontrado`)
    }

    const nextProcessId =
      dto.processId !== undefined ? dto.processId : current.processId

    await this.ensureUniqueProcessWorkflow(nextProcessId, accountId, id)

    const payload: Record<string, any> = { ...dto }

    if (dto.publishedAt !== undefined) {
      payload.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null
    }

    const wf = await this.workflowModel.findOneAndUpdate(
      this.buildWorkflowIdentityFilter(id, accountId),
      { $set: payload },
      {
        new: true,
        runValidators: true,
      },
    )

    if (!wf) {
      throw new NotFoundException(`Workflow ${id} não encontrado`)
    }

    return wf.toObject()
  }

  async remove(id: string, accountId: string) {
    const removed = await this.workflowModel.findOneAndDelete(
      this.buildWorkflowIdentityFilter(id, accountId),
    )

    if (!removed) {
      throw new NotFoundException(`Workflow ${id} não encontrado`)
    }

    return { success: true }
  }
}