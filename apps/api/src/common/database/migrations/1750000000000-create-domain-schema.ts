import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDomainSchema1791882600000 implements MigrationInterface {
  name = 'CreateDomainSchema1791882600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS citext');
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_contract_type_enum\" AS ENUM('service', 'supply', 'epc', 'maintenance')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_status_enum\" AS ENUM('draft', 'active', 'suspended', 'completed')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reference_number" character varying(40) NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "contract_type" "public"."contract_contract_type_enum" NOT NULL, "status" "public"."contract_status_enum" NOT NULL, "parent_contract_id" character varying(26), "original_value_minor" bigint NOT NULL, "current_value_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, "retention_rate_bps" integer NOT NULL, "advance_payment_rate_bps" integer NOT NULL, "payment_terms_days" integer NOT NULL, "liquidated_damages_per_day_minor" bigint NOT NULL, "award_date" date NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "revised_end_date" date NOT NULL, "actual_completion_date" date NOT NULL, "defects_liability_days" integer NOT NULL, "timezone" character varying(64) NOT NULL, CONSTRAINT "UQ_4eb2644094e921caea38a4fe908" UNIQUE ("reference_number"), CONSTRAINT "PK_17c3a89f58a2997276084e706e8" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"compliance_requirement_category_enum\" AS ENUM('hse', 'environmental', 'petroleum_licensing', 'tax_and_royalty', 'labour_and_safety', 'local_content', 'community_relations', 'security_and_protection', 'insurance_and_indemnity', 'financial_reporting', 'anti_corruption', 'data_and_reporting')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"compliance_requirement_applies_to_party_type_enum\" AS ENUM('contractor', 'subcontractor', 'supplier', 'consultant', 'operator', 'jv_partner', 'host_community', 'regulator', 'insurer', 'all_parties')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"compliance_requirement_frequency_enum\" AS ENUM('once', 'daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'event_based', 'continuous')",
    );
    await queryRunner.query(
      'CREATE TABLE "compliance_requirement" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "category" "public"."compliance_requirement_category_enum" NOT NULL, "applies_to_party_type" "public"."compliance_requirement_applies_to_party_type_enum" NOT NULL, "is_mandatory" boolean NOT NULL, "frequency" "public"."compliance_requirement_frequency_enum" NOT NULL, "first_due_date" date NOT NULL, CONSTRAINT "PK_d256a6f8db326448c6dda7045a3" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_party_party_type_enum\" AS ENUM('client', 'contractor', 'subcontractor', 'vendor', 'other')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract_party" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "company_id" character varying(26) NOT NULL, "party_type" "public"."contract_party_party_type_enum" NOT NULL, "signatory_first_name" character varying(100) NOT NULL, "signatory_last_name" character varying(100) NOT NULL, "signatory_title" character varying(150) NOT NULL, "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_419f47c25da63244c2e9c05b305" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"compliance_record_status_enum\" AS ENUM('pending', 'active', 'valid', 'expired', 'renewal_due', 'renewed', 'under_review', 'rejected', 'non_compliant', 'waived', 'cancelled')",
    );
    await queryRunner.query(
      'CREATE TABLE "compliance_record" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "compliance_requirement_id" character varying(26) NOT NULL, "contract_party_id" character varying(26) NOT NULL, "reference_number" character varying(100) NOT NULL, "issuing_authority" character varying(255) NOT NULL, "issue_date" date NOT NULL, "expiry_date" date NOT NULL, "covered_amount_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, "status" "public"."compliance_record_status_enum" NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL, "verified_by_id" character varying(26) NOT NULL, "remarks" text NOT NULL, CONSTRAINT "PK_85e79b94679a80f49e4191724b7" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_role_assignment_contract_role_enum\" AS ENUM('Contractor Project Lead', 'Contractor Site Supervisor', 'Client Project Manager', 'Client Site Engineer', 'HSE Officer', 'HSE Manager', 'Finance Officer', 'Finance Director')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract_role_assignment" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_party_id" character varying(26) NOT NULL, "company_user_id" character varying(26) NOT NULL, "company_id" character varying(26) NOT NULL, "contract_role" "public"."contract_role_assignment_contract_role_enum" NOT NULL, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL, "assigned_by_id" character varying(26) NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_by_id" character varying(26) NOT NULL, CONSTRAINT "PK_f624b97049b700c8d604a03e811" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "activity_log" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "company_id" character varying(26) NOT NULL, "actor_user_id" character varying(26) NOT NULL, "action" character varying(100) NOT NULL, "entity_type" character varying(60) NOT NULL, "entity_id" uuid NOT NULL, "summary" character varying(500) NOT NULL, "changes" jsonb NOT NULL, "metadata" jsonb NOT NULL, "ip_address" inet NOT NULL, "user_agent" character varying NOT NULL, "request_id" uuid NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_067d761e2956b77b14e534fd6f1" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"comment_entity_type_enum\" AS ENUM('contract', 'document', 'comment', 'other')",
    );
    await queryRunner.query(
      'CREATE TYPE "public"."comment_visibility_enum" AS ENUM(\'public\', \'private\')',
    );
    await queryRunner.query(
      'CREATE TABLE "comment" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "author_company_user_id" character varying(26) NOT NULL, "parent_comment_id" character varying(26) NOT NULL, "entity_type" "public"."comment_entity_type_enum" NOT NULL, "entity_id" uuid NOT NULL, "body" character varying NOT NULL, "visibility" "public"."comment_visibility_enum" NOT NULL, CONSTRAINT "PK_0b0e4bbc8415ec426f87f3a88e2" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_status_history_from_status_enum\" AS ENUM('draft', 'active', 'suspended', 'completed', 'cancelled', 'under_review')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_status_history_to_status_enum\" AS ENUM('draft', 'active', 'suspended', 'completed', 'cancelled', 'under_review')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract_status_history" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "from_status" "public"."contract_status_history_from_status_enum" NOT NULL, "to_status" "public"."contract_status_history_to_status_enum" NOT NULL, "reason" text NOT NULL, "changed_by_id" character varying(26) NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_67fd29c13764e91f9f04574bf38" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"document_category_enum\" AS ENUM('certificate', 'HSE', 'contract', 'invoice', 'report', 'other')",
    );
    await queryRunner.query(
      'CREATE TYPE "public"."document_visibility_enum" AS ENUM(\'public\', \'private\')',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"document_status_enum\" AS ENUM('Valid', 'Expiring', 'Expired', 'Verification Pending', 'Verified', 'Rejected')",
    );
    await queryRunner.query(
      'CREATE TABLE "document" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "owner_company_id" character varying(26) NOT NULL, "title" character varying(255) NOT NULL, "document_number" character varying(60) NOT NULL, "category" "public"."document_category_enum" NOT NULL, "visibility" "public"."document_visibility_enum" NOT NULL, "status" "public"."document_status_enum" NOT NULL, CONSTRAINT "PK_e57d3357f83f3cdc0acffc3d777" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TYPE "public"."conversation_conversation_type_enum" AS ENUM(\'comment\', \'message\')',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"conversation_workspace_enum\" AS ENUM('project', 'finance', 'hse')",
    );
    await queryRunner.query(
      'CREATE TABLE "conversation" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_type" "public"."conversation_conversation_type_enum" NOT NULL, "contract_id" character varying(26) NOT NULL, "workspace" "public"."conversation_workspace_enum" NOT NULL, "title" character varying(126) NOT NULL, "conversation_created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by_id" character varying(26) NOT NULL, CONSTRAINT "PK_864528ec4274360a40f66c29845" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "document_version" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_id" character varying(26) NOT NULL, "version_number" integer NOT NULL, "storage_key" character varying(512) NOT NULL, "file_name" character varying(255) NOT NULL, "mime_type" character varying(127) NOT NULL, "size_bytes" bigint NOT NULL, "checksum_sha256" character(64) NOT NULL, "change_note" text NOT NULL, "uploaded_by_id" character varying(26) NOT NULL, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a4c39c95456c5dbb2e96cca713c" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "conversation_participant" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_id" character varying(26) NOT NULL, "company_user_id" character varying(26) NOT NULL, "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL, "left_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_read_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_326cbb9ee8891f8e29157bda911" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_stage_status_enum\" AS ENUM('planned', 'active', 'in_progress', 'pending_approval', 'completed', 'delayed', 'cancelled')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract_stage" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "name" character varying(255) NOT NULL, "description" text NOT NULL, "sequence" integer NOT NULL, "status" "public"."contract_stage_status_enum" NOT NULL, "weight_bps" integer NOT NULL, "planned_start_date" date NOT NULL, "planned_end_date" date NOT NULL, "actual_start_date" date NOT NULL, "actual_end_date" date NOT NULL, CONSTRAINT "PK_66dfe5f1e3a2f640834e4b18b37" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"notification_channel_enum\" AS ENUM('push', 'sms', 'email')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"notification_status_enum\" AS ENUM('sent', 'delivered', 'pending', 'failed', 'read')",
    );
    await queryRunner.query(
      'CREATE TABLE "notification" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "recipient_user_id" character varying(26) NOT NULL, "contract_id" character varying(26) NOT NULL, "notification_type" character varying(100) NOT NULL, "title" character varying(255) NOT NULL, "body" text NOT NULL, "entity_type" character varying(60) NOT NULL, "entity_id" uuid NOT NULL, "channel" "public"."notification_channel_enum" NOT NULL, "status" "public"."notification_status_enum" NOT NULL DEFAULT \'pending\', "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "message" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_id" character varying(26) NOT NULL, "sender_company_user_id" character varying(26) NOT NULL, "body" text NOT NULL, "attachements" jsonb NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL, "edited_at" TIMESTAMP WITH TIME ZONE NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_ba01f0a3e0123651915008bc578" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"document_link_entity_type_enum\" AS ENUM('certificate', 'HSE', 'contract', 'invoice', 'report', 'other')",
    );
    await queryRunner.query(
      'CREATE TABLE "document_link" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "document_id" character varying(26) NOT NULL, "entity_type" "public"."document_link_entity_type_enum" NOT NULL, "entity_id" uuid NOT NULL, "caption" character varying(255) NOT NULL, CONSTRAINT "PK_11a03710e8ed95257c3278518f8" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"invoice_invoice_type_enum\" AS ENUM('interim', 'final', 'advance', 'retention', 'variation', 'claim', 'debit_note', 'credit_note', 'proforma', 'miscellaneous')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"invoice_status_enum\" AS ENUM('draft', 'issued', 'submitted', 'pending_approval', 'approved', 'rejected', 'paid', 'partially_paid', 'overdue', 'disputed', 'cancelled', 'void')",
    );
    await queryRunner.query(
      'CREATE TABLE "invoice" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "issued_by_party_id" character varying(26) NOT NULL, "billed_to_party_id" character varying(26) NOT NULL, "invoice_number" character varying(40) NOT NULL, "invoice_type" "public"."invoice_invoice_type_enum" NOT NULL, "status" "public"."invoice_status_enum" NOT NULL, "issue_date" date NOT NULL, "due_date" date NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "currency_code" character(3) NOT NULL, "gross_amount_minor" bigint NOT NULL, "adjustments_total_minor" bigint NOT NULL, "net_payable_minor" bigint NOT NULL, "amount_paid_minor" bigint NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "submitted_by_id" character varying(26) NOT NULL, "certified_at" TIMESTAMP WITH TIME ZONE NOT NULL, "certified_by_id" character varying(26) NOT NULL, "rejection_reason" text NOT NULL, CONSTRAINT "PK_15d25c200d9bcd8a33f698daf18" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"milestone_status_enum\" AS ENUM('planned', 'active', 'in_progress', 'pending_approval', 'approved', 'completed', 'delayed', 'at_risk', 'on_hold', 'cancelled')",
    );
    await queryRunner.query(
      'CREATE TABLE "milestone" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "contract_stage_id" character varying(26) NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "sequence" integer NOT NULL, "status" "public"."milestone_status_enum" NOT NULL, "progress_bps" integer NOT NULL, "weight_bps" integer NOT NULL, "is_payment_milestone" boolean NOT NULL, "amount_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, "due_date" date NOT NULL, "revised_due_date" date NOT NULL, "completed_date" date NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "submitted_by_id" character varying(26) NOT NULL, "approved_at" TIMESTAMP WITH TIME ZONE NOT NULL, "approved_by_id" character varying(26) NOT NULL, "rejection_reason" text NOT NULL, CONSTRAINT "PK_f8372abce331f60ba7b33fe23a7" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "invoice_line_item" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "invoice_id" character varying(26) NOT NULL, "milestone_id" character varying(26) NOT NULL, "line_number" integer NOT NULL, "description" character varying(500) NOT NULL, "quantity_milli" bigint NOT NULL, "unit_of_measure" character varying(20) NOT NULL, "unit_price_minor" bigint NOT NULL, "amount_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, CONSTRAINT "PK_4ffb12a7ac2bb69aa7234f30b85" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_variation_variation_type_enum\" AS ENUM('scope_change', 'time_extension', 'cost_adjustment', 'price_revision', 'schedule_change', 'design_change', 'technical_change', 'procurement_change', 'material_change', 'regulatory_change', 'other')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_variation_status_enum\" AS ENUM('draft', 'submitted', 'under_review', 'pending_approval', 'approved', 'rejected', 'negotiating', 'implemented', 'cancelled', 'withdrawn')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract_variation" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "raised_by_party_id" character varying(26) NOT NULL, "reference_number" character varying(40) NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "variation_type" "public"."contract_variation_variation_type_enum" NOT NULL, "status" "public"."contract_variation_status_enum" NOT NULL, "amount_delta_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, "time_extension_days" integer NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "submitted_by_id" character varying(26) NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL, "decided_by_id" character varying(26) NOT NULL, "decision_note" text NOT NULL, CONSTRAINT "PK_6f73e823d363fc8eb90be6ec12e" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"contract_site_status_enum\" AS ENUM('planned', 'active', 'suspended', 'completed', 'closed')",
    );
    await queryRunner.query(
      'CREATE TABLE "contract_site" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "name" character varying(255) NOT NULL, "site_code" character varying(40) NOT NULL, "address_line1" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "state_region" character varying(100) NOT NULL, "country_code" character(2) NOT NULL, "latitude_e6" integer NOT NULL, "longitude_e6" integer NOT NULL, "status" "public"."contract_site_status_enum" NOT NULL, CONSTRAINT "PK_be21c5b8d06792602c87877a31a" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_incident_incident_type_enum\" AS ENUM('accident', 'near_miss', 'hazard', 'environmental', 'security', 'other')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_incident_severity_enum\" AS ENUM('critical', 'major', 'minor', 'negligible')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_incident_status_enum\" AS ENUM('open', 'in_progress', 'closed')",
    );
    await queryRunner.query(
      'CREATE TABLE "hse_incident" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "contract_site_id" character varying(26) NOT NULL, "reference_number" character varying(40) NOT NULL, "incident_type" "public"."hse_incident_incident_type_enum" NOT NULL, "severity" "public"."hse_incident_severity_enum" NOT NULL, "status" "public"."hse_incident_status_enum" NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "location_detail" character varying(255) NOT NULL, "description" text NOT NULL, "immediate_action_taken" text NOT NULL, "root_cause" text NOT NULL, "investigation_summary" text NOT NULL, "lost_time_days" integer NOT NULL, "estimated_cost_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, "is_notifiable" boolean NOT NULL, "authority_notified_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reported_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reported_by_id" character varying(26) NOT NULL, "investigated_by_id" character varying(26) NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "closed_by_id" character varying(26) NOT NULL, CONSTRAINT "PK_dae74d6f4e4f335ccc5823606f9" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_inspection_inspection_type_enum\" AS ENUM('safety', 'environmental', 'health', 'other')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_inspection_status_enum\" AS ENUM('pending', 'in_progress', 'completed', 'cancelled')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_inspection_overall_result_enum\" AS ENUM('pass', 'fail', 'inconclusive')",
    );
    await queryRunner.query(
      'CREATE TABLE "hse_inspection" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "contract_site_id" character varying(26) NOT NULL, "inspector_company_user_id" character varying(26) NOT NULL, "reference_number" character varying(40) NOT NULL, "inspection_type" "public"."hse_inspection_inspection_type_enum" NOT NULL, "status" "public"."hse_inspection_status_enum" NOT NULL, "scheduled_date" date NOT NULL, "conducted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "external_inspector_first_name" character varying(100) NOT NULL, "external_inspector_last_name" character varying(100) NOT NULL, "external_inspector_organization" character varying(255) NOT NULL, "overall_result" "public"."hse_inspection_overall_result_enum" NOT NULL, "score_bps" integer NOT NULL, "summary" text NOT NULL, CONSTRAINT "PK_e2c59d3c68df6729763e3e96eb7" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_inspection_finding_result_enum\" AS ENUM('compliant', 'non_compliant', 'not_applicable')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_inspection_finding_risk_level_enum\" AS ENUM('low', 'medium', 'high')",
    );
    await queryRunner.query(
      'CREATE TABLE "hse_inspection_finding" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "hse_inspection_id" character varying(26) NOT NULL, "item_number" integer NOT NULL, "category" character varying(100) NOT NULL, "description" text NOT NULL, "result" "public"."hse_inspection_finding_result_enum" NOT NULL, "risk_level" "public"."hse_inspection_finding_risk_level_enum" NOT NULL, "recommendation" text NOT NULL, CONSTRAINT "PK_ca36af8ff5d6e03045d27007ab6" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_corrective_action_priority_enum\" AS ENUM('low', 'medium', 'high')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_corrective_action_status_enum\" AS ENUM('open', 'in_progress', 'closed')",
    );
    await queryRunner.query(
      'CREATE TABLE "hse_corrective_action" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "hse_incident_id" character varying(26) NOT NULL, "hse_inspection_finding_id" character varying(26) NOT NULL, "assigned_to_company_user_id" character varying(26) NOT NULL, "description" text NOT NULL, "priority" "public"."hse_corrective_action_priority_enum" NOT NULL, "status" "public"."hse_corrective_action_status_enum" NOT NULL, "due_date" date NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL, "verified_by_id" character varying(26) NOT NULL, "closure_note" text NOT NULL, CONSTRAINT "REL_e87948b2c97f9a28fa02d84fe4" UNIQUE ("hse_incident_id"), CONSTRAINT "PK_6078be2c30c2ba7ca62ea46d61e" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"invoice_adjustment_adjustment_type_enum\" AS ENUM('vat', 'withholding_tax', 'retention', 'advance_payment', 'discount', 'penalty', 'late_payment_interest', 'price_adjustment', 'variation', 'claim', 'credit_note', 'debit_note', 'revision', 'other')",
    );
    await queryRunner.query(
      'CREATE TABLE "invoice_adjustment" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "invoice_id" character varying(26) NOT NULL, "adjustment_type" "public"."invoice_adjustment_adjustment_type_enum" NOT NULL, "description" character varying(255) NOT NULL, "rate_bps" integer NOT NULL, "base_amount_minor" bigint NOT NULL, "amount_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, CONSTRAINT "PK_865668e045a9fc1a731ca035fe9" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"payment_payment_method_enum\" AS ENUM('bank_transfer', 'cheque', 'cash', 'card', 'mobile_money', 'letter_of_credit', 'advance', 'escrow', 'other')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"payment_status_enum\" AS ENUM('pending', 'initiated', 'processing', 'authorized', 'completed', 'partially_paid', 'failed', 'reversed', 'disputed', 'cancelled', 'hold')",
    );
    await queryRunner.query(
      'CREATE TABLE "payment" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "invoice_id" character varying(26) NOT NULL, "payment_reference" character varying(40) NOT NULL, "idempotency_key" character varying(64) NOT NULL, "amount_minor" bigint NOT NULL, "currency_code" character(3) NOT NULL, "invoice_amount_minor" bigint NOT NULL, "invoice_currency_code" character(3) NOT NULL, "fx_base_currency_code" character(3) NOT NULL, "fx_rate_micro" bigint NOT NULL, "fx_rate_source" character varying(64) NOT NULL, "fx_rate_at" TIMESTAMP WITH TIME ZONE NOT NULL, "payment_method" "public"."payment_payment_method_enum" NOT NULL, "status" "public"."payment_status_enum" NOT NULL, "payment_date" date NOT NULL, "external_reference" character varying(100) NOT NULL, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "recorded_by_id" character varying(26) NOT NULL, "approved_at" TIMESTAMP WITH TIME ZONE NOT NULL, "approved_by_id" character varying(26) NOT NULL, "receipt_confirmed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "receipt_confirmed_by_id" character varying(26) NOT NULL, "notes" text NOT NULL, CONSTRAINT "UQ_54fc428ca06ce52fd478d8706d8" UNIQUE ("payment_reference"), CONSTRAINT "UQ_989fae9e4731f55c44394f53854" UNIQUE ("idempotency_key"), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"hse_incident_person_involvement_enum\" AS ENUM('victim', 'injured_person', 'witness', 'reporter', 'supervisor', 'first_aider', 'emergency_responder', 'investigator', 'contractor', 'visitor', 'other')",
    );
    await queryRunner.query(
      'CREATE TABLE "hse_incident_person" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "hse_incident_id" character varying(26) NOT NULL, "company_user_id" character varying(26) NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "involvement" "public"."hse_incident_person_involvement_enum" NOT NULL, "employer_name" character varying(255) NOT NULL, "job_title" character varying(150) NOT NULL, "phone_number" character varying(20) NOT NULL, "injury_description" text NOT NULL, "body_part_affected" character varying(100) NOT NULL, "treatment_given" text NOT NULL, "statement" text NOT NULL, CONSTRAINT "REL_b813c63ec88a0dfc7b5dd81893" UNIQUE ("hse_incident_id"), CONSTRAINT "PK_e2a191b56949ab30832c57f3974" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "inventory_item" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "contract_site_id" character varying(26) NOT NULL, "contract_party_id" character varying(26) NOT NULL, "item_code" character varying(60) NOT NULL, "name" character varying(255) NOT NULL, "category" character varying(100) NOT NULL, "unit_of_measure" character varying(20) NOT NULL, "quantity_on_hand_milli" bigint NOT NULL, "reorder_level_milli" bigint NOT NULL, CONSTRAINT "PK_94f5cbcb5f280f2f30bd4a9fd90" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"site_daily_log_weather_condition_enum\" AS ENUM('clear', 'cloudy', 'partly_cloudy', 'rainy', 'heavy_rain', 'windy', 'stormy', 'foggy', 'hot', 'cold', 'snowy', 'hail')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"site_daily_log_status_enum\" AS ENUM('on_schedule', 'ahead_of_schedule', 'behind_schedule', 'delayed', 'suspended', 'completed', 'at_risk', 'hold', 'closed')",
    );
    await queryRunner.query(
      'CREATE TABLE "site_daily_log" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "contract_site_id" character varying(26) NOT NULL, "contract_party_id" character varying(26) NOT NULL, "log_date" date NOT NULL, "weather_condition" "public"."site_daily_log_weather_condition_enum" NOT NULL, "temperature_celsius" smallint NOT NULL, "weather_delay_minutes" integer NOT NULL, "work_performed" text NOT NULL, "work_planned_next" text NOT NULL, "issues_and_delays" text NOT NULL, "status" "public"."site_daily_log_status_enum" NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "submitted_by_id" character varying(26) NOT NULL, "approved_at" TIMESTAMP WITH TIME ZONE NOT NULL, "approved_by_id" character varying(26) NOT NULL, "rejection_reason" text NOT NULL, CONSTRAINT "PK_21afa01430cb6265722b6085e09" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"inventory_transaction_transaction_type_enum\" AS ENUM('receipt', 'issue', 'adjustment', 'transfer', 'return')",
    );
    await queryRunner.query(
      'CREATE TABLE "inventory_transaction" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "contract_id" character varying(26) NOT NULL, "inventory_item_id" character varying(26) NOT NULL, "site_daily_log_id" character varying(26) NOT NULL, "transaction_type" "public"."inventory_transaction_transaction_type_enum" NOT NULL, "quantity_milli" bigint NOT NULL, "unit_cost_minor" bigint NOT NULL, "currency_code" character varying(3) NOT NULL, "reference_number" character varying(100) NOT NULL, "counterparty_name" character varying(255) NOT NULL, "transaction_at" TIMESTAMP WITH TIME ZONE NOT NULL, "performed_by_id" character varying(26) NOT NULL, "remarks" text NOT NULL, CONSTRAINT "PK_f58bbe29fa78f5b0d59d840d3ce" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"site_daily_log_equipment_condition_enum\" AS ENUM('excellent', 'good', 'fair', 'poor', 'damaged', 'repair_required', 'out_of_service', 'idle', 'operating', 'standby')",
    );
    await queryRunner.query(
      'CREATE TABLE "site_daily_log_equipment" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "site_daily_log_id" character varying(26) NOT NULL, "equipment_name" character varying(150) NOT NULL, "equipment_tag" character varying(60) NOT NULL, "quantity" integer NOT NULL, "minutes_operated" integer NOT NULL, "minutes_idle" integer NOT NULL, "condition" "public"."site_daily_log_equipment_condition_enum" NOT NULL, "remarks" text NOT NULL, CONSTRAINT "PK_024f0c5efd44bbaece0b3adf011" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "site_daily_log_visitor" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "site_daily_log_id" character varying(26) NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "organization" character varying(255) NOT NULL, "purpose" character varying(255) NOT NULL, "time_in" TIMESTAMP WITH TIME ZONE NOT NULL, "time_out" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9351586d09936cfb9751467c963" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE TABLE "site_daily_log_labour" ("id" character varying(26) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "site_daily_log_id" character varying(26) NOT NULL, "trade" character varying(100) NOT NULL, "worker_count" integer NOT NULL, "minutes_worked" integer NOT NULL, "remarks" text NOT NULL, CONSTRAINT "PK_6669272c452bc1188edc5340c41" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'ALTER TABLE "contract" ADD CONSTRAINT "FK_f47cfaeabefd9d42a9aae56a488" FOREIGN KEY ("parent_contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_requirement" ADD CONSTRAINT "FK_eeee03189d50463e8ec6e6c75fb" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_party" ADD CONSTRAINT "FK_98eabde526fe0553df87c1a80f8" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_party" ADD CONSTRAINT "FK_3a68e20cd8df7aac802a8485174" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" ADD CONSTRAINT "FK_9dffe32faee628e67fea1d97a70" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" ADD CONSTRAINT "FK_bc1740b95bad6892b4f79f9fa71" FOREIGN KEY ("compliance_requirement_id") REFERENCES "compliance_requirement"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" ADD CONSTRAINT "FK_53bbae63a5e3d7a5f360172898a" FOREIGN KEY ("contract_party_id") REFERENCES "contract_party"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" ADD CONSTRAINT "FK_7951f9e6e52e2334df32ac63e5f" FOREIGN KEY ("verified_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ADD CONSTRAINT "FK_ac7051789ebb740ff136abec512" FOREIGN KEY ("contract_party_id") REFERENCES "contract_party"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ADD CONSTRAINT "FK_1af383f6cedce42fd4bd0b8af13" FOREIGN KEY ("company_user_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ADD CONSTRAINT "FK_380b8657370204b90243fe8b664" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ADD CONSTRAINT "FK_55fbb67641bcd3dfa63038f380e" FOREIGN KEY ("assigned_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ADD CONSTRAINT "FK_5f4fa1fe46371bddf17213676c0" FOREIGN KEY ("revoked_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ADD CONSTRAINT "FK_1e8dfb74edf2bf09937014dcf9b" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ADD CONSTRAINT "FK_4da92f37c4b5a98e84dbce46d64" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ADD CONSTRAINT "FK_40356ee4599a21976ae079134a7" FOREIGN KEY ("actor_user_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "comment" ADD CONSTRAINT "FK_54fc5a8815346d3eb09f59cad45" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "comment" ADD CONSTRAINT "FK_804fec75702044e1f5c256a0243" FOREIGN KEY ("author_company_user_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "comment" ADD CONSTRAINT "FK_ac69bddf8202b7c0752d9dc8f32" FOREIGN KEY ("parent_comment_id") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_status_history" ADD CONSTRAINT "FK_f8bcc63d886fbff6a1f3e38c559" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_status_history" ADD CONSTRAINT "FK_9d9fa050ead0ec007c14a556b73" FOREIGN KEY ("changed_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "document" ADD CONSTRAINT "FK_bc0002326db7d928c061fc90953" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "document" ADD CONSTRAINT "FK_e521f5da9bd5a9275a674012f03" FOREIGN KEY ("owner_company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation" ADD CONSTRAINT "FK_a7489efcfe6640de3c07991814f" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation" ADD CONSTRAINT "FK_e1e830db6dcc38779b42ed4fe47" FOREIGN KEY ("created_by_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "document_version" ADD CONSTRAINT "FK_99e07676aba693e25611b1f6c12" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "document_version" ADD CONSTRAINT "FK_eec2bd045e0291dbc6ecdbd46e7" FOREIGN KEY ("uploaded_by_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation_participant" ADD CONSTRAINT "FK_f6f41e6c7af3a1ffaab8787c2b7" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation_participant" ADD CONSTRAINT "FK_d32f33c82bb44c8934de2d20baf" FOREIGN KEY ("company_user_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_stage" ADD CONSTRAINT "FK_27b93abce618d038c072304377e" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "notification" ADD CONSTRAINT "FK_7d7f411e854516f615ba846c6a4" FOREIGN KEY ("recipient_user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "notification" ADD CONSTRAINT "FK_f9cd0107e86bcd1d22a4ed7125b" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "message" ADD CONSTRAINT "FK_7fe3e887d78498d9c9813375ce2" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "message" ADD CONSTRAINT "FK_0c699891bc63a8ae19d455a5160" FOREIGN KEY ("sender_company_user_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "document_link" ADD CONSTRAINT "FK_f4798622380a4f31dc286e34f56" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" ADD CONSTRAINT "FK_a10f103f8a97fbb9e11173dbc42" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" ADD CONSTRAINT "FK_3f4d6346fb1c0d423bc2a88a331" FOREIGN KEY ("issued_by_party_id") REFERENCES "contract_party"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" ADD CONSTRAINT "FK_ab5ac143b3810160d52d5eedf6e" FOREIGN KEY ("billed_to_party_id") REFERENCES "contract_party"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" ADD CONSTRAINT "FK_b89750e19573c178bce95eb81b0" FOREIGN KEY ("submitted_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" ADD CONSTRAINT "FK_0a191cc96a06c87abcb907f40d1" FOREIGN KEY ("certified_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" ADD CONSTRAINT "FK_4c0f223580d5fc315a2d5a62099" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" ADD CONSTRAINT "FK_a7f146234575e6f4770eeee8137" FOREIGN KEY ("contract_stage_id") REFERENCES "contract_stage"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" ADD CONSTRAINT "FK_5cbfefe27c417e574b81ef16acb" FOREIGN KEY ("submitted_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" ADD CONSTRAINT "FK_8a288bc285381cc74e6348fcb15" FOREIGN KEY ("approved_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_line_item" ADD CONSTRAINT "FK_706938143f41efb24ffb55d6d8f" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_line_item" ADD CONSTRAINT "FK_e91f11d0f428aad4bb789dac300" FOREIGN KEY ("milestone_id") REFERENCES "milestone"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" ADD CONSTRAINT "FK_d0c7032b3edd1fadb7bfac845cc" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" ADD CONSTRAINT "FK_6414f6f85be510977e2a42a7107" FOREIGN KEY ("raised_by_party_id") REFERENCES "contract_party"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" ADD CONSTRAINT "FK_dac6ec7db250ae4c0ce39593922" FOREIGN KEY ("submitted_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" ADD CONSTRAINT "FK_a3ebae1de40f04ff86be1ebfeab" FOREIGN KEY ("decided_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_site" ADD CONSTRAINT "FK_03d891aa0d15510b68f68ae3686" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" ADD CONSTRAINT "FK_43c90e952c96660141bfb291323" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" ADD CONSTRAINT "FK_d681d757a95b0b3b778bab9c7c2" FOREIGN KEY ("contract_site_id") REFERENCES "contract_site"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" ADD CONSTRAINT "FK_4f83edf2591fb90052718f8f4d1" FOREIGN KEY ("reported_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" ADD CONSTRAINT "FK_8f5e22646d307b9f8365ad6ee44" FOREIGN KEY ("investigated_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" ADD CONSTRAINT "FK_14ddff3160a6afb73752f58078b" FOREIGN KEY ("closed_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection" ADD CONSTRAINT "FK_e157670aef5137ec8e3d0aa32d0" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection" ADD CONSTRAINT "FK_e09a0afdc78b25e7937674b7e70" FOREIGN KEY ("contract_site_id") REFERENCES "contract_site"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection" ADD CONSTRAINT "FK_f75be37ae4db82375b422afbeff" FOREIGN KEY ("inspector_company_user_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection_finding" ADD CONSTRAINT "FK_d7e523fe3f2311337513cf3b6a7" FOREIGN KEY ("hse_inspection_id") REFERENCES "hse_inspection"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" ADD CONSTRAINT "FK_02328fdb81f21d5872f360bd7d6" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" ADD CONSTRAINT "FK_e87948b2c97f9a28fa02d84fe45" FOREIGN KEY ("hse_incident_id") REFERENCES "hse_incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" ADD CONSTRAINT "FK_5b6fd195e473638c23fd7a0660b" FOREIGN KEY ("hse_inspection_finding_id") REFERENCES "hse_inspection_finding"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" ADD CONSTRAINT "FK_c8f63900ced21fde722cf6f5f8f" FOREIGN KEY ("assigned_to_company_user_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" ADD CONSTRAINT "FK_58c5377725925b4436f99aebe71" FOREIGN KEY ("verified_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_adjustment" ADD CONSTRAINT "FK_e39272557fd6cab7ded1eb2d9dd" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" ADD CONSTRAINT "FK_4a85b9df866c49165311420908e" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" ADD CONSTRAINT "FK_20cc84d8a2274ae86f551360c11" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" ADD CONSTRAINT "FK_b755d6aa480ae9d7447237ea7ad" FOREIGN KEY ("recorded_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" ADD CONSTRAINT "FK_02d4279bd06693172b963b4cd13" FOREIGN KEY ("approved_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" ADD CONSTRAINT "FK_b7ea7d01847f79b8af28f2cea33" FOREIGN KEY ("receipt_confirmed_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident_person" ADD CONSTRAINT "FK_b813c63ec88a0dfc7b5dd818936" FOREIGN KEY ("hse_incident_id") REFERENCES "hse_incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident_person" ADD CONSTRAINT "FK_dab06212fd409b879175801cf97" FOREIGN KEY ("company_user_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_item" ADD CONSTRAINT "FK_4df8aa72ee3d1426f61dcc2cd05" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_item" ADD CONSTRAINT "FK_765638aab5eab9492d8d8a461a5" FOREIGN KEY ("contract_site_id") REFERENCES "contract_site"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_item" ADD CONSTRAINT "FK_e6fa8757a47b346e82229957c20" FOREIGN KEY ("contract_party_id") REFERENCES "contract_party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" ADD CONSTRAINT "FK_dfe7b58244f5cbcd63810ce8ee5" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" ADD CONSTRAINT "FK_06e6de420af3c5fac3704e933a8" FOREIGN KEY ("contract_site_id") REFERENCES "contract_site"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" ADD CONSTRAINT "FK_a6c37cbf1537382f566602138cc" FOREIGN KEY ("contract_party_id") REFERENCES "contract_party"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" ADD CONSTRAINT "FK_26f3049a0f885c179aca543133e" FOREIGN KEY ("submitted_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" ADD CONSTRAINT "FK_4e6e69ae84e10e2ea360245ff86" FOREIGN KEY ("approved_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" ADD CONSTRAINT "FK_c2ef01f8cc6637b98e16b9ecb68" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" ADD CONSTRAINT "FK_fe91cef31a3bfaca8a2928c67ec" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" ADD CONSTRAINT "FK_7af7001a147e8641d0dc04d15a0" FOREIGN KEY ("site_daily_log_id") REFERENCES "site_daily_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" ADD CONSTRAINT "FK_7a0918c35004b20f1715991eadb" FOREIGN KEY ("performed_by_id") REFERENCES "company_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log_equipment" ADD CONSTRAINT "FK_fed8a5a82828d7011f756352476" FOREIGN KEY ("site_daily_log_id") REFERENCES "site_daily_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log_visitor" ADD CONSTRAINT "FK_0cfa4746cbf172282c026a12a88" FOREIGN KEY ("site_daily_log_id") REFERENCES "site_daily_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log_labour" ADD CONSTRAINT "FK_6ec3e730acdd145617d7e4d561b" FOREIGN KEY ("site_daily_log_id") REFERENCES "site_daily_log"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "contract" DROP CONSTRAINT "FK_f47cfaeabefd9d42a9aae56a488"',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_requirement" DROP CONSTRAINT "FK_eeee03189d50463e8ec6e6c75fb"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_party" DROP CONSTRAINT "FK_98eabde526fe0553df87c1a80f8"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_party" DROP CONSTRAINT "FK_3a68e20cd8df7aac802a8485174"',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" DROP CONSTRAINT "FK_9dffe32faee628e67fea1d97a70"',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" DROP CONSTRAINT "FK_bc1740b95bad6892b4f79f9fa71"',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" DROP CONSTRAINT "FK_53bbae63a5e3d7a5f360172898a"',
    );
    await queryRunner.query(
      'ALTER TABLE "compliance_record" DROP CONSTRAINT "FK_7951f9e6e52e2334df32ac63e5f"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" DROP CONSTRAINT "FK_ac7051789ebb740ff136abec512"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" DROP CONSTRAINT "FK_1af383f6cedce42fd4bd0b8af13"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" DROP CONSTRAINT "FK_380b8657370204b90243fe8b664"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" DROP CONSTRAINT "FK_55fbb67641bcd3dfa63038f380e"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" DROP CONSTRAINT "FK_5f4fa1fe46371bddf17213676c0"',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" DROP CONSTRAINT "FK_1e8dfb74edf2bf09937014dcf9b"',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" DROP CONSTRAINT "FK_4da92f37c4b5a98e84dbce46d64"',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" DROP CONSTRAINT "FK_40356ee4599a21976ae079134a7"',
    );
    await queryRunner.query(
      'ALTER TABLE "comment" DROP CONSTRAINT "FK_54fc5a8815346d3eb09f59cad45"',
    );
    await queryRunner.query(
      'ALTER TABLE "comment" DROP CONSTRAINT "FK_804fec75702044e1f5c256a0243"',
    );
    await queryRunner.query(
      'ALTER TABLE "comment" DROP CONSTRAINT "FK_ac69bddf8202b7c0752d9dc8f32"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_status_history" DROP CONSTRAINT "FK_f8bcc63d886fbff6a1f3e38c559"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_status_history" DROP CONSTRAINT "FK_9d9fa050ead0ec007c14a556b73"',
    );
    await queryRunner.query(
      'ALTER TABLE "document" DROP CONSTRAINT "FK_bc0002326db7d928c061fc90953"',
    );
    await queryRunner.query(
      'ALTER TABLE "document" DROP CONSTRAINT "FK_e521f5da9bd5a9275a674012f03"',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation" DROP CONSTRAINT "FK_a7489efcfe6640de3c07991814f"',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation" DROP CONSTRAINT "FK_e1e830db6dcc38779b42ed4fe47"',
    );
    await queryRunner.query(
      'ALTER TABLE "document_version" DROP CONSTRAINT "FK_99e07676aba693e25611b1f6c12"',
    );
    await queryRunner.query(
      'ALTER TABLE "document_version" DROP CONSTRAINT "FK_eec2bd045e0291dbc6ecdbd46e7"',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation_participant" DROP CONSTRAINT "FK_f6f41e6c7af3a1ffaab8787c2b7"',
    );
    await queryRunner.query(
      'ALTER TABLE "conversation_participant" DROP CONSTRAINT "FK_d32f33c82bb44c8934de2d20baf"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_stage" DROP CONSTRAINT "FK_27b93abce618d038c072304377e"',
    );
    await queryRunner.query(
      'ALTER TABLE "notification" DROP CONSTRAINT "FK_7d7f411e854516f615ba846c6a4"',
    );
    await queryRunner.query(
      'ALTER TABLE "notification" DROP CONSTRAINT "FK_f9cd0107e86bcd1d22a4ed7125b"',
    );
    await queryRunner.query(
      'ALTER TABLE "message" DROP CONSTRAINT "FK_7fe3e887d78498d9c9813375ce2"',
    );
    await queryRunner.query(
      'ALTER TABLE "message" DROP CONSTRAINT "FK_0c699891bc63a8ae19d455a5160"',
    );
    await queryRunner.query(
      'ALTER TABLE "document_link" DROP CONSTRAINT "FK_f4798622380a4f31dc286e34f56"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" DROP CONSTRAINT "FK_a10f103f8a97fbb9e11173dbc42"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" DROP CONSTRAINT "FK_3f4d6346fb1c0d423bc2a88a331"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" DROP CONSTRAINT "FK_ab5ac143b3810160d52d5eedf6e"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" DROP CONSTRAINT "FK_b89750e19573c178bce95eb81b0"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice" DROP CONSTRAINT "FK_0a191cc96a06c87abcb907f40d1"',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" DROP CONSTRAINT "FK_4c0f223580d5fc315a2d5a62099"',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" DROP CONSTRAINT "FK_a7f146234575e6f4770eeee8137"',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" DROP CONSTRAINT "FK_5cbfefe27c417e574b81ef16acb"',
    );
    await queryRunner.query(
      'ALTER TABLE "milestone" DROP CONSTRAINT "FK_8a288bc285381cc74e6348fcb15"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_line_item" DROP CONSTRAINT "FK_706938143f41efb24ffb55d6d8f"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_line_item" DROP CONSTRAINT "FK_e91f11d0f428aad4bb789dac300"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" DROP CONSTRAINT "FK_d0c7032b3edd1fadb7bfac845cc"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" DROP CONSTRAINT "FK_6414f6f85be510977e2a42a7107"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" DROP CONSTRAINT "FK_dac6ec7db250ae4c0ce39593922"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_variation" DROP CONSTRAINT "FK_a3ebae1de40f04ff86be1ebfeab"',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_site" DROP CONSTRAINT "FK_03d891aa0d15510b68f68ae3686"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" DROP CONSTRAINT "FK_43c90e952c96660141bfb291323"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" DROP CONSTRAINT "FK_d681d757a95b0b3b778bab9c7c2"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" DROP CONSTRAINT "FK_4f83edf2591fb90052718f8f4d1"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" DROP CONSTRAINT "FK_8f5e22646d307b9f8365ad6ee44"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident" DROP CONSTRAINT "FK_14ddff3160a6afb73752f58078b"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection" DROP CONSTRAINT "FK_e157670aef5137ec8e3d0aa32d0"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection" DROP CONSTRAINT "FK_e09a0afdc78b25e7937674b7e70"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection" DROP CONSTRAINT "FK_f75be37ae4db82375b422afbeff"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_inspection_finding" DROP CONSTRAINT "FK_d7e523fe3f2311337513cf3b6a7"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" DROP CONSTRAINT "FK_02328fdb81f21d5872f360bd7d6"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" DROP CONSTRAINT "FK_e87948b2c97f9a28fa02d84fe45"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" DROP CONSTRAINT "FK_5b6fd195e473638c23fd7a0660b"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" DROP CONSTRAINT "FK_c8f63900ced21fde722cf6f5f8f"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_corrective_action" DROP CONSTRAINT "FK_58c5377725925b4436f99aebe71"',
    );
    await queryRunner.query(
      'ALTER TABLE "invoice_adjustment" DROP CONSTRAINT "FK_e39272557fd6cab7ded1eb2d9dd"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" DROP CONSTRAINT "FK_4a85b9df866c49165311420908e"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" DROP CONSTRAINT "FK_20cc84d8a2274ae86f551360c11"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" DROP CONSTRAINT "FK_b755d6aa480ae9d7447237ea7ad"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" DROP CONSTRAINT "FK_02d4279bd06693172b963b4cd13"',
    );
    await queryRunner.query(
      'ALTER TABLE "payment" DROP CONSTRAINT "FK_b7ea7d01847f79b8af28f2cea33"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident_person" DROP CONSTRAINT "FK_b813c63ec88a0dfc7b5dd818936"',
    );
    await queryRunner.query(
      'ALTER TABLE "hse_incident_person" DROP CONSTRAINT "FK_dab06212fd409b879175801cf97"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_item" DROP CONSTRAINT "FK_4df8aa72ee3d1426f61dcc2cd05"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_item" DROP CONSTRAINT "FK_765638aab5eab9492d8d8a461a5"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_item" DROP CONSTRAINT "FK_e6fa8757a47b346e82229957c20"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" DROP CONSTRAINT "FK_dfe7b58244f5cbcd63810ce8ee5"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" DROP CONSTRAINT "FK_06e6de420af3c5fac3704e933a8"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" DROP CONSTRAINT "FK_a6c37cbf1537382f566602138cc"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" DROP CONSTRAINT "FK_26f3049a0f885c179aca543133e"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log" DROP CONSTRAINT "FK_4e6e69ae84e10e2ea360245ff86"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" DROP CONSTRAINT "FK_c2ef01f8cc6637b98e16b9ecb68"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" DROP CONSTRAINT "FK_fe91cef31a3bfaca8a2928c67ec"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" DROP CONSTRAINT "FK_7af7001a147e8641d0dc04d15a0"',
    );
    await queryRunner.query(
      'ALTER TABLE "inventory_transaction" DROP CONSTRAINT "FK_7a0918c35004b20f1715991eadb"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log_equipment" DROP CONSTRAINT "FK_fed8a5a82828d7011f756352476"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log_visitor" DROP CONSTRAINT "FK_0cfa4746cbf172282c026a12a88"',
    );
    await queryRunner.query(
      'ALTER TABLE "site_daily_log_labour" DROP CONSTRAINT "FK_6ec3e730acdd145617d7e4d561b"',
    );
    await queryRunner.query('DROP TABLE "contract"');
    await queryRunner.query('DROP TABLE "compliance_requirement"');
    await queryRunner.query('DROP TABLE "contract_party"');
    await queryRunner.query('DROP TABLE "compliance_record"');
    await queryRunner.query('DROP TABLE "contract_role_assignment"');
    await queryRunner.query('DROP TABLE "activity_log"');
    await queryRunner.query('DROP TABLE "comment"');
    await queryRunner.query('DROP TABLE "contract_status_history"');
    await queryRunner.query('DROP TABLE "document"');
    await queryRunner.query('DROP TABLE "conversation"');
    await queryRunner.query('DROP TABLE "document_version"');
    await queryRunner.query('DROP TABLE "conversation_participant"');
    await queryRunner.query('DROP TABLE "contract_stage"');
    await queryRunner.query('DROP TABLE "notification"');
    await queryRunner.query('DROP TABLE "message"');
    await queryRunner.query('DROP TABLE "document_link"');
    await queryRunner.query('DROP TABLE "invoice"');
    await queryRunner.query('DROP TABLE "milestone"');
    await queryRunner.query('DROP TABLE "invoice_line_item"');
    await queryRunner.query('DROP TABLE "contract_variation"');
    await queryRunner.query('DROP TABLE "contract_site"');
    await queryRunner.query('DROP TABLE "hse_incident"');
    await queryRunner.query('DROP TABLE "hse_inspection"');
    await queryRunner.query('DROP TABLE "hse_inspection_finding"');
    await queryRunner.query('DROP TABLE "hse_corrective_action"');
    await queryRunner.query('DROP TABLE "invoice_adjustment"');
    await queryRunner.query('DROP TABLE "payment"');
    await queryRunner.query('DROP TABLE "hse_incident_person"');
    await queryRunner.query('DROP TABLE "inventory_item"');
    await queryRunner.query('DROP TABLE "site_daily_log"');
    await queryRunner.query('DROP TABLE "inventory_transaction"');
    await queryRunner.query('DROP TABLE "site_daily_log_equipment"');
    await queryRunner.query('DROP TABLE "site_daily_log_visitor"');
    await queryRunner.query('DROP TABLE "site_daily_log_labour"');
    await queryRunner.query('DROP TYPE "public"."contract_contract_type_enum"');
    await queryRunner.query('DROP TYPE "public"."contract_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."compliance_requirement_category_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."compliance_requirement_applies_to_party_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."compliance_requirement_frequency_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."contract_party_party_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."compliance_record_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."contract_role_assignment_contract_role_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."comment_entity_type_enum"');
    await queryRunner.query('DROP TYPE "public"."comment_visibility_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."contract_status_history_from_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."contract_status_history_to_status_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."document_category_enum"');
    await queryRunner.query('DROP TYPE "public"."document_visibility_enum"');
    await queryRunner.query('DROP TYPE "public"."document_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."conversation_conversation_type_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."conversation_workspace_enum"');
    await queryRunner.query('DROP TYPE "public"."contract_stage_status_enum"');
    await queryRunner.query('DROP TYPE "public"."notification_channel_enum"');
    await queryRunner.query('DROP TYPE "public"."notification_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."document_link_entity_type_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."invoice_invoice_type_enum"');
    await queryRunner.query('DROP TYPE "public"."invoice_status_enum"');
    await queryRunner.query('DROP TYPE "public"."milestone_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."contract_variation_variation_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."contract_variation_status_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."contract_site_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."hse_incident_incident_type_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."hse_incident_severity_enum"');
    await queryRunner.query('DROP TYPE "public"."hse_incident_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."hse_inspection_inspection_type_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."hse_inspection_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."hse_inspection_overall_result_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."hse_inspection_finding_result_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."hse_inspection_finding_risk_level_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."hse_corrective_action_priority_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."hse_corrective_action_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."invoice_adjustment_adjustment_type_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."payment_payment_method_enum"');
    await queryRunner.query('DROP TYPE "public"."payment_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."hse_incident_person_involvement_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."site_daily_log_weather_condition_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."site_daily_log_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."inventory_transaction_transaction_type_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."site_daily_log_equipment_condition_enum"',
    );
  }
}
