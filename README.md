# NewFlowDev Back — Neon/PostgreSQL

Backend reconstruído em NestJS + Prisma + PostgreSQL/Neon.

## 1. Preparar ambiente

Copie `.env.example` para `.env` e informe a connection string completa do Neon:

```env
DATABASE_URL="postgresql://neondb_owner:SUA_SENHA@SEU_HOST-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="uma-chave-forte"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
```

## 2. Instalar

```powershell
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run start:dev
```

## 3. Primeiro login

Por padrão o seed cria:

- E-mail: `admin@newflow.local`
- Senha: `Admin@123`

Troque depois do primeiro acesso.

Você também pode definir antes do seed:

```env
SEED_ADMIN_EMAIL="seu@email.com"
SEED_ADMIN_PASSWORD="SuaSenhaForte"
```

## 4. Prefixo da API

A API usa:

`http://localhost:3000/api`

Rotas já implementadas:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- CRUD de `/api/users`
- CRUD de `/api/organization/units`
- CRUD de `/api/organization/areas`
- CRUD de `/api/organization/disciplines`
- CRUD de `/api/organization/roles`
- CRUD de `/api/organization/groups`
- CRUD de `/api/processes`
- CRUD e execução de `/api/document-instances`
- arquivos, auditoria, histórico e referências
- `GET /api/dashboard/summary`

## 5. Arquivos

Nesta primeira base os arquivos físicos são armazenados em `/uploads` e somente os metadados ficam no PostgreSQL.
Em produção recomenda-se trocar o adaptador por Cloudflare R2/S3/Blob Storage.

## 6. Próximos módulos

O front atual ainda possui contratos adicionais (metadados, tipos documentais, configurações de ambiente,
templates de notificação, plataforma, tarefas, L&D e definições BPMN). Esses módulos devem ser migrados
na continuação para completar 100% do contrato.
