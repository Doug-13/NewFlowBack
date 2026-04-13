import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Environment, EnvironmentDocument } from './schema/environment.schema'

@Injectable()
export class EnvironmentService {
  constructor(
    @InjectModel(Environment.name)
    private readonly envModel: Model<EnvironmentDocument>,
  ) {}

  async get(accountId: string) {
    const doc = await this.envModel.findOne({ accountId }).lean()
    return doc ?? null
  }

  async save(accountId: string, data: Record<string, any>) {
    return this.envModel.findOneAndUpdate(
      { accountId },
      { $set: { ...data, accountId } },
      { new: true, upsert: true },
    ).lean()
  }
}
