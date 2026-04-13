import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { MetadataService } from './metadata.service'
import { MetadataValue } from './schema/metadata-value.schema'
import { AuditLog } from './schema/audit-log.schema'
import { MetadataDefinition } from './schema/metadata-definition.schema'
import { MetadataSet } from './schema/metadata-set.schema'

describe('MetadataService', () => {
  let service: MetadataService

  const metadataValueModelMock = {
    find: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([]),
    })),
    bulkWrite: jest.fn().mockResolvedValue({}),
  }

  const auditLogModelMock = {
    create: jest.fn().mockResolvedValue({}),
  }

  const metadataDefinitionModelMock = {
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([]),
      })),
    })),
    create: jest.fn().mockImplementation(async (dto) => ({
      toObject: () => ({ _id: 'def-1', ...dto }),
    })),
    findByIdAndUpdate: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(null),
    })),
    findByIdAndDelete: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(0),
  }

  const metadataSetModelMock = {
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([]),
      })),
    })),
    findById: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(null),
    })),
    create: jest.fn().mockImplementation(async (dto) => ({
      toObject: () => ({ _id: 'set-1', ...dto }),
    })),
    findByIdAndUpdate: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(null),
    })),
    findByIdAndDelete: jest.fn().mockResolvedValue({}),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetadataService,
        { provide: getModelToken(MetadataValue.name), useValue: metadataValueModelMock },
        { provide: getModelToken(AuditLog.name), useValue: auditLogModelMock },
        { provide: getModelToken(MetadataDefinition.name), useValue: metadataDefinitionModelMock },
        { provide: getModelToken(MetadataSet.name), useValue: metadataSetModelMock },
      ],
    }).compile()

    service = module.get<MetadataService>(MetadataService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('findAllDefinitions', () => {
    it('deve aceitar objeto de filtros', async () => {
      const result = await service.findAllDefinitions({ accountId: 'acc-1' })

      expect(metadataDefinitionModelMock.find).toHaveBeenCalledWith({ accountId: 'acc-1' })
      expect(Array.isArray(result)).toBe(true)
    })

    it('deve aplicar metadataSetId e documentTypeId quando informados', async () => {
      await service.findAllDefinitions({
        accountId: 'acc-1',
        metadataSetId: 'set-1',
        documentTypeId: 'doc-type-1',
      })

      expect(metadataDefinitionModelMock.find).toHaveBeenCalledWith({
        accountId: 'acc-1',
        metadataSetId: 'set-1',
        documentTypeId: 'doc-type-1',
      })
    })
  })

  describe('findAllSets', () => {
    it('deve listar conjuntos por accountId', async () => {
      const result = await service.findAllSets('acc-1')

      expect(metadataSetModelMock.find).toHaveBeenCalledWith({ accountId: 'acc-1' })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('createDefinition', () => {
    it('deve criar uma definição e normalizar o retorno', async () => {
      metadataSetModelMock.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ _id: 'set-1', name: 'Contratos' }),
      })

      const result = await service.createDefinition({
        accountId: 'acc-1',
        name: 'numero_contrato',
        label: 'Número do Contrato',
        fieldType: 'text',
        metadataSetId: 'set-1',
      })

      expect(metadataDefinitionModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc-1',
          name: 'numero_contrato',
          label: 'Número do Contrato',
          fieldType: 'text',
          metadataSetId: 'set-1',
          metadataSetName: 'Contratos',
        }),
      )
      expect(result).toEqual(
        expect.objectContaining({
          id: 'def-1',
          name: 'numero_contrato',
          label: 'Número do Contrato',
        }),
      )
    })
  })

  describe('createSet', () => {
    it('deve criar um conjunto e normalizar o retorno', async () => {
      const result = await service.createSet({
        accountId: 'acc-1',
        name: 'Contratos',
        code: 'contratos',
      })

      expect(metadataSetModelMock.create).toHaveBeenCalledWith({
        accountId: 'acc-1',
        name: 'Contratos',
        code: 'contratos',
        isActive: true,
        orderIndex: 0,
      })
      expect(result).toEqual(
        expect.objectContaining({
          id: 'set-1',
          name: 'Contratos',
          code: 'contratos',
        }),
      )
    })
  })
})