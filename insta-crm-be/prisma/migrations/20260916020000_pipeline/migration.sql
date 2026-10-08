CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "stage_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "assigned_to" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pipeline_stages_business_id_idx"
ON "pipeline_stages"("business_id");
CREATE INDEX "pipeline_stages_business_id_position_idx"
ON "pipeline_stages"("business_id", "position");
CREATE INDEX "deals_business_id_idx" ON "deals"("business_id");
CREATE INDEX "deals_business_id_stage_id_idx"
ON "deals"("business_id", "stage_id");
CREATE INDEX "deals_business_id_contact_id_idx"
ON "deals"("business_id", "contact_id");
CREATE INDEX "deals_business_id_assigned_to_idx"
ON "deals"("business_id", "assigned_to");
CREATE INDEX "activity_logs_business_id_idx"
ON "activity_logs"("business_id");
CREATE INDEX "activity_logs_business_id_entity_type_entity_id_idx"
ON "activity_logs"("business_id", "entity_type", "entity_id");
CREATE INDEX "activity_logs_business_id_created_at_idx"
ON "activity_logs"("business_id", "created_at");

ALTER TABLE "pipeline_stages"
ADD CONSTRAINT "pipeline_stages_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deals"
ADD CONSTRAINT "deals_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deals"
ADD CONSTRAINT "deals_stage_id_fkey"
FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deals"
ADD CONSTRAINT "deals_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deals"
ADD CONSTRAINT "deals_assigned_to_fkey"
FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_logs"
ADD CONSTRAINT "activity_logs_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_logs"
ADD CONSTRAINT "activity_logs_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "pipeline_stages" (
    "id",
    "business_id",
    "name",
    "position",
    "color",
    "is_won",
    "is_lost",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    business."id",
    stage."name",
    stage."position",
    stage."color",
    stage."is_won",
    stage."is_lost",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "businesses" AS business
CROSS JOIN (
    VALUES
        ('New', 0, '#64748b', false, false),
        ('Contacted', 1, '#0284c7', false, false),
        ('Quoted', 2, '#7c3aed', false, false),
        ('Negotiation', 3, '#d97706', false, false),
        ('Won', 4, '#059669', true, false),
        ('Lost', 5, '#dc2626', false, true)
) AS stage("name", "position", "color", "is_won", "is_lost")
WHERE business."deleted_at" IS NULL;
