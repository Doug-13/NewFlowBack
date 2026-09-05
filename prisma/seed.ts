import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL não definida no arquivo .env')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  let account = await prisma.accounts.findFirst({
    where: { is_active: true },
    orderBy: { created_at: 'asc' },
  })

  if (!account) {
    account = await prisma.accounts.create({
      data: {
        id: randomUUID(),
        name: 'Empresa Principal',
        code: 'EMPRESA',
        is_active: true,
      },
    })
  }

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@newflow.local')
    .trim()
    .toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123'

  const existing = await prisma.users.findUnique({ where: { email } })

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.users.create({
      data: {
        account_id: account.id,
        name: 'Administrador',
        email,
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
      },
    })

    console.log(`Admin criado: ${email}`)
    console.log(`Senha inicial: ${password}`)
  } else {
    console.log(`Admin já existe: ${email}`)
  }

  console.log(`Account ID: ${account.id}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
