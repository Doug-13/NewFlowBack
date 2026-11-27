import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ConflictException, ForbiddenException } from '@nestjs/common'
import { WorkflowTokenRuntimeService } from '../src/workflow-runtime/workflow-token-runtime.service'

const user = { id: 'test', accountId: 'account', role: 'user' }
const doc = { id: 'd', account_id: 'account', workflow_id: 'w', current_element_id: 'g', status: 'in_progress' }

/**
 * The pending-subprocess guard is always reached before workflow validation.
 * Provide the legitimate no-pending-children default in every mocked Prisma
 * instance, while allowing each test to override it explicitly.
 */
function runtime(prisma: any = {}, access: any = { document: async () => doc }) {
  const mockPrisma = {
    document_relations: { findMany: async () => [] },
    ...prisma,
  }
  return new WorkflowTokenRuntimeService(mockPrisma as any, access, { resumeAfterChildFinished: async () => ({ resumed: 0 }) } as any)
}

test('fork exige admin mesmo que usuario possa ler documento', async () => {
  await assert.rejects(runtime().start(user, 'd'), ForbiddenException)
})

test('fork exige join configurado no servidor', async () => {
  const prisma = {
    workflow_elements: {
      findFirst: async () => ({ element_id: 'g', element_kind: 'parallelGateway', config: {} }),
    },
  }
  await assert.rejects(runtime(prisma).start({ ...user, role: 'admin' }, 'd'), ConflictException)
})

test('conclusao duplicada de token nao e permitida', async () => {
  const prisma = {
    workflow_execution_tokens: {
      findFirst: async () => ({ id: 't', status: 'arrived', element_id: 'a' }),
    },
  }
  await assert.rejects(runtime(prisma).action({ ...user, role: 'admin' }, 'd', 't', { actionId: 'approve' }), ConflictException)
})

test('fork nao ignora subprocesso obrigatorio pendente', async () => {
  const prisma = {
    document_relations: {
      findMany: async () => [{ child_document_instance_id: 'child-id' }],
    },
    document_instances: {
      findMany: async () => [{ id: 'child-id', status: 'in_progress' }],
    },
  }
  await assert.rejects(runtime(prisma).start({ ...user, role: 'admin' }, 'd'), {
    name: 'ConflictException',
    message: 'Subprocessos obrigatorios ainda pendentes.',
  })
})
