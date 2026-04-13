import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { NotificationTemplate, NotificationTemplateDocument } from './schema/notification-template.schema'
import { CreateNotificationTemplateDto, UpdateNotificationTemplateDto } from './dto/notification-template.dto'

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationTemplate.name)
    private readonly templateModel: Model<NotificationTemplateDocument>,
  ) {}

  private normalize(doc: any) {
    if (!doc) return doc
    const obj = doc._doc ?? doc
    return { ...obj, id: String(obj._id ?? obj.id), _id: undefined }
  }

  async findAll(accountId: string) {
    const list = await this.templateModel.find({ accountId }).sort({ name: 1 }).lean()
    return list.map(this.normalize)
  }

  async findOne(id: string, accountId: string) {
    const doc = await this.templateModel.findOne({ _id: id, accountId }).lean()
    if (!doc) throw new NotFoundException(`Template ${id} não encontrado`)
    return this.normalize(doc)
  }

  async create(dto: CreateNotificationTemplateDto, accountId: string) {
    const existing = await this.templateModel.findOne({ accountId, code: dto.code })
    if (existing) throw new BadRequestException(`Código "${dto.code}" já existe nesta conta`)
    try {
      const doc = await this.templateModel.create({ ...dto, accountId })
      return this.normalize(doc.toObject())
    } catch (err: any) {
      if (err?.code === 11000) throw new BadRequestException(`Código "${dto.code}" já existe`)
      throw err
    }
  }

  async update(id: string, dto: UpdateNotificationTemplateDto, accountId: string) {
    try {
      const doc = await this.templateModel
        .findOneAndUpdate({ _id: id, accountId }, dto, { new: true })
        .lean()
      if (!doc) throw new NotFoundException(`Template ${id} não encontrado`)
      return this.normalize(doc)
    } catch (err: any) {
      if (err?.code === 11000) throw new BadRequestException('Código já existe')
      throw err
    }
  }

  async remove(id: string, accountId: string) {
    await this.templateModel.findOneAndDelete({ _id: id, accountId })
    return { success: true }
  }
}
