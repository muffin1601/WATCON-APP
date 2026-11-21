-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'SITE', 'TRANSIT', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BillMatchMode" AS ENUM ('TWO_WAY', 'THREE_WAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CodeScope" ADD VALUE 'PARTY';
ALTER TYPE "CodeScope" ADD VALUE 'LOCATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleKey" ADD VALUE 'PROJECT_MANAGER';
ALTER TYPE "RoleKey" ADD VALUE 'SITE_ENGINEER';
ALTER TYPE "RoleKey" ADD VALUE 'PURCHASE';
ALTER TYPE "RoleKey" ADD VALUE 'STOREKEEPER';
ALTER TYPE "RoleKey" ADD VALUE 'ACCOUNTS';
ALTER TYPE "RoleKey" ADD VALUE 'VIEWER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockTxnType" ADD VALUE 'RECEIPT';
ALTER TYPE "StockTxnType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockTxnType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "StockTxnType" ADD VALUE 'RETURN_TO_SUPPLIER';
ALTER TYPE "StockTxnType" ADD VALUE 'CLIENT_DELIVERY';
ALTER TYPE "StockTxnType" ADD VALUE 'CONSUMPTION';
ALTER TYPE "StockTxnType" ADD VALUE 'WRITE_OFF';
ALTER TYPE "StockTxnType" ADD VALUE 'REVERSAL';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "project_id" UUID;

-- AlterTable
ALTER TABLE "item_brands" ADD COLUMN     "last_purchase_rate" DECIMAL(18,4),
ADD COLUMN     "preferred_supplier_id" UUID,
ADD COLUMN     "reorder_level" DECIMAL(14,3);

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "gst_rate" DECIMAL(5,2),
ADD COLUMN     "hsn_code" TEXT;

-- AlterTable
ALTER TABLE "stock_transactions" ADD COLUMN     "location_id" UUID,
ADD COLUMN     "project_id" UUID,
ADD COLUMN     "reversal_of_id" UUID,
ADD COLUMN     "unit_cost" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "org_settings" (
    "organization_id" UUID NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "state_code" TEXT,
    "enforce_segregation" BOOLEAN NOT NULL DEFAULT true,
    "allow_receipt_on_unapproved_po" BOOLEAN NOT NULL DEFAULT false,
    "bill_match_mode" "BillMatchMode" NOT NULL DEFAULT 'THREE_WAY',
    "receipt_tolerance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rate_tolerance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "po_terms" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "document_series" (
    "organization_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 4,
    "include_fiscal_year" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_series_pkey" PRIMARY KEY ("organization_id","doc_type")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "organization_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("organization_id","doc_type","fiscal_year")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "is_client" BOOLEAN NOT NULL DEFAULT false,
    "is_supplier" BOOLEAN NOT NULL DEFAULT false,
    "gstin" TEXT,
    "pan" TEXT,
    "state_code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp_number" TEXT,
    "payment_terms_days" INTEGER,
    "credit_limit" DECIMAL(18,2),
    "tds_section" TEXT,
    "tds_rate" DECIMAL(5,2),
    "bank_name" TEXT,
    "bank_account" TEXT,
    "ifsc" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "project_id" UUID,
    "address" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "issued_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_driver" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" UUID,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "verification_note" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "accuracy_m" INTEGER,
    "captured_at" TIMESTAMP(3),
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "delete_reason" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_blobs" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_blobs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "approval_limits" (
    "organization_id" UUID NOT NULL,
    "role_key" "RoleKey" NOT NULL,
    "doc_type" TEXT NOT NULL,
    "max_amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "approval_limits_pkey" PRIMARY KEY ("organization_id","role_key","doc_type")
);

-- CreateIndex
CREATE INDEX "parties_organization_id_name_idx" ON "parties"("organization_id", "name");

-- CreateIndex
CREATE INDEX "parties_organization_id_is_client_idx" ON "parties"("organization_id", "is_client");

-- CreateIndex
CREATE INDEX "parties_organization_id_is_supplier_idx" ON "parties"("organization_id", "is_supplier");

-- CreateIndex
CREATE UNIQUE INDEX "parties_organization_id_code_key" ON "parties"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_project_id_key" ON "stock_locations"("project_id");

-- CreateIndex
CREATE INDEX "stock_locations_organization_id_type_idx" ON "stock_locations"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_organization_id_code_key" ON "stock_locations"("organization_id", "code");

