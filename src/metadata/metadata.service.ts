import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class MetadataService {
  constructor(private readonly prisma: PrismaService) {}

  private definitionDto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      name: item.name,
      label: item.label,
      fieldType: item.field_type,
      maskType: item.mask_type,
      isRequired: item.is_required,
      isActive: item.is_active,
      orderIndex: item.order_index,
      metadataSetId: item.metadata_set_id,
      metadataSetName: item.metadata_set_name,
      documentTypeId: item.document_type_id,
      multipleSelection: item.multiple_selection,
      options: Array.isArray(item.options) ? item.options : [],
      tableColumns: Array.isArray(item.table_columns) ? item.table_columns : [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  async listDefinitions(accountId: string, metadataSetId?: string) {
    const items = await this.prisma.metadata_definitions.findMany({
      where: {
        OR: [
          { account_id: accountId },
          { account_id: null },
        ],
        ...(metadataSetId ? { metadata_set_id: metadataSetId } : {}),
      },
      orderBy: [
        { order_index: 'asc' },
        { label: 'asc' },
      ],
    })

    return items.map((item) => this.definitionDto(item))
  }

  async createDefinition(accountId: string, body: any) {
    const item = await this.prisma.metadata_definitions.create({
      data: {
        account_id: accountId,
        name: body.name,
        label: body.label || body.name,
        field_type: body.fieldType || 'text',
        mask_type: body.maskType ?? null,
        is_required: body.isRequired ?? false,
        is_active: body.isActive ?? true,
        order_index: body.orderIndex ?? 1,
        metadata_set_id: body.metadataSetId || null,
        metadata_set_name: body.metadataSetName || null,
        document_type_id: body.documentTypeId || null,
        multiple_selection: body.multipleSelection ?? false,
        options: Array.isArray(body.options) ? body.options : [],
        table_columns: Array.isArray(body.tableColumns) ? body.tableColumns : [],
      },
    })

    return this.definitionDto(item)
  }

  async updateDefinition(id: string, body: any) {
    const data: any = {
      name: body.name,
      label: body.label,
      field_type: body.fieldType,
      mask_type: body.maskType,
      is_required: body.isRequired,
      is_active: body.isActive,
      order_index: body.orderIndex,
      metadata_set_id: body.metadataSetId,
      metadata_set_name: body.metadataSetName,
      document_type_id: body.documentTypeId,
      multiple_selection: body.multipleSelection,
      options: body.options,
      table_columns: body.tableColumns,
      updated_at: new Date(),
    }

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) delete data[key]
    })

    const item = await this.prisma.metadata_definitions.update({
      where: { id },
      data,
    })

    return this.definitionDto(item)
  }

  async deleteDefinition(id: string) {
    await this.prisma.metadata_definitions.delete({
      where: { id },
    })

    return { success: true }
  }

  async getValues(documentInstanceId: string) {
    const values = await this.prisma.metadata_values.findMany({
      where: { document_instance_id: documentInstanceId },
      orderBy: { created_at: 'asc' },
    })

    if (values.length === 0) return []

    const definitionIds = Array.from(
      new Set(values.map((item) => item.metadata_definition_id)),
    )

    const definitions = await this.prisma.metadata_definitions.findMany({
      where: {
        id: { in: definitionIds },
      },
    })

    const definitionMap = new Map(
      definitions.map((item) => [item.id, item]),
    )

    return values.map((item) => {
      const definition = definitionMap.get(item.metadata_definition_id)

      return {
        metadataDefinitionId: item.metadata_definition_id,
        name: definition?.name ?? item.metadata_definition_id,
        label: definition?.label ?? item.metadata_definition_id,
        fieldType: definition?.field_type ?? 'text',
        maskType: definition?.mask_type ?? null,
        isRequired: definition?.is_required ?? false,
        isReadOnly: false,
        value: item.value,
        options: Array.isArray(definition?.options) ? definition!.options : [],
        tableColumns: Array.isArray(definition?.table_columns)
          ? definition!.table_columns
          : [],
      }
    })
  }

  async saveValues(documentInstanceId: string, values: any[]) {
    const document = await this.prisma.document_instances.findUnique({
      where: { id: documentInstanceId },
    })

    if (!document) {
      throw new NotFoundException('Instância do documento não encontrada.')
    }

    for (const item of values) {
      if (!item?.metadataDefinitionId) continue

      await this.prisma.metadata_values.upsert({
        where: {
          document_instance_id_metadata_definition_id: {
            document_instance_id: documentInstanceId,
            metadata_definition_id: item.metadataDefinitionId,
          },
        },
        update: {
          value: item.value,
          updated_at: new Date(),
        },
        create: {
          document_instance_id: documentInstanceId,
          metadata_definition_id: item.metadataDefinitionId,
          account_id: document.account_id,
          process_id: document.process_id,
          value: item.value,
        },
      })
    }

    return this.getValues(documentInstanceId)
  }

  async getFormFields(documentIdOrInstanceId: string) {
    let document = await this.prisma.document_instances.findUnique({
      where: { id: documentIdOrInstanceId },
    })

    if (!document) {
      const baseDocument = await this.prisma.documents.findUnique({
        where: { id: documentIdOrInstanceId },
      })

      if (baseDocument?.current_instance_id) {
        document = await this.prisma.document_instances.findUnique({
          where: { id: baseDocument.current_instance_id },
        })
      }
    }

    if (!document) {
      throw new NotFoundException('Documento não encontrado.')
    }

    const elementId = document.current_element_id
    if (!elementId) return []

    const activityMetadata =
      await this.prisma.workflow_activity_metadata.findMany({
        where: {
          workflow_id: document.workflow_id,
          element_id: elementId,
        },
        orderBy: { order_index: 'asc' },
      })

    if (activityMetadata.length === 0) return []

    const definitionIds = activityMetadata.map(
      (item) => item.metadata_definition_id,
    )

    const [definitions, values] = await Promise.all([
      this.prisma.metadata_definitions.findMany({
        where: { id: { in: definitionIds } },
      }),
      this.prisma.metadata_values.findMany({
        where: {
          document_instance_id: document.id,
          metadata_definition_id: { in: definitionIds },
        },
      }),
    ])

    const definitionMap = new Map(
      definitions.map((item) => [item.id, item]),
    )
    const valueMap = new Map(
      values.map((item) => [item.metadata_definition_id, item]),
    )

    return activityMetadata
      .map((item) => {
        const definition = definitionMap.get(
          item.metadata_definition_id,
        )
        if (!definition) return null

        const value = valueMap.get(item.metadata_definition_id)

        return {
          workflowId: document!.workflow_id,
          elementId,
          metadataDefinitionId: definition.id,
          name: definition.name,
          label: definition.label,
          fieldType: definition.field_type,
          maskType: definition.mask_type,
          isRequired: item.is_required || definition.is_required,
          isReadOnly: item.is_read_only,
          value: value?.value ?? null,
          options: Array.isArray(definition.options)
            ? definition.options
            : [],
          tableColumns: Array.isArray(definition.table_columns)
            ? definition.table_columns
            : [],
          orderIndex: item.order_index,
          metadataValueId: value?.id ?? null,
          createdAt: value?.created_at ?? null,
          updatedAt: value?.updated_at ?? null,
        }
      })
      .filter(Boolean)
  }
}
