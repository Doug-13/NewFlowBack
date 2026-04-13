import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { TasksService } from './tasks.service'
import { Task } from './schema/task.schema'
import { WorkflowEngineService } from '../workflow/workflow.service'

describe('TasksService', () => {
  let service: TasksService

  const mockTaskModel = {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
    findById: jest.fn().mockResolvedValue({ status: 'pending' }),
  }
  const mockEngine = { executeTaskAction: jest.fn().mockResolvedValue({ success: true }) }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getModelToken(Task.name),  useValue: mockTaskModel },
        { provide: WorkflowEngineService,     useValue: mockEngine    },
      ],
    }).compile()

    service = module.get<TasksService>(TasksService)
  })

  it('deve ser definido', () => expect(service).toBeDefined())

  it('findMyTasks deve retornar array vazio', async () => {
    const result = await service.findMyTasks('user-1')
    expect(Array.isArray(result)).toBe(true)
  })
})
