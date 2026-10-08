CREATE TABLE "gmail_oauth_configs" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "client_id_encrypted" TEXT NOT NULL,
  "client_secret_encrypted" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "gmail_oauth_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gmail_oauth_configs_business_id_key"
  ON "gmail_oauth_configs"("business_id");

ALTER TABLE "gmail_oauth_configs"
  ADD CONSTRAINT "gmail_oauth_configs_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
