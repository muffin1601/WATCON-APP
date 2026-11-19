-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('OPENING', 'INWARD', 'OUTWARD', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CodeScope" ADD VALUE 'ITEM';
ALTER TYPE "CodeScope" ADD VALUE 'BRAND';
ALTER TYPE "CodeScope" ADD VALUE 'STOCK_TXN';

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_brands" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "current_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "type" "StockTxnType" NOT NULL,
    "direction" "StockDirection" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "balance_after" DECIMAL(14,3) NOT NULL,
    "txn_date" DATE NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "items_organization_id_status_idx" ON "items"("organization_id", "status");

-- CreateIndex
CREATE INDEX "items_organization_id_name_idx" ON "items"("organization_id", "name");

-- CreateIndex
CREATE INDEX "items_organization_id_category_idx" ON "items"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "items_organization_id_code_key" ON "items"("organization_id", "code");

-- CreateIndex
CREATE INDEX "brands_organization_id_status_idx" ON "brands"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "brands_organization_id_code_key" ON "brands"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "brands_organization_id_name_key" ON "brands"("organization_id", "name");

-- CreateIndex
CREATE INDEX "item_brands_organization_id_idx" ON "item_brands"("organization_id");

-- CreateIndex
CREATE INDEX "item_brands_brand_id_idx" ON "item_brands"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_brands_item_id_brand_id_key" ON "item_brands"("item_id", "brand_id");

-- CreateIndex
CREATE INDEX "stock_transactions_item_brand_id_txn_date_created_at_idx" ON "stock_transactions"("item_brand_id", "txn_date", "created_at");

-- CreateIndex
CREATE INDEX "stock_transactions_organization_id_txn_date_idx" ON "stock_transactions"("organization_id", "txn_date");

-- CreateIndex
CREATE INDEX "stock_transactions_item_id_idx" ON "stock_transactions"("item_id");

-- CreateIndex
CREATE INDEX "stock_transactions_brand_id_idx" ON "stock_transactions"("brand_id");

-- CreateIndex
CREATE INDEX "stock_transactions_source_type_source_id_idx" ON "stock_transactions"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_organization_id_code_key" ON "stock_transactions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_organization_id_idempotency_key_key" ON "stock_transactions"("organization_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_brands" ADD CONSTRAINT "item_brands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_brands" ADD CONSTRAINT "item_brands_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_brands" ADD CONSTRAINT "item_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guards (defence in depth; the services enforce the same rules).
ALTER TABLE "item_brands" ADD CONSTRAINT "item_brands_current_qty_non_negative" CHECK ("current_qty" >= 0);
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_balance_non_negative" CHECK ("balance_after" >= 0);
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_adjustment_reason" CHECK ("type" <> 'ADJUSTMENT' OR length(trim("reason")) > 0);
