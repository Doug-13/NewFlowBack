-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_instance_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "step_name" VARCHAR(180),
    "user_name" VARCHAR(180),
    "comment" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."configuration_environment_processes" (
    "id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "environment_id" UUID NOT NULL,
    "process_id" VARCHAR(100) NOT NULL,

    CONSTRAINT "configuration_environment_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."configuration_environments" (
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
CREATE TABLE "public"."configuration_resources" (
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

-- CreateTable
CREATE TABLE "public"."document_action_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_instance_id" UUID NOT NULL,
    "step_name" VARCHAR(255),
    "step_order_index" INTEGER,
    "element_id" VARCHAR(255),
    "action_id" VARCHAR(255) NOT NULL,
    "outcome" VARCHAR(255),
    "comment" TEXT,
    "executed_by_user_id" VARCHAR(255),
    "executed_by_user_name" VARCHAR(255),
    "executed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_action_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "process_id" VARCHAR(100) NOT NULL,
    "process_name" VARCHAR(180),
    "title" VARCHAR(255) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "revision" VARCHAR(10) NOT NULL DEFAULT '00',
    "parent_document_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "workflow_id" VARCHAR(100) NOT NULL,
    "workflow_name" VARCHAR(180),
    "current_step_name" VARCHAR(180),
    "current_step_order_index" INTEGER,
    "responsible_id" VARCHAR(100),
    "responsible_name" VARCHAR(180),
    "created_by_id" VARCHAR(100) NOT NULL,
    "created_by_name" VARCHAR(180),
    "due_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_element_id" TEXT,
    "current_assigned_user_id" TEXT,
    "current_assigned_user_name" TEXT,
    "allowed_actions" JSONB NOT NULL DEFAULT '[]',
    "task_actions" JSONB NOT NULL DEFAULT '[]',
    "document_id" UUID NOT NULL,

    CONSTRAINT "document_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_relations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR NOT NULL,
    "relation_group_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_document_id" UUID NOT NULL,
    "parent_document_instance_id" UUID NOT NULL,
    "child_document_id" UUID NOT NULL,
    "child_document_instance_id" UUID NOT NULL,
    "relation_type" VARCHAR NOT NULL DEFAULT 'subprocess',
    "source_table_metadata_definition_id" VARCHAR,
    "source_table_name" VARCHAR,
    "source_row_key" VARCHAR,
    "source_row_index" INTEGER,
    "source_row_value" JSONB NOT NULL DEFAULT '{}',
    "parent_process_id" VARCHAR,
    "parent_process_name" VARCHAR,
    "child_process_id" VARCHAR NOT NULL,
    "child_process_name" VARCHAR,
    "child_workflow_id" VARCHAR,
    "child_workflow_name" VARCHAR,
    "wait_for_completion" BOOLEAN NOT NULL DEFAULT false,
    "wait_policy" VARCHAR NOT NULL DEFAULT 'all_children',
    "status" VARCHAR NOT NULL DEFAULT 'created',
    "parent_waiting_element_id" TEXT,
    "parent_next_element_id" TEXT,
    "created_by_id" VARCHAR NOT NULL,
    "created_by_name" VARCHAR,
    "child_completed_at" TIMESTAMP(6),
    "parent_continued_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR NOT NULL,
    "process_id" VARCHAR NOT NULL,
    "process_name" VARCHAR,
    "title" VARCHAR NOT NULL,
    "code" VARCHAR NOT NULL,
    "workflow_id" VARCHAR NOT NULL,
    "workflow_name" VARCHAR,
    "created_by_id" VARCHAR NOT NULL,
    "created_by_name" VARCHAR,
    "current_instance_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."environment_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "revision" JSONB NOT NULL DEFAULT '{}',
    "creation_mode" JSONB NOT NULL DEFAULT '{}',
    "coding_rule" JSONB NOT NULL DEFAULT '{}',
    "sequential" JSONB NOT NULL DEFAULT '{}',
    "deadlines" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metadata_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100),
    "name" VARCHAR(150) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "field_type" VARCHAR(50) NOT NULL,
    "mask_type" VARCHAR(50),
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 1,
    "metadata_set_id" UUID,
    "metadata_set_name" VARCHAR(150),
    "document_type_id" VARCHAR(100),
    "multiple_selection" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "table_columns" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metadata_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100),
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metadata_value_table_cells" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "row_id" UUID NOT NULL,
    "metadata_definition_id" UUID NOT NULL,
    "column_key" TEXT,
    "value" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_value_table_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metadata_value_table_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_value_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_value_table_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metadata_value_tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_instance_id" UUID NOT NULL,
    "workflow_id" UUID,
    "element_id" TEXT,
    "metadata_definition_id" UUID NOT NULL,
    "account_id" TEXT,
    "process_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_value_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."metadata_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_instance_id" UUID NOT NULL,
    "metadata_definition_id" VARCHAR(100) NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "process_id" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "channel" VARCHAR(20) NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(100),
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL DEFAULT 'area',
    "unit_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(100),
    "description" TEXT,
    "member_ids" JSONB NOT NULL DEFAULT '[]',
    "member_names" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(100),
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL DEFAULT 'role',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(100),
    "description" TEXT,
    "workflow_id" UUID,
    "parent_process_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "permissions" JSONB NOT NULL DEFAULT '{"userIds": [], "groupIds": []}',
    "document_creation" JSONB NOT NULL DEFAULT '{"userIds": [], "groupIds": []}',
    "document_visualization" JSONB NOT NULL DEFAULT '{"userIds": [], "groupIds": []}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_instance_id" UUID NOT NULL,
    "step_order_index" INTEGER,
    "step_name" VARCHAR(180),
    "element_id" VARCHAR(120),
    "assigned_user_id" VARCHAR(100),
    "assigned_user_name" VARCHAR(180),
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "action_taken" VARCHAR(100),
    "comment" TEXT,
    "due_date" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "allowed_actions" JSONB NOT NULL DEFAULT '[]',
    "task_actions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_process_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "process_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_process_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpf" TEXT,
    "phone" TEXT,
    "photo_url" TEXT,
    "department" TEXT,
    "job_title" TEXT,
    "position" TEXT,
    "notes" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "action_key" VARCHAR(100) NOT NULL,
    "action_name" VARCHAR(150) NOT NULL,
    "action_label" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "outcome" VARCHAR(100),
    "button_color" VARCHAR(20),
    "text_color" VARCHAR(20),
    "icon_name" VARCHAR(100),
    "next_element_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "confirmation_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_config_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "area_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_config_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_config_disciplines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "discipline_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_config_disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_config_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "group_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_config_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_config_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "position_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_config_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_config_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_config_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_config_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_config_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "element_name" TEXT,
    "activity_type" TEXT NOT NULL DEFAULT 'activity',
    "assignment_mode" TEXT NOT NULL DEFAULT 'user',
    "deadline_mode" TEXT,
    "deadline_value" INTEGER,
    "deadline_fixed_at" TIMESTAMP(6),
    "instructions" TEXT,
    "help_text" TEXT,
    "background_color" VARCHAR(20),
    "border_color" VARCHAR(20),
    "text_color" VARCHAR(20),
    "icon_name" VARCHAR(100),
    "allow_approve" BOOLEAN NOT NULL DEFAULT false,
    "allow_reject" BOOLEAN NOT NULL DEFAULT false,
    "allow_request_changes" BOOLEAN NOT NULL DEFAULT false,
    "allow_forward" BOOLEAN NOT NULL DEFAULT false,
    "allow_comment" BOOLEAN NOT NULL DEFAULT true,
    "allow_attachment" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_enter" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_exit" BOOLEAN NOT NULL DEFAULT false,
    "linked_workflow_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_activity_metadata" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "element_id" TEXT NOT NULL,
    "metadata_definition_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_read_only" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_activity_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_element_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "workflow_element_id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "element_id" VARCHAR(255) NOT NULL,
    "config_type" VARCHAR(100) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_element_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_elements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "process_id" VARCHAR(100),
    "process_name" VARCHAR(255),
    "element_id" VARCHAR(255) NOT NULL,
    "element_type" VARCHAR(100) NOT NULL,
    "element_kind" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255),
    "description" TEXT,
    "order_index" INTEGER DEFAULT 0,
    "is_start" BOOLEAN NOT NULL DEFAULT false,
    "is_end" BOOLEAN NOT NULL DEFAULT false,
    "is_executable" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_transitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "process_id" VARCHAR(100),
    "process_name" VARCHAR(255),
    "sequence_flow_id" VARCHAR(255) NOT NULL,
    "source_element_id" VARCHAR(255) NOT NULL,
    "target_element_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "label" VARCHAR(255),
    "outcome" VARCHAR(100),
    "condition_type" VARCHAR(50) NOT NULL DEFAULT 'always',
    "metadata_field_id" VARCHAR(255),
    "expected_value" TEXT,
    "expression" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" UUID NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "process_id" VARCHAR(100),
    "process_name" VARCHAR(200),
    "environment_id" VARCHAR(100),
    "environment_name" VARCHAR(200),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT DEFAULT '',
    "version" VARCHAR(50) NOT NULL DEFAULT '1.0',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "document_type_id" VARCHAR(100),
    "document_type_name" VARCHAR(200),
    "bpmn_xml" TEXT NOT NULL DEFAULT '',
    "steps_count" INTEGER NOT NULL DEFAULT 0,
    "permissions" JSONB NOT NULL DEFAULT '{"creation": {"areaIds": [], "roleIds": [], "unitIds": [], "userIds": [], "groupIds": [], "processIds": [], "disciplineIds": [], "environmentIds": []}, "visualization": {"areaIds": [], "roleIds": [], "unitIds": [], "userIds": [], "groupIds": [], "processIds": [], "disciplineIds": [], "environmentIds": []}}',
    "element_configs" JSONB NOT NULL DEFAULT '[]',
    "snapshots" JSONB NOT NULL DEFAULT '[]',
    "scope_level" VARCHAR(20) NOT NULL DEFAULT 'process',
    "tenant_id" VARCHAR(100),
    "account_name" VARCHAR(200),
    "published_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_document_created_at" ON "public"."audit_logs"("document_instance_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_document_instance" ON "public"."audit_logs"("document_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_document_instance_id" ON "public"."audit_logs"("document_instance_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "public"."auth_sessions"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "idx_auth_sessions_expiration" ON "public"."auth_sessions"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "idx_auth_sessions_user_account" ON "public"."auth_sessions"("user_id" ASC, "account_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "configuration_environment_processes_account_id_process_id_key" ON "public"."configuration_environment_processes"("account_id" ASC, "process_id" ASC);

-- CreateIndex
CREATE INDEX "configuration_environment_processes_environment_id_idx" ON "public"."configuration_environment_processes"("environment_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "configuration_environments_account_id_code_key" ON "public"."configuration_environments"("account_id" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "configuration_environments_account_id_idx" ON "public"."configuration_environments"("account_id" ASC);

-- CreateIndex
CREATE INDEX "configuration_resources_account_id_environment_id_kind_idx" ON "public"."configuration_resources"("account_id" ASC, "environment_id" ASC, "kind" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "configuration_resources_environment_id_kind_code_key" ON "public"."configuration_resources"("environment_id" ASC, "kind" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "idx_dah_document_instance_id" ON "public"."document_action_history"("document_instance_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "document_instances_document_revision_key" ON "public"."document_instances"("document_id" ASC, "revision" ASC);

-- CreateIndex
CREATE INDEX "idx_di_document_id" ON "public"."document_instances"("document_id" ASC);

-- CreateIndex
CREATE INDEX "idx_di_document_id_revision" ON "public"."document_instances"("document_id" ASC, "revision" DESC);

-- CreateIndex
CREATE INDEX "idx_document_instances_account_process" ON "public"."document_instances"("account_id" ASC, "process_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_instances_account_status" ON "public"."document_instances"("account_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_document_instances_created_by" ON "public"."document_instances"("created_by_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_instances_current_assigned_user_id" ON "public"."document_instances"("current_assigned_user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_instances_current_element_id" ON "public"."document_instances"("current_element_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_instances_parent" ON "public"."document_instances"("parent_document_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_instances_workflow_step" ON "public"."document_instances"("workflow_id" ASC, "current_step_order_index" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_account_id" ON "public"."document_relations"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_child_document_id" ON "public"."document_relations"("child_document_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_child_instance_id" ON "public"."document_relations"("child_document_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_parent_document_id" ON "public"."document_relations"("parent_document_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_parent_group_wait" ON "public"."document_relations"("parent_document_instance_id" ASC, "relation_group_id" ASC, "wait_for_completion" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_parent_instance_id" ON "public"."document_relations"("parent_document_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_relation_group_id" ON "public"."document_relations"("relation_group_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_source_table" ON "public"."document_relations"("source_table_metadata_definition_id" ASC);

-- CreateIndex
CREATE INDEX "idx_document_relations_waiting_child" ON "public"."document_relations"("child_document_instance_id" ASC, "wait_for_completion" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_documents_account_id" ON "public"."documents"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_documents_code" ON "public"."documents"("account_id" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "idx_documents_process_id" ON "public"."documents"("process_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "environment_settings_account_id_key" ON "public"."environment_settings"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_metadata_definitions_account_name" ON "public"."metadata_definitions"("account_id" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "idx_metadata_definitions_account_set_order" ON "public"."metadata_definitions"("account_id" ASC, "metadata_set_id" ASC, "order_index" ASC);

-- CreateIndex
CREATE INDEX "idx_metadata_sets_account_code" ON "public"."metadata_sets"("account_id" ASC, "code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_value_table_cells_unique" ON "public"."metadata_value_table_cells"("row_id" ASC, "column_key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_value_table_rows_unique" ON "public"."metadata_value_table_rows"("table_value_id" ASC, "row_index" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_value_tables_document_definition_unique" ON "public"."metadata_value_tables"("document_instance_id" ASC, "metadata_definition_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_value_tables_unique" ON "public"."metadata_value_tables"("document_instance_id" ASC, "metadata_definition_id" ASC, "element_id" ASC);

-- CreateIndex
CREATE INDEX "idx_metadata_values_definition" ON "public"."metadata_values"("metadata_definition_id" ASC);

-- CreateIndex
CREATE INDEX "idx_metadata_values_document_instance" ON "public"."metadata_values"("document_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_metadata_values_document_instance_id" ON "public"."metadata_values"("document_instance_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "metadata_values_document_definition_unique" ON "public"."metadata_values"("document_instance_id" ASC, "metadata_definition_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_metadata_values_document_definition" ON "public"."metadata_values"("document_instance_id" ASC, "metadata_definition_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_notification_templates_account_code" ON "public"."notification_templates"("account_id" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "idx_notification_templates_account_id" ON "public"."notification_templates"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_organization_areas_account_type" ON "public"."organization_areas"("account_id" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "idx_organization_groups_account_id" ON "public"."organization_groups"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_organization_roles_account_type" ON "public"."organization_roles"("account_id" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "idx_processes_account_id" ON "public"."processes"("account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_processes_account_status" ON "public"."processes"("account_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_assigned_status" ON "public"."tasks"("assigned_user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_assigned_user_status" ON "public"."tasks"("assigned_user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_document_instance" ON "public"."tasks"("document_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_document_instance_id" ON "public"."tasks"("document_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_document_status" ON "public"."tasks"("document_instance_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "public"."tasks"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_tasks_step_order" ON "public"."tasks"("step_order_index" ASC);

-- CreateIndex
CREATE INDEX "idx_user_process_memberships_account_process" ON "public"."user_process_memberships"("account_id" ASC, "process_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_process_memberships_user_id" ON "public"."user_process_memberships"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_users_account_id" ON "public"."users"("account_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_email" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_actions_unique" ON "public"."workflow_activity_actions"("workflow_id" ASC, "element_id" ASC, "action_key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_config_areas_unique" ON "public"."workflow_activity_config_areas"("workflow_id" ASC, "element_id" ASC, "area_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_config_disciplines_unique" ON "public"."workflow_activity_config_disciplines"("workflow_id" ASC, "element_id" ASC, "discipline_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_config_groups_unique" ON "public"."workflow_activity_config_groups"("workflow_id" ASC, "element_id" ASC, "group_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_config_positions_unique" ON "public"."workflow_activity_config_positions"("workflow_id" ASC, "element_id" ASC, "position_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_config_roles_unique" ON "public"."workflow_activity_config_roles"("workflow_id" ASC, "element_id" ASC, "role_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_config_users_unique" ON "public"."workflow_activity_config_users"("workflow_id" ASC, "element_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_activity_configs_unique" ON "public"."workflow_activity_configs"("workflow_id" ASC, "element_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_workflow_element_config" ON "public"."workflow_element_configs"("workflow_id" ASC, "element_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_workflow_element" ON "public"."workflow_elements"("workflow_id" ASC, "element_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_elements_public_id_key" ON "public"."workflow_elements"("public_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_workflow_transition" ON "public"."workflow_transitions"("workflow_id" ASC, "sequence_flow_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_public_id_key" ON "public"."workflow_transitions"("public_id" ASC);

-- CreateIndex
CREATE INDEX "idx_workflows_account_id" ON "public"."workflows"("account_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_workflows_account_process_unique" ON "public"."workflows"("account_id" ASC, "process_id" ASC) WHERE (process_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_workflows_account_updated_created" ON "public"."workflows"("account_id" ASC, "updated_at" DESC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "workflows_public_id_key" ON "public"."workflows"("public_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."configuration_environment_processes" ADD CONSTRAINT "configuration_environment_processes_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "public"."configuration_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."configuration_resources" ADD CONSTRAINT "configuration_resources_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "public"."configuration_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_instances" ADD CONSTRAINT "document_instances_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_instances" ADD CONSTRAINT "document_instances_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "public"."document_instances"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_relations" ADD CONSTRAINT "fk_document_relations_child_document" FOREIGN KEY ("child_document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_relations" ADD CONSTRAINT "fk_document_relations_child_instance" FOREIGN KEY ("child_document_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_relations" ADD CONSTRAINT "fk_document_relations_parent_document" FOREIGN KEY ("parent_document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_relations" ADD CONSTRAINT "fk_document_relations_parent_instance" FOREIGN KEY ("parent_document_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "fk_documents_current_instance" FOREIGN KEY ("current_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_definitions" ADD CONSTRAINT "fk_metadata_definitions_set" FOREIGN KEY ("metadata_set_id") REFERENCES "public"."metadata_sets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_value_table_cells" ADD CONSTRAINT "fk_metadata_value_table_cells_definition" FOREIGN KEY ("metadata_definition_id") REFERENCES "public"."metadata_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_value_table_cells" ADD CONSTRAINT "fk_metadata_value_table_cells_row" FOREIGN KEY ("row_id") REFERENCES "public"."metadata_value_table_rows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_value_table_rows" ADD CONSTRAINT "fk_metadata_value_table_rows_table" FOREIGN KEY ("table_value_id") REFERENCES "public"."metadata_value_tables"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_value_tables" ADD CONSTRAINT "fk_metadata_value_tables_definition" FOREIGN KEY ("metadata_definition_id") REFERENCES "public"."metadata_definitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_value_tables" ADD CONSTRAINT "fk_metadata_value_tables_document" FOREIGN KEY ("document_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."metadata_values" ADD CONSTRAINT "metadata_values_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "public"."document_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_element_configs" ADD CONSTRAINT "workflow_element_configs_workflow_element_id_fkey" FOREIGN KEY ("workflow_element_id") REFERENCES "public"."workflow_elements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_element_configs" ADD CONSTRAINT "workflow_element_configs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_elements" ADD CONSTRAINT "workflow_elements_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
