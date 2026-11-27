CREATE TABLE workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id varchar(100) NOT NULL,
  request_key varchar(100) NOT NULL,
  event_type varchar(20) NOT NULL,
  event_name varchar(80) NOT NULL,
  target_document_id uuid NULL,
  source_document_id uuid NULL,
  published_by_user_id varchar(100) NOT NULL,
  created_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_workflow_events_account_request UNIQUE (account_id, request_key),
  CONSTRAINT ck_workflow_events_type CHECK (event_type IN ('message','signal'))
);
CREATE INDEX idx_workflow_events_account_created ON workflow_events(account_id, created_at DESC);
ALTER TABLE workflow_automation_jobs ADD COLUMN event_id uuid NULL;
CREATE INDEX idx_workflow_jobs_event_id ON workflow_automation_jobs(event_id);
