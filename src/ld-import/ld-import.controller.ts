import { Body, Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { LdImportService } from './ld-import.service'

@UseGuards(JwtAuthGuard)
@Controller('ld-import')
export class LdImportController {
  constructor(private readonly service: LdImportService) {}

  @Post(':processId/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  preview(@Param('processId') processId: string, @Body('workflowId') workflowId: string,
    @UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    return this.service.preview(user, processId, workflowId, file)
  }

  @Post(':processId/commit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  commit(@Param('processId') processId: string, @Body('workflowId') workflowId: string,
    @Body('expectedHash') expectedHash: string, @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any) {
    return this.service.commit(user, processId, workflowId, file, expectedHash)
  }
}
