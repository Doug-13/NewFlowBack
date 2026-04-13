import { Test, TestingModule } from '@nestjs/testing'
import { MetadataController } from './metadata.controller'
import { MetadataService } from './metadata.service'

describe('MetadataController', () => {
  let controller: MetadataController

  const metadataServiceMock = {
    getByDocument: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({ success: true }),

    findAllDefinitions: jest.fn().mockResolvedValue([]),
    createDefinition: jest.fn().mockImplementation(async (dto) => ({ id: 'def-1', ...dto })),
    updateDefinition: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeDefinition: jest.fn().mockResolvedValue({ success: true }),

    findAllSets: jest.fn().mockResolvedValue([]),
    createSet: jest.fn().mockImplementation(async (dto) => ({ id: 'set-1', ...dto })),
    updateSet: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeSet: jest.fn().mockResolvedValue({ success: true }),
  }

  const mockReq = {
    user: {
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'teste@empresa.com',
      accountId: 'acc-1',
      role: 'admin',
    },
    body: {},
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetadataController],
      providers: [
        {
          provide: MetadataService,
          useValue: metadataServiceMock,
        },
      ],
    }).compile()

    controller = module.get<MetadataController>(MetadataController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('definitions', () => {
    it('findDefs deve retornar um array', async () => {
      const result = await controller.findDefs({}, mockReq)

      expect(Array.isArray(result)).toBe(true)
      expect(metadataServiceMock.findAllDefinitions).toHaveBeenCalledWith({
        accountId: 'acc-1',
        metadataSetId: undefined,
        documentTypeId: undefined,
      })
    })

    it('createDef deve injetar accountId do req quando não vier no dto', async () => {
      const dto = {
        name: 'numero_contrato',
        label: 'Número do Contrato',
        fieldType: 'text',
        isRequired: true,
        isActive: true,
        orderIndex: 1,
        metadataSetId: 'set-1',
      }

      const result = await controller.createDef(dto, mockReq)

      expect(metadataServiceMock.createDefinition).toHaveBeenCalledWith({
        ...dto,
        accountId: 'acc-1',
      })
      expect(result).toEqual({
        id: 'def-1',
        ...dto,
        accountId: 'acc-1',
      })
    })

    it('updateDef deve repassar id e dto', async () => {
      const dto = { label: 'Contrato Nº' }

      const result = await controller.updateDef('def-1', dto, mockReq)

      expect(metadataServiceMock.updateDefinition).toHaveBeenCalledWith('def-1', {
        ...dto,
        accountId: 'acc-1',
      })
      expect(result).toEqual({
        id: 'def-1',
        ...dto,
        accountId: 'acc-1',
      })
    })

    it('removeDef deve remover a definição', async () => {
      const result = await controller.removeDef('def-1')

      expect(metadataServiceMock.removeDefinition).toHaveBeenCalledWith('def-1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('sets', () => {
    it('findSets deve retornar um array', async () => {
      const result = await controller.findSets({}, mockReq)

      expect(Array.isArray(result)).toBe(true)
      expect(metadataServiceMock.findAllSets).toHaveBeenCalledWith('acc-1')
    })

    it('createSet deve injetar accountId do req quando não vier no dto', async () => {
      const dto = {
        name: 'Contratos',
        code: 'contratos',
        description: 'Conjunto de contratos',
        isActive: true,
        orderIndex: 0,
      }

      const result = await controller.createSet(dto, mockReq)

      expect(metadataServiceMock.createSet).toHaveBeenCalledWith({
        ...dto,
        accountId: 'acc-1',
      })
      expect(result).toEqual({
        id: 'set-1',
        ...dto,
        accountId: 'acc-1',
      })
    })

    it('updateSet deve repassar id e dto', async () => {
      const dto = { name: 'Contratos Atualizado' }

      const result = await controller.updateSet('set-1', dto, mockReq)

      expect(metadataServiceMock.updateSet).toHaveBeenCalledWith('set-1', {
        ...dto,
        accountId: 'acc-1',
      })
      expect(result).toEqual({
        id: 'set-1',
        ...dto,
        accountId: 'acc-1',
      })
    })

    it('removeSet deve remover o conjunto', async () => {
      const result = await controller.removeSet('set-1')

      expect(metadataServiceMock.removeSet).toHaveBeenCalledWith('set-1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('values', () => {
    it('getValues deve retornar os valores do documento', async () => {
      const result = await controller.getValues('doc-1')

      expect(metadataServiceMock.getByDocument).toHaveBeenCalledWith('doc-1')
      expect(Array.isArray(result)).toBe(true)
    })

    it('saveValues deve salvar os valores do documento', async () => {
      const dto = {
        values: [
          {
            metadataDefinitionId: 'def-1',
            value: 'ABC-123',
          },
        ],
      }

      const result = await controller.saveValues('doc-1', dto, mockReq)

      expect(metadataServiceMock.save).toHaveBeenCalledWith(
        'doc-1',
        dto,
        'acc-1',
        '',
        '',
        'Usuário Teste',
      )
      expect(result).toEqual({ success: true })
    })
  })
})