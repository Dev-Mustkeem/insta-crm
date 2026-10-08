CREATE TABLE "evidence_vault_sso_codes" (
  "code_hash" CHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_vault_sso_codes_pkey" PRIMARY KEY ("code_hash"),
  CONSTRAINT "evidence_vault_sso_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "evidence_vault_sso_codes_expires_at_idx" ON "evidence_vault_sso_codes"("expires_at");