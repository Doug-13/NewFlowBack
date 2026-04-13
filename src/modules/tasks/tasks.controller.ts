import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common'
import { TasksService } from './tasks.service'
import { ExecuteTaskDto } from './dto/execute-task.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('my')
  findMy(@CurrentUser() user: JwtUser) {
    return this.tasksService.findMyTasks(user.id)
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @Body() dto: ExecuteTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasksService.execute(id, dto, user.id, user.name)
  }
}