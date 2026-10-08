ALTER TABLE "businesses"
ADD COLUMN "gstin" TEXT,
ADD COLUMN "state_code" TEXT;

ALTER TABLE "contacts"
ADD COLUMN "assigned_to" UUID,
ADD COLUMN "credit_terms_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "gstin" TEXT,
ADD COLUMN "billing_state_code" TEXT;

UPDATE "contacts" SET "assigned_to" = "created_by" WHERE "assigned_to" IS NULL;

ALTER TABLE "contacts" ALTER COLUMN "assigned_to" SET NOT NULL;

ALTER TABLE "contacts"
ADD CONSTRAINT "contacts_assigned_to_fkey"
FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "contacts_business_id_assigned_to_idx"
ON "contacts"("business_id", "assigned_to");

ALTER TABLE "messages" ADD COLUMN "subject" TEXT;

ALTER TABLE "invoices"
ADD COLUMN "credit_terms_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "credit_terms_breached_at" TIMESTAMP(3);

UPDATE "invoices" AS invoice
SET "credit_terms_days" = contact."credit_terms_days"
FROM "contacts" AS contact
WHERE invoice."contact_id" = contact."id";

CREATE TABLE "channel_connections" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "sms_auth_key_encrypted" TEXT,
  "sms_flow_id" TEXT,
  "sms_message_variable" TEXT NOT NULL DEFAULT 'message',
  "sms_sender_id" TEXT,
  "sms_webhook_token_hash" TEXT,
  "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
  "resend_api_key_encrypted" TEXT,
  "resend_from_name" TEXT,
  "resend_from_email" TEXT,
  "resend_receiving_address" TEXT,
  "resend_webhook_secret_encrypted" TEXT,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_connections_business_id_key"
ON "channel_connections"("business_id");

CREATE UNIQUE INDEX "channel_connections_resend_receiving_address_key"
ON "channel_connections"("resend_receiving_address");

CREATE INDEX "channel_connections_business_id_idx"
ON "channel_connections"("business_id");

ALTER TABLE "channel_connections"
ADD CONSTRAINT "channel_connections_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
