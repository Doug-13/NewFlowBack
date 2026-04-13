import { Test, TestingModule } from '@nestjs/testing'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import type { JwtUser } from '../../common/auth.decorator'

describe('OrganizationsController', () => {
  let controller: OrganizationsController

  const serviceMock = {
    findAllUnits: jest.fn().mockResolvedValue([]),
    createUnit: jest.fn().mockImplementation(async (dto) => ({ id: 'unit-1', ...dto })),
    updateUnit: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeUnit: jest.fn().mockResolvedValue({ success: true }),

    findAllAreas: jest.fn().mockResolvedValue([]),
    createArea: jest.fn().mockImplementation(async (dto) => ({ id: 'area-1', ...dto })),
    updateArea: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeArea: jest.fn().mockResolvedValue({ success: true }),

    findAllDisciplines: jest.fn().mockResolvedValue([]),
    createDiscipline: jest.fn().mockImplementation(async (dto) => ({ id: 'discipline-1', ...dto })),
    updateDiscipline: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeDiscipline: jest.fn().mockResolvedValue({ success: true }),

    findAllRoles: jest.fn().mockResolvedValue([]),
    createRole: jest.fn().mockImplementation(async (dto) => ({ id: 'role-1', ...dto })),
    updateRole: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeRole: jest.fn().mockResolvedValue({ success: true }),

    findAllGroups: jest.fn().mockResolvedValue([]),
    createGroup: jest.fn().mockImplementation(async (dto) => ({ id: 'group-1', ...dto })),
    updateGroup: jest.fn().mockImplementation(async (id, dto) => ({ id, ...dto })),
    removeGroup: jest.fn().mockResolvedValue({ success: true }),
  }

  const mockUser: JwtUser = {
    id: 'user-1',
    email: 'teste@empresa.com',
    role: 'admin',
    accountId: 'account-1',
    name: 'Usuário Teste',
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: serviceMock,
        },
      ],
    }).compile()

    controller = module.get<OrganizationsController>(OrganizationsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('units', () => {
    it('getUnits deve retornar um array', async () => {
      const result = await controller.getUnits(mockUser)

      expect(Array.isArray(result)).toBe(true)
      expect(serviceMock.findAllUnits).toHaveBeenCalledWith(mockUser.accountId)
    })
  })

  describe('areas', () => {
    it('getAreas deve retornar um array', async () => {
      const result = await controller.getAreas(mockUser)

      expect(Array.isArray(result)).toBe(true)
      expect(serviceMock.findAllAreas).toHaveBeenCalledWith(mockUser.accountId)
    })

    it('createArea deve injetar o accountId do usuário autenticado', async () => {
      const dto = {
        name: 'Área Financeira',
        code: 'FIN',
        description: 'Área responsável por finanças',
        isActive: true,
      }

      await controller.createArea(dto, mockUser)

      expect(serviceMock.createArea).toHaveBeenCalledWith({
        ...dto,
        accountId: mockUser.accountId,
      })
    })
  })

  describe('roles', () => {
    it('getRoles deve retornar um array', async () => {
      const result = await controller.getRoles(mockUser)

      expect(Array.isArray(result)).toBe(true)
      expect(serviceMock.findAllRoles).toHaveBeenCalledWith(mockUser.accountId)
    })
  })

  describe('disciplines', () => {
    it('getDisciplines deve retornar um array', async () => {
      const result = await controller.getDisciplines(mockUser)

      expect(Array.isArray(result)).toBe(true)
      expect(serviceMock.findAllDisciplines).toHaveBeenCalledWith(mockUser.accountId)
    })
  })

  describe('groups', () => {
    it('getGroups deve retornar um array', async () => {
      const result = await controller.getGroups(mockUser)

      expect(Array.isArray(result)).toBe(true)
      expect(serviceMock.findAllGroups).toHaveBeenCalledWith(mockUser.accountId)
    })
  })
})