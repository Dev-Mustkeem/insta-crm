CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'PURCHASE', 'ADJUSTMENT', 'SALE');

ALTER TABLE "businesses" ADD COLUMN "inventory_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "inventory_items" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'piece',
  "quantity_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "reorder_level" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "selling_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "inventory_items_business_id_sku_key" ON "inventory_items"("business_id", "sku");
CREATE INDEX "inventory_items_business_id_idx" ON "inventory_items"("business_id");
CREATE INDEX "inventory_items_business_id_active_idx" ON "inventory_items"("business_id", "active");

CREATE TABLE "stock_movements" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "inventory_item_id" UUID NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity_delta" DECIMAL(14,3) NOT NULL,
  "reason" TEXT,
  "reference" TEXT,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "stock_movements_business_id_idx" ON "stock_movements"("business_id");
CREATE INDEX "stock_movements_business_id_inventory_item_id_created_at_idx" ON "stock_movements"("business_id", "inventory_item_id", "created_at");
CREATE INDEX "stock_movements_business_id_reference_idx" ON "stock_movements"("business_id", "reference");
