CREATE TYPE "WhatsAppCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "WhatsAppCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED_OPT_OUT');

ALTER TABLE "contacts" ADD COLUMN "whatsapp_opted_out" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "whatsapp_campaigns" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "template_name" TEXT NOT NULL,
  "template_language" TEXT NOT NULL,
  "parameters" JSONB NOT NULL DEFAULT '[]',
  "tag_filter" TEXT,
  "source_filter" "ContactSource",
  "status" "WhatsAppCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_campaigns_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "whatsapp_campaigns_business_id_idx" ON "whatsapp_campaigns"("business_id");
CREATE INDEX "whatsapp_campaigns_business_id_status_created_at_idx" ON "whatsapp_campaigns"("business_id", "status", "created_at");

CREATE TABLE "whatsapp_campaign_recipients" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "campaign_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "status" "WhatsAppCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "external_message_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_campaign_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "whatsapp_campaign_recipients_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "whatsapp_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "whatsapp_campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "whatsapp_campaign_recipients_campaign_id_contact_id_key" ON "whatsapp_campaign_recipients"("campaign_id", "contact_id");
CREATE UNIQUE INDEX "whatsapp_campaign_recipients_business_id_external_message_id_key" ON "whatsapp_campaign_recipients"("business_id", "external_message_id");
CREATE INDEX "whatsapp_campaign_recipients_business_id_idx" ON "whatsapp_campaign_recipients"("business_id");
CREATE INDEX "whatsapp_campaign_recipients_business_id_campaign_id_status_idx" ON "whatsapp_campaign_recipients"("business_id", "campaign_id", "status");

CREATE TABLE "marketplace_leads" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "message" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "contact_id" UUID,
  "task_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_leads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "marketplace_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "marketplace_leads_business_id_provider_external_id_key" ON "marketplace_leads"("business_id", "provider", "external_id");
CREATE INDEX "marketplace_leads_business_id_idx" ON "marketplace_leads"("business_id");
CREATE INDEX "marketplace_leads_business_id_created_at_idx" ON "marketplace_leads"("business_id", "created_at");
