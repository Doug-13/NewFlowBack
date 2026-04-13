import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Process, ProcessDocument } from './schema/process.schema'
import { CreateProcessDto, UpdateProcessDto } from './dto/process.dto'

@Injectable()
export class ProcessesService {
  constructor(
    @InjectModel(Process.name)
    private readonly processModel: Model<ProcessDocument>,
  ) {}

  findAll(accountId?: string) {
    return this.processModel.find(accountId ? { accountId } : {}).lean()
  }

  async findOne(id: string) {
    this.assertValidId(id)
    const p = await this.processModel.findById(id).lean()
    if (!p) throw new NotFoundException(`Processo ${id} não encontrado`)
    return p
  }

  create(dto: CreateProcessDto) {
    return this.processModel.create(dto)
  }

  async update(id: string, dto: UpdateProcessDto) {
    this.assertValidId(id)
    const p = await this.processModel.findByIdAndUpdate(id, dto, { new: true })
    if (!p) throw new NotFoundException(`Processo ${id} não encontrado`)
    return p
  }

  async remove(id: string) {
    this.assertValidId(id)
    await this.processModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ─── Lança 400 antes de chegar no Mongoose, evitando o CastError ─────────
  private assertValidId(id: string) {
    if (!id || id === 'undefined' || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`ID de processo inválido: "${id}"`)
    }
  }
}