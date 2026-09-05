import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      processId: item.process_id,
      processName: item.process_name,
      title: item.title,
      code: item.code,
      revision: item.revision,
      status: item.status,
      workflowId: item.workflow_id,
      workflowName: item.workflow_name,
      currentStepName: item.current_step_name,
      currentStepOrderIndex: item.current_step_order_index,
      createdById: item.created_by_id,
      createdByName: item.created_by_name,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  async summary(accountId: string, processId?: string) {
    const where: any = {
      account_id: accountId,
      ...(processId ? { process_id: processId } : {}),
    }

    const [total, inProgress, completed, published, cancelled, archived, recent] =
      await Promise.all([
        this.prisma.document_instances.count({ where }),
        this.prisma.document_instances.count({ where: { ...where, status: 'in_progress' } }),
        this.prisma.document_instances.count({ where: { ...where, status: 'completed' } }),
        this.prisma.document_instances.count({ where: { ...where, status: 'published' } }),
        this.prisma.document_instances.count({ where: { ...where, status: 'cancelled' } }),
        this.prisma.document_instances.count({ where: { ...where, status: 'archived' } }),
        this.prisma.document_instances.findMany({
          where,
          orderBy: { updated_at: 'desc' },
          take: 10,
        }),
      ])

    return {
      total,
      totalDocuments: total,
      inProgress,
      completed,
      published,
      cancelled,
      archived,
      recentDocuments: recent.map((item) => this.toDto(item)),
    }
  }
}
