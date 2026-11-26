-- Non-destructive additive migration. Apply ONLY with a database backup and drift assessment.
CREATE TABLE IF NOT EXISTS "workflow_execution_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" VARCHAR(100) NOT NULL,
  "document_instance_id" UUID NOT NULL,
  "fork_key" VARCHAR(255) NOT NULL,
  "branch_key" VARCHAR(255) NOT NULL,
  "element_id" VARCHAR(255) NOT NULL,
  "join_element_id" VARCHAR(255) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "arrived_at" TIMESTAMP(6),
  CONSTRAINT "fk_execution_token_document" FOREIGN KEY ("document_instance_id") REFERENCES "document_instances"("id") ON DELETE CASCADE,
  CONSTRAINT "ck_execution_token_status" CHECK ("status" IN ('active','arrived','completed','cancelled')),
  CONSTRAINT "uq_execution_token_branch" UNIQUE ("document_instance_id", "fork_key", "branch_key")
);
CREATE INDEX IF NOT EXISTS "idx_execution_token_account_document" ON "workflow_execution_tokens" ("account_id", "document_instance_id");
CREATE INDEX IF NOT EXISTS "idx_execution_token_fork_status" ON "workflow_execution_tokens" ("document_instance_id", "fork_key", "status");
