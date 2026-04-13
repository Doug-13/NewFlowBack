import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common'
import { MetadataService } from './metadata.service'
import {
  CreateMetadataDefinitionDto,
  CreateMetadataSetDto,
  SaveMetadataDto,
} from './dto/save-metadata.dto'

@Controller()
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  // ── Valores por documento ──────────────────────────────────────────────────

  @Get(['metadata/values/:documentId', 'metadataValues/by-document/:documentId'])
  getValues(@Param('documentId') id: string) {
    return this.metadataService.getByDocument(id)
  }

  @Post(['metadata/values/:documentId', 'metadataValues/by-document/:documentId'])
  saveValues(@Param('documentId') id: string, @Body() dto: SaveMetadataDto, @Req() req: any) {
    return this.metadataService.save(
      id,
      dto,
      req.user?.accountId ?? '',
      req.body?.processId ?? '',
      req.body?.stepName ?? '',
      req.user?.name ?? 'Usuário',
    )
  }

  // ── Definições ─────────────────────────────────────────────────────────────

  @Get(['metadataDefinitions', 'metadata/definitions'])
  findDefs(@Query() q: any, @Req() req: any) {
    return this.metadataService.findAllDefinitions({
      accountId: q.accountId ?? q.tenantId ?? req.user?.accountId,
      metadataSetId: q.metadataSetId,
      documentTypeId: q.documentTypeId,
    })
  }

  @Post(['metadataDefinitions', 'metadata/definitions'])
  createDef(@Body() dto: CreateMetadataDefinitionDto, @Req() req: any) {
    return this.metadataService.createDefinition({
      ...dto,
      accountId: dto.accountId ?? req.user?.accountId,
    })
  }

  @Put(['metadataDefinitions/:id', 'metadata/definitions/:id'])
  updateDef(@Param('id') id: string, @Body() dto: Partial<CreateMetadataDefinitionDto>, @Req() req: any) {
    return this.metadataService.updateDefinition(id, {
      ...dto,
      accountId: dto.accountId ?? req.user?.accountId,
    })
  }

  @Patch(['metadataDefinitions/:id', 'metadata/definitions/:id'])
  patchDef(@Param('id') id: string, @Body() dto: Partial<CreateMetadataDefinitionDto>, @Req() req: any) {
    return this.metadataService.updateDefinition(id, {
      ...dto,
      accountId: dto.accountId ?? req.user?.accountId,
    })
  }

  @Delete(['metadataDefinitions/:id', 'metadata/definitions/:id'])
  removeDef(@Param('id') id: string) {
    return this.metadataService.removeDefinition(id)
  }

  // ── Conjuntos ──────────────────────────────────────────────────────────────

  @Get(['metadataSets', 'metadata/sets'])
  findSets(@Query() q: any, @Req() req: any) {
    return this.metadataService.findAllSets(q.accountId ?? q.tenantId ?? req.user?.accountId)
  }

  @Post(['metadataSets', 'metadata/sets'])
  createSet(@Body() dto: CreateMetadataSetDto, @Req() req: any) {
    return this.metadataService.createSet({
      ...dto,
      accountId: dto.accountId ?? req.user?.accountId,
    })
  }

  @Put(['metadataSets/:id', 'metadata/sets/:id'])
  updateSet(@Param('id') id: string, @Body() dto: Partial<CreateMetadataSetDto>, @Req() req: any) {
    return this.metadataService.updateSet(id, {
      ...dto,
      accountId: dto.accountId ?? req.user?.accountId,
    })
  }

  @Patch(['metadataSets/:id', 'metadata/sets/:id'])
  patchSet(@Param('id') id: string, @Body() dto: Partial<CreateMetadataSetDto>, @Req() req: any) {
    return this.metadataService.updateSet(id, {
      ...dto,
      accountId: dto.accountId ?? req.user?.accountId,
    })
  }

  @Delete(['metadataSets/:id', 'metadata/sets/:id'])
  removeSet(@Param('id') id: string) {
    return this.metadataService.removeSet(id)
  }
}