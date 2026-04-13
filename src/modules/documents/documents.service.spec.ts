import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { DocumentsService } from './documents.service'
import { DocumentInstance } from './schema/document.schema'
import { WorkflowEngineService } from '../workflow/workflow.service'
import { MetadataValue } from '../metadata/schema/metadata-value.schema'
import { AuditLog } from '../metadata/schema/audit-log.schema'
import { Task } from '../tasks/schema/task.schema'

describe('DocumentsService', () => {
  let service: DocumentsService

  const mockDocumentModel = {
    create:       jest.fn(),
    find:         jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
    findById:     jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
  }

  const mockTaskModel = {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
  }

  const mockMetadataModel  = { bulkWrite: jest.fn() }
  const mockAuditModel     = { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }
  const mockWorkflowEngine = { startDocument: jest.fn(), addAuditLog: jest.fn() }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: getModelToken(DocumentInstance.name), useValue: mockDocumentModel },
        { provide: getModelToken(MetadataValue.name),    useValue: mockMetadataModel  },
        { provide: getModelToken(AuditLog.name),         useValue: mockAuditModel     },
        { provide: getModelToken(Task.name),             useValue: mockTaskModel      },
        { provide: WorkflowEngineService,                useValue: mockWorkflowEngine },
      ],
    }).compile()

    service = module.get<DocumentsService>(DocumentsService)
  })

  it('deve ser definido', () => {
    expect(service).toBeDefined()
  })

  it('findAll deve retornar array vazio quando sem documentos', async () => {
    const result = await service.findAll({ accountId: 'acc-1' })
    expect(Array.isArray(result)).toBe(true)
  })
})
