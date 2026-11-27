-- NewFlow 3B: Reuse the existing persisted automation queue for timers and notifications.
-- This migration does not delete documents or previously queued jobs.
ALTER TABLE "workflow_automation_jobs"
ADD COLUMN IF NOT EXISTS "job_kind" VARCHAR(20) NOT NULL DEFAULT 'noop';

CREATE TABLE IF NOT EXISTS "workflow_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" VARCHAR(100) NOT NULL,
  "user_id" VARCHAR(100) NOT NULL,
  "document_instance_id" UUID NOT NULL,
  "element_id" VARCHAR(255) NOT NULL,
  "idempotency_key" VARCHAR(500) NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(6),
  CONSTRAINT "workflow_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_workflow_notifications_idempotency_key"
  ON "workflow_notifications"("idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_workflow_notifications_recipient"
  ON "workflow_notifications"("account_id", "user_id", "is_read", "created_at" DESC);
