CREATE TABLE "lead_batches" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "total_leads" INTEGER NOT NULL,
    "hot_count" INTEGER NOT NULL,
    "warm_count" INTEGER NOT NULL,
    "cold_count" INTEGER NOT NULL,
    "leads" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_batches_business_id_idx" ON "lead_batches"("business_id");
CREATE INDEX "lead_batches_business_id_created_at_idx" ON "lead_batches"("business_id", "created_at");

ALTER TABLE "lead_batches"
    ADD CONSTRAINT "lead_batches_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
