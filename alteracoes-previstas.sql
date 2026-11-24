-- CreateTable
CREATE TABLE "configuration_environments" (
    "id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "description" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_environment_processes" (
    "id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "environment_id" UUID NOT NULL,
    "process_id" VARCHAR(100) NOT NULL,

    CONSTRAINT "configuration_environment_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_resources" (
    "id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "environment_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "content" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuration_environments_account_id_idx" ON "configuration_environments"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_environments_account_id_code_key" ON "configuration_environments"("account_id", "code");

-- CreateIndex
CREATE INDEX "configuration_environment_processes_environment_id_idx" ON "configuration_environment_processes"("environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_environment_processes_account_id_process_id_key" ON "configuration_environment_processes"("account_id", "process_id");

-- CreateIndex
CREATE INDEX "configuration_resources_account_id_environment_id_kind_idx" ON "configuration_resources"("account_id", "environment_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_resources_environment_id_kind_code_key" ON "configuration_resources"("environment_id", "kind", "code");

-- AddForeignKey
ALTER TABLE "configuration_environment_processes" ADD CONSTRAINT "configuration_environment_processes_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "configuration_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_resources" ADD CONSTRAINT "configuration_resources_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "configuration_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
