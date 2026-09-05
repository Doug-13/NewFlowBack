import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProcessesService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      name: item.name,
      code: item.code,
      description: item.description,
      workflowId: item.workflow_id,
      parentProcessId: item.parent_process_id,
      status: item.status,
      isActive: item.is_active,
      permissions: item.permissions,
      documentCreation: item.document_creation,
      documentVisualization: item.document_visualization,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  async list(accountId: string) {
    const items = await this.prisma.processes.findMany({
      where: { account_id: accountId },
      orderBy: { name: 'asc' },
    })
    return items.map((item) => this.toDto(item))
  }

  async get(id: string) {
    return this.toDto(
      await this.prisma.processes.findUniqueOrThrow({ where: { id } }),
    )
  }

  async create(data: any, accountId: string) {
    const item = await this.prisma.processes.create({
      data: {
        account_id: data.accountId || accountId,
        name: data.name,
        code: data.code,
        description: data.description,
        workflow_id: data.workflowId || null,
        parent_process_id: data.parentProcessId || null,
        status: data.status || 'active',
        is_active: data.isActive ?? true,
        permissions: data.permissions ?? { userIds: [], groupIds: [] },
        document_creation: data.documentCreation ?? { userIds: [], groupIds: [] },
        document_visualization: data.documentVisualization ?? { userIds: [], groupIds: [] },
      },
    })
    return this.toDto(item)
  }

  async update(id: string, data: any) {
    const payload: any = {
      name: data.name,
      code: data.code,
      description: data.description,
      workflow_id: data.workflowId,
      parent_process_id: data.parentProcessId,
      status: data.status,
      is_active: data.isActive,
      permissions: data.permissions,
      document_creation: data.documentCreation,
      document_visualization: data.documentVisualization,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])

    return this.toDto(
      await this.prisma.processes.update({ where: { id }, data: payload }),
    )
  }

  async remove(id: string) {
    await this.prisma.processes.delete({ where: { id } })
    return { success: true }
  }
}
