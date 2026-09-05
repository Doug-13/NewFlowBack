import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    return {
      id: item.id,
      publicId: item.public_id,
      accountId: item.account_id,
      accountName: item.account_name,
      processId: item.process_id,
      processName: item.process_name,
      environmentId: item.environment_id,
      environmentName: item.environment_name,
      name: item.name,
      description: item.description,
      version: item.version,
      status: item.status,
      documentTypeId: item.document_type_id,
      documentTypeName: item.document_type_name,
      bpmnXml: item.bpmn_xml,
      stepsCount: item.steps_count,
      permissions: item.permissions,
      elementConfigs: item.element_configs,
      snapshots: item.snapshots,
      scopeLevel: item.scope_level,
      tenantId: item.tenant_id,
      publishedAt: item.published_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      elements: Array.isArray(item.workflow_elements)
        ? item.workflow_elements.map((element: any) => ({
            id: element.id,
            publicId: element.public_id,
            workflowId: element.workflow_id,
            accountId: element.account_id,
            processId: element.process_id,
            processName: element.process_name,
            elementId: element.element_id,
            elementType: element.element_type,
            elementKind: element.element_kind,
            name: element.name,
            description: element.description,
            orderIndex: element.order_index,
            isStart: element.is_start,
            isEnd: element.is_end,
            isExecutable: element.is_executable,
            config: element.config,
            createdAt: element.created_at,
            updatedAt: element.updated_at,
          }))
        : [],
      transitions: Array.isArray(item.workflow_transitions)
        ? item.workflow_transitions.map((transition: any) => ({
            id: transition.id,
            publicId: transition.public_id,
            workflowId: transition.workflow_id,
            accountId: transition.account_id,
            processId: transition.process_id,
            processName: transition.process_name,
            sequenceFlowId: transition.sequence_flow_id,
            sourceElementId: transition.source_element_id,
            targetElementId: transition.target_element_id,
            name: transition.name,
            label: transition.label,
            outcome: transition.outcome,
            conditionType: transition.condition_type,
            metadataFieldId: transition.metadata_field_id,
            expectedValue: transition.expected_value,
            expression: transition.expression,
            isDefault: transition.is_default,
            orderIndex: transition.order_index,
            config: transition.config,
            createdAt: transition.created_at,
            updatedAt: transition.updated_at,
          }))
        : [],
    }
  }

  private includeGraph() {
    return {
      workflow_elements: {
        orderBy: { order_index: 'asc' as const },
      },
      workflow_transitions: {
        orderBy: { order_index: 'asc' as const },
      },
    }
  }

  async list(accountId: string, processId?: string) {
    const items = await this.prisma.workflows.findMany({
      where: {
        account_id: accountId,
        ...(processId ? { process_id: processId } : {}),
      },
      include: this.includeGraph(),
      orderBy: { updated_at: 'desc' },
    })

    return items.map((item) => this.toDto(item))
  }

  async get(id: string) {
    const item = await this.prisma.workflows.findUniqueOrThrow({
      where: { id },
      include: this.includeGraph(),
    })

    return this.toDto(item)
  }

  async create(accountId: string, body: any) {
    const item = await this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflows.create({
        data: {
          public_id: randomUUID(),
          account_id: accountId,
          process_id: body.processId || null,
          process_name: body.processName || null,
          environment_id: body.environmentId || null,
          environment_name: body.environmentName || null,
          name: body.name,
          description: body.description ?? '',
          version: body.version ?? '1.0',
          status: body.status ?? 'draft',
          document_type_id: body.documentTypeId || null,
          document_type_name: body.documentTypeName || null,
          bpmn_xml: body.bpmnXml ?? '',
          steps_count: body.stepsCount ?? 0,
          permissions: body.permissions ?? {},
          element_configs: Array.isArray(body.elementConfigs)
            ? body.elementConfigs
            : [],
          snapshots: Array.isArray(body.snapshots)
            ? body.snapshots
            : [],
          scope_level: body.scopeLevel ?? (body.processId ? 'process' : 'account'),
          tenant_id: body.tenantId || accountId,
          account_name: body.accountName || null,
          published_at: body.publishedAt
            ? new Date(body.publishedAt)
            : null,
        },
      })

      await this.replaceGraph(tx, workflow.id, accountId, body)

      return tx.workflows.findUniqueOrThrow({
        where: { id: workflow.id },
        include: this.includeGraph(),
      })
    })

    return this.toDto(item)
  }

  async update(id: string, body: any) {
    const current = await this.prisma.workflows.findUniqueOrThrow({
      where: { id },
    })

    const data: any = {
      process_id: body.processId,
      process_name: body.processName,
      environment_id: body.environmentId,
      environment_name: body.environmentName,
      name: body.name,
      description: body.description,
      version: body.version,
      status: body.status,
      document_type_id: body.documentTypeId,
      document_type_name: body.documentTypeName,
      bpmn_xml: body.bpmnXml,
      steps_count: body.stepsCount,
      permissions: body.permissions,
      element_configs: body.elementConfigs,
      snapshots: body.snapshots,
      scope_level: body.scopeLevel,
      tenant_id: body.tenantId,
      account_name: body.accountName,
      published_at:
        body.publishedAt === null
          ? null
          : body.publishedAt
            ? new Date(body.publishedAt)
            : undefined,
      updated_at: new Date(),
    }

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) delete data[key]
    })

    const item = await this.prisma.$transaction(async (tx) => {
      await tx.workflows.update({
        where: { id },
        data,
      })

      if (
        Array.isArray(body.elements) ||
        Array.isArray(body.transitions) ||
        Array.isArray(body.activityConfigs) ||
        Array.isArray(body.activityActions) ||
        Array.isArray(body.activityMetadata)
      ) {
        await this.replaceGraph(tx, id, current.account_id, body)
      }

      return tx.workflows.findUniqueOrThrow({
        where: { id },
        include: this.includeGraph(),
      })
    })

    return this.toDto(item)
  }

  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.workflow_activity_actions.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_config_users.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_config_roles.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_config_groups.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_config_areas.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_config_disciplines.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_config_positions.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_configs.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflow_activity_metadata.deleteMany({
        where: { workflow_id: id },
      })
      await tx.workflows.delete({
        where: { id },
      })
    })

    return { success: true }
  }

  private async replaceGraph(
    tx: any,
    workflowId: string,
    accountId: string,
    body: any,
  ) {
    if (Array.isArray(body.elements)) {
      await tx.workflow_elements.deleteMany({
        where: { workflow_id: workflowId },
      })

      if (body.elements.length > 0) {
        await tx.workflow_elements.createMany({
          data: body.elements.map((element: any, index: number) => ({
            public_id: randomUUID(),
            workflow_id: workflowId,
            account_id: accountId,
            process_id: body.processId || null,
            process_name: body.processName || null,
            element_id: element.elementId,
            element_type: element.elementType,
            element_kind: element.elementKind,
            name: element.name ?? null,
            description: element.description ?? null,
            order_index: element.orderIndex ?? index,
            is_start: element.isStart ?? false,
            is_end: element.isEnd ?? false,
            is_executable: element.isExecutable ?? true,
            config: element.config ?? {},
          })),
        })
      }
    }

    if (Array.isArray(body.transitions)) {
      await tx.workflow_transitions.deleteMany({
        where: { workflow_id: workflowId },
      })

      if (body.transitions.length > 0) {
        await tx.workflow_transitions.createMany({
          data: body.transitions.map((transition: any, index: number) => ({
            public_id: randomUUID(),
            workflow_id: workflowId,
            account_id: accountId,
            process_id: body.processId || null,
            process_name: body.processName || null,
            sequence_flow_id: transition.sequenceFlowId,
            source_element_id: transition.sourceElementId,
            target_element_id: transition.targetElementId,
            name: transition.name ?? null,
            label: transition.label ?? null,
            outcome: transition.outcome ?? null,
            condition_type: transition.conditionType ?? 'always',
            metadata_field_id: transition.metadataFieldId ?? null,
            expected_value: transition.expectedValue ?? null,
            expression: transition.expression ?? null,
            is_default: transition.isDefault ?? false,
            order_index: transition.orderIndex ?? index,
            config: transition.config ?? {},
          })),
        })
      }
    }

    const hasActivityPayload =
      Array.isArray(body.activityConfigs) ||
      Array.isArray(body.activityActions) ||
      Array.isArray(body.activityMetadata)

    if (!hasActivityPayload) return

    await tx.workflow_activity_actions.deleteMany({
      where: { workflow_id: workflowId },
    })
    await tx.workflow_activity_config_users.deleteMany({
      where: { workflow_id: workflowId },
    })
    await tx.workflow_activity_config_roles.deleteMany({
      where: { workflow_id: workflowId },
    })
    await tx.workflow_activity_config_groups.deleteMany({
      where: { workflow_id: workflowId },
    })
    await tx.workflow_activity_config_areas.deleteMany({
      where: { workflow_id: workflowId },
    })
    await tx.workflow_activity_configs.deleteMany({
      where: { workflow_id: workflowId },
    })
    await tx.workflow_activity_metadata.deleteMany({
      where: { workflow_id: workflowId },
    })

    if (Array.isArray(body.activityConfigs)) {
      for (const config of body.activityConfigs) {
        await tx.workflow_activity_configs.create({
          data: {
            workflow_id: workflowId,
            element_id: config.elementId,
            element_name: config.elementName ?? null,
            activity_type: config.activityType ?? 'activity',
            assignment_mode: config.assignmentMode ?? 'user',
            deadline_mode: config.deadlineMode ?? null,
            deadline_value: config.deadlineValue ?? null,
            deadline_fixed_at: config.deadlineFixedAt
              ? new Date(config.deadlineFixedAt)
              : null,
            instructions: config.instructions ?? null,
            help_text: config.helpText ?? null,
            background_color: config.backgroundColor ?? null,
            border_color: config.borderColor ?? null,
            text_color: config.textColor ?? null,
            icon_name: config.iconName ?? null,
            allow_approve: config.allowApprove ?? false,
            allow_reject: config.allowReject ?? false,
            allow_request_changes: config.allowRequestChanges ?? false,
            allow_forward: config.allowForward ?? false,
            allow_comment: config.allowComment ?? true,
            allow_attachment: config.allowAttachment ?? true,
            notify_on_enter: config.notifyOnEnter ?? false,
            notify_on_exit: config.notifyOnExit ?? false,
            linked_workflow_id: config.linkedWorkflowId || null,
          },
        })

        const userIds = Array.isArray(config.responsibleUserIds)
          ? config.responsibleUserIds
          : []
        if (userIds.length) {
          await tx.workflow_activity_config_users.createMany({
            data: userIds.map((userId: string, index: number) => ({
              workflow_id: workflowId,
              element_id: config.elementId,
              user_id: userId,
              order_index: index,
            })),
          })
        }

        const roleIds = Array.isArray(config.responsibleRoleIds)
          ? config.responsibleRoleIds
          : []
        if (roleIds.length) {
          await tx.workflow_activity_config_roles.createMany({
            data: roleIds.map((roleId: string, index: number) => ({
              workflow_id: workflowId,
              element_id: config.elementId,
              role_id: roleId,
              order_index: index,
            })),
          })
        }

        const groupIds = Array.isArray(config.responsibleGroupIds)
          ? config.responsibleGroupIds
          : []
        if (groupIds.length) {
          await tx.workflow_activity_config_groups.createMany({
            data: groupIds.map((groupId: string, index: number) => ({
              workflow_id: workflowId,
              element_id: config.elementId,
              group_id: groupId,
              order_index: index,
            })),
          })
        }

        const areaIds = Array.isArray(config.responsibleAreaIds)
          ? config.responsibleAreaIds
          : []
        if (areaIds.length) {
          await tx.workflow_activity_config_areas.createMany({
            data: areaIds.map((areaId: string, index: number) => ({
              workflow_id: workflowId,
              element_id: config.elementId,
              area_id: areaId,
              order_index: index,
            })),
          })
        }
      }
    }

    if (
      Array.isArray(body.activityActions) &&
      body.activityActions.length > 0
    ) {
      await tx.workflow_activity_actions.createMany({
        data: body.activityActions.map((action: any, index: number) => ({
          workflow_id: workflowId,
          element_id: action.elementId,
          action_key: action.actionKey,
          action_name: action.actionName,
          action_label: action.actionLabel,
          description: action.description ?? null,
          outcome: action.outcome ?? null,
          button_color: action.buttonColor ?? null,
          text_color: action.textColor ?? null,
          icon_name: action.iconName ?? null,
          next_element_id: action.nextElementId ?? null,
          order_index: action.orderIndex ?? index,
          is_default: action.isDefault ?? false,
          is_active: action.isActive ?? true,
          requires_comment: action.requiresComment ?? false,
          requires_attachment: action.requiresAttachment ?? false,
          confirmation_message: action.confirmationMessage ?? null,
        })),
      })
    }

    if (
      Array.isArray(body.activityMetadata) &&
      body.activityMetadata.length > 0
    ) {
      await tx.workflow_activity_metadata.createMany({
        data: body.activityMetadata.map((item: any, index: number) => ({
          workflow_id: workflowId,
          element_id: item.elementId,
          metadata_definition_id: item.metadataDefinitionId,
          is_required: item.isRequired ?? false,
          is_read_only: item.isReadOnly ?? false,
          order_index: item.orderIndex ?? index,
        })),
      })
    }
  }
}
