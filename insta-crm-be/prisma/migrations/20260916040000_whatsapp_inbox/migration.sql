CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'CALL');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "WhatsAppProvider" AS ENUM ('DIALOG360');

CREATE TABLE "whatsapp_connections" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'DIALOG360',
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "reminder_template_name" TEXT,
    "reminder_template_language" TEXT NOT NULL DEFAULT 'en_US',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "assigned_to" UUID,
    "last_message_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "external_message_id" TEXT,
    "sent_by" UUID,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_notes" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_connections_business_id_key"
ON "whatsapp_connections"("business_id");
CREATE UNIQUE INDEX "whatsapp_connections_phone_number_id_key"
ON "whatsapp_connections"("phone_number_id");
CREATE INDEX "whatsapp_connections_business_id_idx"
ON "whatsapp_connections"("business_id");

CREATE UNIQUE INDEX "conversations_business_id_channel_contact_id_key"
ON "conversations"("business_id", "channel", "contact_id");
CREATE INDEX "conversations_business_id_idx"
ON "conversations"("business_id");
CREATE INDEX "conversations_business_id_last_message_at_idx"
ON "conversations"("business_id", "last_message_at");
CREATE INDEX "conversations_business_id_assigned_to_idx"
ON "conversations"("business_id", "assigned_to");
CREATE INDEX "conversations_business_id_contact_id_idx"
ON "conversations"("business_id", "contact_id");

CREATE UNIQUE INDEX "messages_business_id_external_message_id_key"
ON "messages"("business_id", "external_message_id");
CREATE INDEX "messages_business_id_idx" ON "messages"("business_id");
CREATE INDEX "messages_business_id_conversation_id_created_at_idx"
ON "messages"("business_id", "conversation_id", "created_at");
CREATE INDEX "messages_business_id_status_idx"
ON "messages"("business_id", "status");

CREATE INDEX "conversation_notes_business_id_idx"
ON "conversation_notes"("business_id");
CREATE INDEX "conversation_notes_business_id_conversation_id_created_at_idx"
ON "conversation_notes"("business_id", "conversation_id", "created_at");

ALTER TABLE "whatsapp_connections"
ADD CONSTRAINT "whatsapp_connections_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_assigned_to_fkey"
FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages"
ADD CONSTRAINT "messages_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages"
ADD CONSTRAINT "messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages"
ADD CONSTRAINT "messages_sent_by_fkey"
FOREIGN KEY ("sent_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_notes"
ADD CONSTRAINT "conversation_notes_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_notes"
ADD CONSTRAINT "conversation_notes_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_notes"
ADD CONSTRAINT "conversation_notes_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
