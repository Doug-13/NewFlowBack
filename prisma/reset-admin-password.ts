import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import * as bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada.')
  }

  const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '')

  if (password.length < 12) {
    throw new Error('Use uma senha com pelo menos 12 caracteres.')
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

  try {
    const email = 'admin@newflow.local'

    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      throw new Error('Administrador não encontrado neste banco.')
    }

    if (user.role !== 'admin' || !user.is_active) {
      throw new Error('Usuário não está ativo como administrador.')
    }

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: await bcrypt.hash(password, 12),
        updated_at: new Date(),
      },
    })

    console.log('Senha atualizada com sucesso.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
