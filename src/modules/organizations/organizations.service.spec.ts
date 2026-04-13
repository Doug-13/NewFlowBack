import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { OrganizationsService } from './organizations.service'
import { OrganizationArea, OrganizationRole, OrganizationGroup } from './schema/organization.schema'

describe('OrganizationsService', () => {
  let service: OrganizationsService

  const mockModel = () => ({
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    create: jest.fn(),
    findByIdAndDelete: jest.fn(),
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: getModelToken(OrganizationArea.name),  useValue: mockModel() },
        { provide: getModelToken(OrganizationRole.name),  useValue: mockModel() },
        { provide: getModelToken(OrganizationGroup.name), useValue: mockModel() },
      ],
    }).compile()
    service = module.get<OrganizationsService>(OrganizationsService)
  })

  it('deve ser definido', () => expect(service).toBeDefined())
  it('findAllAreas deve retornar array', async () => {
    expect(Array.isArray(await service.findAllAreas('acc-1'))).toBe(true)
  })
})
