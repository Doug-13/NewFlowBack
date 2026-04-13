import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { ProcessesService } from './processes.service'
import { CreateProcessDto, UpdateProcessDto } from './dto/process.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

function normalize(doc: any) {
  if (!doc) return doc
  const obj = doc.toObject ? doc.toObject() : { ...doc }
  obj.id = String(obj._id)
  return obj
}

@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Get()
  async findAll(@CurrentUser() user: JwtUser, @Query() q: any) {
    const docs = await this.processesService.findAll(user.accountId)
    return docs.map(normalize)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return normalize(await this.processesService.findOne(id))
  }

  @Post()
  async create(@Body() dto: CreateProcessDto, @CurrentUser() user: JwtUser) {
    return normalize(await this.processesService.create({ ...dto, accountId: user.accountId }))
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProcessDto) {
    return normalize(await this.processesService.update(id, dto))
  }

  @Patch(':id')
  async patch(@Param('id') id: string, @Body() dto: UpdateProcessDto) {
    return normalize(await this.processesService.update(id, dto))
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.processesService.remove(id)
  }
}