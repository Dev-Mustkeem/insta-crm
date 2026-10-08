CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE', 'OVERDUE');
CREATE TYPE "RelatedEntityType" AS ENUM ('CONTACT', 'DEAL', 'INVOICE');
CREATE TYPE "TaskSource" AS ENUM (
    'MANUAL',
    'CONTACT_CREATED',
    'STALE_DEAL_STAGE'
);

ALTER TABLE "deals"
ADD COLUMN "stage_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "assigned_to" UUID NOT NULL,
    "related_entity_type" "RelatedEntityType" NOT NULL,
    "related_entity_id" UUID NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_business_id_idx" ON "tasks"("business_id");
CREATE INDEX "tasks_business_id_status_due_at_idx"
ON "tasks"("business_id", "status", "due_at");
CREATE INDEX "tasks_business_id_related_entity_type_related_entity_id_idx"
ON "tasks"("business_id", "related_entity_type", "related_entity_id");
CREATE INDEX "tasks_business_id_assigned_to_idx"
ON "tasks"("business_id", "assigned_to");

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_assigned_to_fkey"
FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
