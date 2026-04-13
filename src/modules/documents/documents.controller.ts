import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, HttpCode } from '@nestjs/common'
import { DocumentsService } from './documents.service'
import { CreateDocumentDto } from './dto/create-document.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('document-instances')
  findAll(@CurrentUser() user: JwtUser, @Query() q: any) {
    return this.documentsService.findAll({
      accountId:   user.accountId,  // sempre do token
      processId:   q.processId,
      status:      q.status,
      createdById: q.createdById,
    })
  }

  @Get('document-instances/:id')
  findOne(@Param('id') id: string, @Body() body: any) {
    return this.documentsService.findOne(id, body?.steps ?? [], body?.elementConfigs ?? [])
  }

  @Post('document-instances')
  @HttpCode(201)
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: JwtUser) {
    return this.documentsService.create(
      { ...dto, accountId: user.accountId },
      user.id,
      user.name,
    )
  }

  @Post('document-instances/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.documentsService.cancel(id, user.name)
  }

  @Patch('document-instances/:id/cancel')
  cancelPatch(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.documentsService.cancel(id, user.name)
  }

  @Delete('document-instances/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.documentsService.cancel(id, 'Sistema')
  }
}