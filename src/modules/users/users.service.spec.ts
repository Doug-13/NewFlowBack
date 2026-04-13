import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { UsersService } from './users.service'
import { User } from '../auth/schema/user.schema'
import { UserMembership } from './schema/user-membership.schema'

describe('UsersService', () => {
  let service: UsersService

  const mockUserModel = {
    find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
    findById: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) }),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  }
  const mockMembershipModel = {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    create: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name),           useValue: mockUserModel       },
        { provide: getModelToken(UserMembership.name), useValue: mockMembershipModel },
      ],
    }).compile()
    service = module.get<UsersService>(UsersService)
  })

  it('deve ser definido', () => expect(service).toBeDefined())

  it('findAll deve retornar array vazio', async () => {
    const r = await service.findAll('acc-1')
    expect(Array.isArray(r)).toBe(true)
  })
})
