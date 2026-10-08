CREATE TABLE "lead_trackers" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "next_follow_up" TIMESTAMP(3),
    "stage_notes" JSONB NOT NULL DEFAULT '{}',
    "history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_trackers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_trackers_batch_id_lead_id_key" ON "lead_trackers"("batch_id", "lead_id");
CREATE INDEX "lead_trackers_business_id_idx" ON "lead_trackers"("business_id");
CREATE INDEX "lead_trackers_business_id_batch_id_idx" ON "lead_trackers"("business_id", "batch_id");

ALTER TABLE "lead_trackers"
    ADD CONSTRAINT "lead_trackers_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lead_trackers"
    ADD CONSTRAINT "lead_trackers_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "lead_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
