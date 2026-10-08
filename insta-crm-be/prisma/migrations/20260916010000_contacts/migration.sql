CREATE TYPE "ContactSource" AS ENUM (
    'WHATSAPP',
    'WEBSITE',
    'MARKETPLACE',
    'WALK_IN',
    'REFERRAL',
    'OTHER'
);

CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalized_phone" TEXT NOT NULL,
    "email" TEXT,
    "source" "ContactSource" NOT NULL DEFAULT 'OTHER',
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contacts_business_id_idx" ON "contacts"("business_id");
CREATE INDEX "contacts_business_id_normalized_phone_idx"
ON "contacts"("business_id", "normalized_phone");
CREATE INDEX "contacts_business_id_source_idx"
ON "contacts"("business_id", "source");
CREATE INDEX "contacts_tags_idx" ON "contacts" USING GIN ("tags");

ALTER TABLE "contacts"
ADD CONSTRAINT "contacts_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts"
ADD CONSTRAINT "contacts_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