-- CreateIndex
CREATE INDEX "stock_balances_location_id_idx" ON "stock_balances"("location_id");

-- CreateIndex
CREATE INDEX "stock_balances_organization_id_item_id_idx" ON "stock_balances"("organization_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_item_brand_id_location_id_key" ON "stock_balances"("item_brand_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_reservations_item_brand_id_location_id_status_idx" ON "stock_reservations"("item_brand_id", "location_id", "status");

-- CreateIndex
CREATE INDEX "stock_reservations_project_id_status_idx" ON "stock_reservations"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_previous_version_id_key" ON "attachments"("previous_version_id");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "attachments_organization_id_project_id_created_at_idx" ON "attachments"("organization_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_organization_id_category_idx" ON "attachments"("organization_id", "category");

-- CreateIndex
CREATE INDEX "audit_logs_project_id_created_at_idx" ON "audit_logs"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_reversal_of_id_key" ON "stock_transactions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "stock_transactions_item_brand_id_location_id_txn_date_idx" ON "stock_transactions"("item_brand_id", "location_id", "txn_date");

-- CreateIndex
CREATE INDEX "stock_transactions_location_id_txn_date_idx" ON "stock_transactions"("location_id", "txn_date");

-- CreateIndex
CREATE INDEX "stock_transactions_project_id_idx" ON "stock_transactions"("project_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_brands" ADD CONSTRAINT "item_brands_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "stock_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_series" ADD CONSTRAINT "document_series_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_limits" ADD CONSTRAINT "approval_limits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ───────────── Data back-fill (hand-written; additive, keeps every existing row) ─────────────
-- Every organisation gets its system locations. Existing single-store stock becomes
-- "Central Warehouse" stock, so balances and the ledger stay identical.
INSERT INTO "stock_locations" ("id", "organization_id", "code", "name", "type", "is_system", "status", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", v.code, v.name, v.type::"LocationType", true, 'ACTIVE', now(), now()
FROM "organizations" o
CROSS JOIN (VALUES ('WH-MAIN', 'Central Warehouse', 'WAREHOUSE'), ('TRANSIT', 'Goods in transit', 'TRANSIT'), ('QC-HOLD', 'Damaged / quarantine', 'QUARANTINE')) AS v(code, name, type)
ON CONFLICT DO NOTHING;

INSERT INTO "stock_balances" ("id", "organization_id", "item_brand_id", "location_id", "item_id", "brand_id", "on_hand", "updated_at")
SELECT gen_random_uuid(), ib."organization_id", ib."id", l."id", ib."item_id", ib."brand_id", ib."current_qty", now()
FROM "item_brands" ib
JOIN "stock_locations" l ON l."organization_id" = ib."organization_id" AND l."code" = 'WH-MAIN'
WHERE EXISTS (SELECT 1 FROM "stock_transactions" t WHERE t."item_brand_id" = ib."id") OR ib."current_qty" <> 0;

UPDATE "stock_transactions" t
SET "location_id" = l."id"
FROM "stock_locations" l
WHERE l."organization_id" = t."organization_id" AND l."code" = 'WH-MAIN' AND t."location_id" IS NULL;

ALTER TABLE "stock_transactions" ALTER COLUMN "location_id" SET NOT NULL;

-- ───────────── Database-level guards (defence in depth; services enforce the same rules) ─────────────
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_on_hand_non_negative" CHECK ("on_hand" >= 0);
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_issued_range" CHECK ("issued_qty" >= 0 AND "issued_qty" <= "quantity");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_positive" CHECK ("size_bytes" > 0);
ALTER TABLE "approval_limits" ADD CONSTRAINT "approval_limits_amount_non_negative" CHECK ("max_amount" >= 0);
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_site_has_project" CHECK ("type" <> 'SITE' OR "project_id" IS NOT NULL);
-- One GSTIN per party within an organisation (blank GSTIN allowed for unregistered parties).
CREATE UNIQUE INDEX "parties_org_gstin_key" ON "parties" ("organization_id", "gstin") WHERE "gstin" IS NOT NULL;
-- Case-insensitive party-name uniqueness per organisation.
CREATE UNIQUE INDEX "parties_org_lower_name_key" ON "parties" ("organization_id", lower("name"));
