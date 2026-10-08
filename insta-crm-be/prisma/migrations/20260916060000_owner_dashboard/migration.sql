ALTER TABLE "businesses"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE "whatsapp_connections"
ADD COLUMN "digest_template_name" TEXT,
ADD COLUMN "digest_template_language" TEXT NOT NULL DEFAULT 'en_US';

CREATE INDEX "contacts_business_id_created_at_source_idx"
ON "contacts"("business_id", "created_at", "source");

CREATE INDEX "deals_business_id_stage_changed_at_idx"
ON "deals"("business_id", "stage_changed_at");
