-- NewFlow Fase 3A: persisted, one-shot automation jobs.
-- Does not migrate or delete preexisting documents.
CREATE TABLE IF NOT EXISTS "workflow_automation_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "document_instance_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "element_id" VARCHAR(255) NOT NULL,
    "token_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(6),
    "finished_at" TIMESTAMP(6),
    "last_error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_automation_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workflow_automation_jobs_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "document_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "workflow_automation_jobs_status_chk" CHECK ("status" IN ('queued','running','retry','completed','dead','skipped')),
    CONSTRAINT "workflow_automation_jobs_attempts_chk" CHECK ("attempt_count" >= 0 AND "max_attempts" BETWEEN 1 AND 20)
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_workflow_automation_jobs_idempotency_key" ON "workflow_automation_jobs"("idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_workflow_automation_jobs_account_status" ON "workflow_automation_jobs"("account_id", "status", "available_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_automation_jobs_claim" ON "workflow_automation_jobs"("status", "available_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_automation_jobs_document" ON "workflow_automation_jobs"("document_instance_id");
