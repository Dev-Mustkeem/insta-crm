ALTER TYPE "TaskSource" ADD VALUE 'PAYMENT_REMINDER';

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER');

ALTER TABLE "businesses"
ADD COLUMN "e_invoice_applicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoice_sequence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "deal_id" UUID,
    "line_items" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "invoice_number" TEXT,
    "contact_id" UUID NOT NULL,
    "deal_id" UUID,
    "line_items" JSONB NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_total" DECIMAL(14,2) NOT NULL,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date" DATE NOT NULL,
    "issued_at" TIMESTAMP(3),
    "irn" TEXT,
    "qr_code_url" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quotations_business_id_idx" ON "quotations"("business_id");
CREATE INDEX "quotations_business_id_deal_id_created_at_idx" ON "quotations"("business_id", "deal_id", "created_at");
CREATE INDEX "quotations_business_id_contact_id_idx" ON "quotations"("business_id", "contact_id");

CREATE UNIQUE INDEX "invoices_business_id_invoice_number_key" ON "invoices"("business_id", "invoice_number");
CREATE INDEX "invoices_business_id_idx" ON "invoices"("business_id");
CREATE INDEX "invoices_business_id_status_due_date_idx" ON "invoices"("business_id", "status", "due_date");
CREATE INDEX "invoices_business_id_contact_id_idx" ON "invoices"("business_id", "contact_id");
CREATE INDEX "invoices_business_id_deal_id_idx" ON "invoices"("business_id", "deal_id");

CREATE INDEX "payments_business_id_idx" ON "payments"("business_id");
CREATE INDEX "payments_business_id_invoice_id_paid_at_idx" ON "payments"("business_id", "invoice_id", "paid_at");

ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_deal_id_fkey"
FOREIGN KEY ("deal_id") REFERENCES "deals"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_deal_id_fkey"
FOREIGN KEY ("deal_id") REFERENCES "deals"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments"
ADD CONSTRAINT "payments_invoice_id_fkey"
FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments"
ADD CONSTRAINT "payments_recorded_by_fkey"
FOREIGN KEY ("recorded_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
