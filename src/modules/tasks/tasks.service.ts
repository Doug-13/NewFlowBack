import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Task, TaskDocument } from './schema/task.schema'
import { WorkflowEngineService } from '../workflow/workflow.service'
import { ExecuteTaskDto } from './dto/execute-task.dto'

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async findMyTasks(userId: string, steps: any[] = []) {
    const tasks = await this.taskModel
      .find({ assignedUserId: userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean()

    return tasks.map((t: any) => {
      let taskActions = t.taskActions ?? []
      if (!taskActions.length && steps.length) {
        const s = steps.find((s: any) => s.orderIndex === t.stepOrderIndex)
        if (s?.actions?.length) taskActions = s.actions
      }
      return {
        id:                 String(t._id),
        documentInstanceId: String(t.documentInstanceId),
        documentTitle:      t.documentTitle,
        documentCode:       t.documentCode,
        stepName:           t.stepName,
        stepOrderIndex:     t.stepOrderIndex,
        assignedToUserId:   t.assignedUserId,
        assignedToUserName: t.assignedUserName,
        status:             t.status,
        dueAt:              t.dueDate,
        createdAt:          t.createdAt,
        allowedActions:     t.allowedActions ?? [],
        taskActions,
      }
    })
  }

  async execute(
    taskId: string,
    dto: ExecuteTaskDto,
    executorId: string,
    executorName: string,
  ) {
    const task = await this.taskModel.findById(taskId)
    if (!task) throw new NotFoundException(`Tarefa ${taskId} não encontrada`)
    if (task.status !== 'pending') throw new BadRequestException('Tarefa já concluída')

    return this.workflowEngine.executeTaskAction(
      {
        taskId,
        outcome:      dto.action,
        comment:      dto.comment,
        executorId,
        executorName,
      },
      dto.steps ?? [],
      dto.elementConfigs ?? [],
    )
  }
}
