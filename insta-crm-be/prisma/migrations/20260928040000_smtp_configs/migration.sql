CREATE TABLE "smtp_configs" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "sender_email" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "security" TEXT NOT NULL DEFAULT 'STARTTLS',
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "smtp_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "smtp_configs_business_id_key" ON "smtp_configs"("business_id");

ALTER TABLE "smtp_configs"
    ADD CONSTRAINT "smtp_configs_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
