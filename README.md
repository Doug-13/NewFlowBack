# Gestão Docs API

Backend NestJS + MongoDB para o sistema de gestão documental com motor de workflow dinâmico.

---

## Estrutura do projeto

```
src/
├── main.ts
├── app.module.ts
└── modules/
    ├── auth/
    │   ├── dto/          auth.dto.ts
    │   ├── schema/       user.schema.ts
    │   ├── auth.controller.ts
    │   ├── auth.controller.spec.ts
    │   ├── auth.service.ts
    │   ├── auth.service.spec.ts
    │   └── auth.module.ts
    ├── users/
    │   ├── dto/          user.dto.ts
    │   ├── schema/       user-membership.schema.ts
    │   ├── users.controller.ts
    │   ├── users.controller.spec.ts
    │   ├── users.service.ts
    │   ├── users.service.spec.ts
    │   └── users.module.ts
    ├── organizations/
    │   ├── dto/          organization.dto.ts
    │   ├── schema/       organization.schema.ts
    │   ├── organizations.controller.ts
    │   ├── organizations.controller.spec.ts
    │   ├── organizations.service.ts
    │   ├── organizations.service.spec.ts
    │   └── organizations.module.ts
    ├── processes/
    │   ├── dto/          process.dto.ts
    │   ├── schema/       process.schema.ts
    │   ├── processes.controller.ts
    │   ├── processes.controller.spec.ts
    │   ├── processes.service.ts
    │   ├── processes.service.spec.ts
    │   └── processes.module.ts
    ├── metadata/
    │   ├── dto/          save-metadata.dto.ts
    │   ├── schema/       metadata-value.schema.ts
    │   │                 metadata-definition.schema.ts
    │   │                 audit-log.schema.ts
    │   ├── metadata.controller.ts
    │   ├── metadata.controller.spec.ts
    │   ├── metadata.service.ts
    │   ├── metadata.service.spec.ts
    │   └── metadata.module.ts
    ├── workflow/
    │   ├── workflow.service.ts        ← Motor principal
    │   ├── workflow.service.spec.ts
    │   └── workflow.module.ts
    ├── documents/
    │   ├── dto/          create-document.dto.ts
    │   ├── schema/       document.schema.ts
    │   ├── documents.controller.ts
    │   ├── documents.controller.spec.ts
    │   ├── documents.service.ts
    │   ├── documents.service.spec.ts
    │   └── documents.module.ts
    └── tasks/
        ├── dto/          execute-task.dto.ts
        ├── schema/       task.schema.ts
        ├── tasks.controller.ts
        ├── tasks.controller.spec.ts
        ├── tasks.service.ts
        ├── tasks.service.spec.ts
        └── tasks.module.ts
```

---

## senha Atlas
TimeTop@2026

N1Dwdjwlli2Xi60I

mongodb+srv://equipenewflow_db_user:N1Dwdjwlli2Xi60I@cluster0.ryopfna.mongodb.net/?appName=Cluster0

## Setup rápido

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
```

Edite o `.env`:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/gestao-docs?retryWrites=true&w=majority
JWT_SECRET=sua-chave-secreta
JWT_EXPIRES_IN=7d
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### 3. MongoDB Atlas
1. Acesse [cloud.mongodb.com](https://cloud.mongodb.com)
2. Crie um cluster gratuito (M0)
3. **Database Access** → crie usuário com senha
4. **Network Access** → adicione `0.0.0.0/0`
5. **Connect → Drivers** → copie a connection string

### 4. Rodar em desenvolvimento
```bash
npm run start:dev
```

### 5. Rodar testes
```bash
npm test
npm run test:cov   # com coverage
```

---

## Integração com o frontend React

### Substituir o mockAdapter

No `src/api/client.ts` do frontend, remova o `installMockAdapter` e ajuste o `baseURL`:

```ts
// ANTES
import { installMockAdapter } from './mockAdapter'
export const api = axios.create({ baseURL: '' })
installMockAdapter(api)

// DEPOIS
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})
```

Adicione no `.env` do frontend:
```env
VITE_API_URL=http://localhost:3000
```

### Enviar steps e elementConfigs nas chamadas de workflow

Enquanto o backend não tem parser BPMN próprio, o frontend envia os steps:

```ts
// Criar documento
await api.post('/document-instances', {
  title,
  workflowId,
  processId,
  accountId,
  initialMetadataValues,
  steps: workflow.steps,        // ← do workflowStorage
  elementConfigs,               // ← getElementConfigsByWorkflow(workflowId)
})

// Executar ação
await api.post(`/tasks/${taskId}/execute`, {
  action: 'approve',
  comment: '',
  steps: workflow.steps,
  elementConfigs,
})
```

---

## Rotas disponíveis

### Auth
```
POST /auth/login
POST /auth/register
```

### Documentos
```
GET    /document-instances
GET    /document-instances/:id
POST   /document-instances
POST   /document-instances/:id/cancel
DELETE /document-instances/:id
```

### Tarefas
```
GET  /tasks/my
POST /tasks/:id/execute
```

### Metadados
```
GET  /metadata/values/:documentId
POST /metadata/values/:documentId
GET  /metadataDefinitions
POST /metadataDefinitions
PUT  /metadataDefinitions/:id
DELETE /metadataDefinitions/:id
```

### Usuários
```
GET    /users
GET    /users/:id
POST   /users
PUT    /users/:id
DELETE /users/:id
GET    /userProcessMemberships
POST   /userProcessMemberships
```

### Organizações
```
GET    /organizationAreas
POST   /organizationAreas
DELETE /organizationAreas/:id
GET    /organizationRoles
POST   /organizationRoles
GET    /organizationGroups
POST   /organizationGroups
```

### Processos
```
GET    /processes
GET    /processes/:id
POST   /processes
PUT    /processes/:id
DELETE /processes/:id
```

---

## Motor de workflow — fluxo de rejeição com evento condicional

```
Usuário clica "Reprovar" em "Análise Inicial"
  ↓
findTransition(currStep, 'reject')
  → { triggerAction: 'reject', toStepOrderIndex: 3, intermediateEventIds: ['Event_18rq73l'] }
  ↓
advanceDocument()
  → nextStep = "Ajustes De dados" (orderIndex 3)
  → executeIntermediateEvent('Event_18rq73l', ..., destinationStep = "Ajustes De dados")
    → kind === 'conditional'
    → doc.revision '00' → '01'
    → doc.currentStep = "Ajustes De dados"
    → tarefa criada em "Ajustes De dados"
    → metadados preservados (mesmo documento, nova revisão)
```

---

## Próximos passos (fase 2)

- [ ] Parser BPMN no backend (sem precisar enviar steps pelo frontend)
- [ ] Guards JWT em todas as rotas
- [ ] Módulo de notificações por e-mail
- [ ] Dashboard e relatórios
- [ ] Migração para PostgreSQL + C#
