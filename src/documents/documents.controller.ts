import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DocumentsService } from './documents.service'

const uploadDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

@UseGuards(JwtAuthGuard)
@Controller('document-instances')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get('my')
  my(@Query() query: any, @CurrentUser() user: any) {
    return this.service.my(query, user)
  }

  @Get(':id/instances')
  instances(@Param('id') id: string) {
    return this.service.instances(id)
  }

  @Get(':id/references')
  references(@Param('id') id: string) {
    return this.service.references(id)
  }

  @Get(':id/audit-logs')
  auditLogs(@Param('id') id: string) {
    return this.service.auditLogs(id)
  }

  @Get(':id/action-history')
  actionHistory(@Param('id') id: string) {
    return this.service.actionHistory(id)
  }

  @Get(':id/files')
  files(@Param('id') id: string) {
    return this.service.files(id)
  }

  @Get(':id/files/:fileId/download')
  async download(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const files = await this.service.files(id)
    const file = files.find((item) => item.id === fileId)

    if (!file) {
      return res.status(404).json({ message: 'Arquivo não encontrado.' })
    }

    return res.download(join(process.cwd(), file.storageKey), file.originalName)
  }

  @Post(':id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, callback) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
          callback(null, `${unique}${extname(file.originalname)}`)
        },
      }),
    }),
  )
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.createFile(id, file, body, user)
  }

  @Delete(':id/files/:fileId')
  async deleteFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: any,
  ) {
    const result = await this.service.deleteFile(id, fileId, user)
    const absolute = join(process.cwd(), result.storageKey)
    if (existsSync(absolute)) unlinkSync(absolute)
    return { success: true }
  }

  @Post(':id/actions')
  action(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.executeAction(id, body, user)
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.changeStatus(id, 'cancelled', user, body)
  }

  @Patch(':id/reopen')
  reopen(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.changeStatus(id, 'in_progress', user, body)
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.changeStatus(id, 'archived', user, body)
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.changeStatus(id, 'published', user, body)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Get()
  list(@Query() query: any, @CurrentUser() user: any) {
    return this.service.list(query, user)
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.service.create(body, user)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.update(id, body, user)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
