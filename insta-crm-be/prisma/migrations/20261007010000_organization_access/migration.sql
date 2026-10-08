ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' BEFORE 'OWNER';

CREATE TYPE "AppPage" AS ENUM (
  'DASHBOARD',
  'EVIDENCE_VAULT',
  'EMAIL',
  'LEADS',
  'CONTACTS',
  'BROADCASTS',
  'PIPELINE',
  'TASKS',
  'BILLING',
  'AUDIT',
  'USER_MANAGEMENT'
);

CREATE TYPE "AccessLevel" AS ENUM ('NONE', 'READ', 'WRITE');

CREATE TABLE "user_page_permissions" (
  "user_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "page" "AppPage" NOT NULL,
  "access" "AccessLevel" NOT NULL DEFAULT 'NONE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_page_permissions_pkey" PRIMARY KEY ("user_id", "page")
);

CREATE TABLE "organization_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "token_hash" CHAR(64) NOT NULL,
  "invited_by_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invitations_token_hash_key"
  ON "organization_invitations"("token_hash");
CREATE INDEX "user_page_permissions_business_id_user_id_idx"
  ON "user_page_permissions"("business_id", "user_id");
CREATE INDEX "organization_invitations_business_id_email_idx"
  ON "organization_invitations"("business_id", "email");
CREATE INDEX "organization_invitations_business_id_expires_at_idx"
  ON "organization_invitations"("business_id", "expires_at");

ALTER TABLE "user_page_permissions"
  ADD CONSTRAINT "user_page_permissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_page_permissions"
  ADD CONSTRAINT "user_page_permissions_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_invited_by_id_fkey"
  FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
