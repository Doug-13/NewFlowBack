import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { MetadataService } from './metadata.service'

@UseGuards(JwtAuthGuard)
@Controller('metadata')
export class MetadataController {
  constructor(private readonly service: MetadataService) {}

  @Get('definitions')
  definitions(
    @Query('metadataSetId') metadataSetId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.listDefinitions(user.accountId, metadataSetId)
  }

  @Post('definitions')
  createDefinition(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.createDefinition(user.accountId, body)
  }

  @Put('definitions/:id')
  updateDefinition(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateDefinition(id, body)
  }

  @Delete('definitions/:id')
  deleteDefinition(@Param('id') id: string) {
    return this.service.deleteDefinition(id)
  }

  @Get('values/:documentInstanceId')
  values(@Param('documentInstanceId') documentInstanceId: string) {
    return this.service.getValues(documentInstanceId)
  }

  @Post('values/:documentInstanceId')
  saveValues(
    @Param('documentInstanceId') documentInstanceId: string,
    @Body() body: any,
  ) {
    return this.service.saveValues(documentInstanceId, body?.values ?? [])
  }

  @Get('form-fields/:documentId')
  formFields(@Param('documentId') documentId: string) {
    return this.service.getFormFields(documentId)
  }
}
