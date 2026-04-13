import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { WorkflowEngineService, WorkflowStep } from './workflow.service'
import { DocumentInstance } from '../documents/schema/document.schema'
import { Task } from '../tasks/schema/task.schema'
import { MetadataValue } from '../metadata/schema/metadata-value.schema'
import { AuditLog } from '../metadata/schema/audit-log.schema'

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService

  const mockDocModel  = { findById: jest.fn(), findByIdAndUpdate: jest.fn() }
  const mockTaskModel = { create: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() }
  const mockMetaModel = { find: jest.fn().mockResolvedValue([]) }
  const mockAuditModel = { create: jest.fn() }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: getModelToken(DocumentInstance.name), useValue: mockDocModel   },
        { provide: getModelToken(Task.name),             useValue: mockTaskModel  },
        { provide: getModelToken(MetadataValue.name),    useValue: mockMetaModel  },
        { provide: getModelToken(AuditLog.name),         useValue: mockAuditModel },
      ],
    }).compile()

    service = module.get<WorkflowEngineService>(WorkflowEngineService)
  })

  it('deve ser definido', () => expect(service).toBeDefined())

  it('deve filtrar steps operacionais corretamente', () => {
    const steps: WorkflowStep[] = [
      { id: 's1', name: 'Start',    orderIndex: -1, kind: 'start'    },
      { id: 's2', name: 'Análise',  orderIndex: 0,  kind: 'activity' },
      { id: 's3', name: 'Gateway',  orderIndex: 1,  kind: 'gateway'  },
      { id: 's4', name: 'Revisão',  orderIndex: 2,  kind: 'activity' },
    ]
    const op = (service as any).getOperationalSteps(steps)
    expect(op).toHaveLength(2)
    expect(op[0].name).toBe('Análise')
    expect(op[1].name).toBe('Revisão')
  })

  it('findTransition deve encontrar transição correta', () => {
    const step: WorkflowStep = {
      id: 's1', name: 'Análise', orderIndex: 0,
      transitions: [
        { triggerAction: 'approve', toStepOrderIndex: 1 },
        { triggerAction: 'reject',  toStepOrderIndex: 3, intermediateEventIds: ['evt-1'] },
      ],
    }
    const t = (service as any).findTransition(step, 'reject')
    expect(t).toBeDefined()
    expect(t.toStepOrderIndex).toBe(3)
    expect(t.intermediateEventIds).toContain('evt-1')
  })

  it('nextRevision deve incrementar corretamente (numeric)', () => {
    expect((service as any).nextRevision('00', 'numeric', '00')).toBe('01')
    expect((service as any).nextRevision('09', 'numeric', '00')).toBe('10')
  })

  it('nextRevision deve incrementar corretamente (alphabetic)', () => {
    expect((service as any).nextRevision('A',  'alphabetic', 'A')).toBe('B')
    expect((service as any).nextRevision('Z',  'alphabetic', 'A')).toBe('AA')
  })
})
