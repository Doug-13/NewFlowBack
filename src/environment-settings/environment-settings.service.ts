import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class EnvironmentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    if (!item) return null

    return {
      id: item.id,
      accountId: item.account_id,
      revision: item.revision,
      creationMode: item.creation_mode,
      codingRule: item.coding_rule,
      sequential: item.sequential,
      deadlines: item.deadlines,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  async get(accountId: string) {
    const item = await this.prisma.environment_settings.findUnique({
      where: { account_id: accountId },
    })

    return this.toDto(item)
  }

  async save(accountId: string, body: any) {
    const item = await this.prisma.environment_settings.upsert({
      where: { account_id: accountId },
      update: {
        revision: body.revision ?? {},
        creation_mode: body.creationMode ?? {},
        coding_rule: body.codingRule ?? {},
        sequential: body.sequential ?? {},
        deadlines: body.deadlines ?? {},
        updated_at: new Date(),
      },
      create: {
        account_id: accountId,
        revision: body.revision ?? {},
        creation_mode: body.creationMode ?? {},
        coding_rule: body.codingRule ?? {},
        sequential: body.sequential ?? {},
        deadlines: body.deadlines ?? {},
      },
    })

    return this.toDto(item)
  }
}
