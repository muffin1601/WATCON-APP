-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_ORDERED', 'ORDERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SENT', 'RESPONSES_IN', 'AWARD_PENDING', 'AWARDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('RECEIVED', 'SUPERSEDED', 'AWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('INTRA', 'INTER');

-- CreateEnum
CREATE TYPE "ChallanType" AS ENUM ('ISSUE_TO_SITE', 'SITE_TO_SITE', 'RETURN_TO_STORE', 'RETURN_TO_SUPPLIER', 'CLIENT_DELIVERY');

-- CreateEnum
CREATE TYPE "ChallanStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NOT_MATCHED', 'MATCHED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'UPI', 'CASH', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('SUPPLIER', 'CLIENT');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SoStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RaBillStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'SUBMITTED', 'CLIENT_CERTIFIED', 'DISPUTED', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "material_requirements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "required_qty" DECIMAL(14,3) NOT NULL,
    "required_by" DATE,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "status" "RequirementStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "project_id" UUID,
    "delivery_location_id" UUID,
    "required_by" DATE,
    "purpose" TEXT,
    "status" "PrStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "status_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_lines" (
    "id" UUID NOT NULL,
    "pr_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "ordered_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "required_by" DATE,
    "requirement_id" UUID,
    "notes" TEXT,

    CONSTRAINT "pr_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "project_id" UUID,
    "pr_id" UUID,
    "title" TEXT NOT NULL,
    "delivery_location_id" UUID,
    "delivery_address" TEXT,
    "required_by" DATE,
    "response_due" DATE,
    "payment_terms" TEXT,
    "freight_terms" TEXT,
    "tax_terms" TEXT,
    "validity_days" INTEGER,
    "specifications" TEXT,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "award_note" TEXT,
    "award_proposed_by_id" UUID,
    "award_proposed_at" TIMESTAMP(3),
    "award_approved_by_id" UUID,
    "award_approved_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_lines" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "item_brand_id" UUID,
    "acceptable_brands" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "specifications" TEXT,
    "pr_line_id" UUID,

    CONSTRAINT "rfq_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_suppliers" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "sent_at" TIMESTAMP(3),
    "sent_via" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quotations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "rfq_id" UUID,
    "party_id" UUID NOT NULL,
    "supplier_ref" TEXT,
    "quote_date" DATE NOT NULL,
    "valid_until" DATE,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" UUID,
    "freight" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "freight_gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "payment_terms" TEXT,
    "delivery_days" INTEGER,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "status" "QuotationStatus" NOT NULL DEFAULT 'RECEIVED',
    "remarks" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_lines" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "rfq_line_id" UUID,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lead_time_days" INTEGER,
    "remarks" TEXT,
    "awarded_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "project_id" UUID,
    "party_id" UUID NOT NULL,
    "delivery_location_id" UUID NOT NULL,
    "delivery_address" TEXT,
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "payment_terms" TEXT,
    "advance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "terms" TEXT,
    "internal_remarks" TEXT,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "place_of_supply" TEXT,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "charges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "charges_gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAFT',
    "rfq_id" UUID,
    "pr_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgement_ref" TEXT,
    "status_note" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_lines" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "description" TEXT,
    "hsn_code" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "received_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "accepted_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "rejected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "returned_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "billed_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "pr_line_id" UUID,
    "quotation_line_id" UUID,

    CONSTRAINT "po_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_revisions" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ChallanType" NOT NULL,
    "project_id" UUID,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "party_id" UUID,
    "po_id" UUID,
    "so_id" UUID,
    "dispatch_date" DATE,
    "expected_date" DATE,
    "delivered_date" DATE,
    "vehicle_no" TEXT,
    "transporter" TEXT,
    "lr_number" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "sender_name" TEXT,
    "receiver_name" TEXT,
    "remarks" TEXT,
    "status" "ChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "status_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "dispatched_by_id" UUID,
    "dispatched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challan_lines" (
    "id" UUID NOT NULL,
    "challan_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "received_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "damaged_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "written_off_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "po_line_id" UUID,
    "so_line_id" UUID,
    "remarks" TEXT,

    CONSTRAINT "challan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "project_id" UUID,
    "location_id" UUID NOT NULL,
    "po_id" UUID,
    "challan_id" UUID,
    "party_id" UUID,
    "receipt_date" DATE NOT NULL,
    "supplier_challan_no" TEXT,
    "supplier_invoice_no" TEXT,
    "vehicle_no" TEXT,
    "received_by_name" TEXT,
    "remarks" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
    "status_note" TEXT,
    "client_key" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "reversed_by_id" UUID,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_lines" (
    "id" UUID NOT NULL,
    "grn_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "po_line_id" UUID,
    "challan_line_id" UUID,
    "item_brand_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "expected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "received_qty" DECIMAL(14,3) NOT NULL,
    "accepted_qty" DECIMAL(14,3) NOT NULL,
    "damaged_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "rejected_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(18,4),
    "billed_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "grn_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "party_id" UUID NOT NULL,
    "project_id" UUID,
    "po_id" UUID,
    "supplier_invoice_no" TEXT NOT NULL,
    "invoice_key" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "supplier_gstin" TEXT,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "charges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "charges_gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tds_section" TEXT,
    "tds_rate" DECIMAL(5,2),
    "tds_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjusted_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "match_status" "MatchStatus" NOT NULL DEFAULT 'NOT_MATCHED',
    "exceptions" JSONB,
    "override_reason" TEXT,
    "status_note" TEXT,
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bill_lines" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "po_line_id" UUID,
    "grn_line_id" UUID,
    "item_brand_id" UUID,
    "description" TEXT NOT NULL,
    "hsn_code" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "party_id" UUID NOT NULL,
    "project_id" UUID,
    "payment_date" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "bank_account" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "tds_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allocated_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "remarks" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "supplier_bill_id" UUID,
    "client_invoice_id" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "allocated_by_id" UUID NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMP(3),
    "reversed_by_id" UUID,
    "reverse_reason" TEXT,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "note_type" "NoteType" NOT NULL,
    "party_role" "PartyRole" NOT NULL,
    "party_id" UUID NOT NULL,
    "project_id" UUID,
    "supplier_bill_id" UUID,
    "client_invoice_id" UUID,
    "note_date" DATE NOT NULL,
    "party_note_ref" TEXT,
    "reason" TEXT NOT NULL,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "taxable" DECIMAL(18,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustment_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_pos" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "client_po_number" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "po_date" DATE NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "scope" TEXT,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "retention_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "advance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_recovery_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "place_of_supply" TEXT,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "original_total" DECIMAL(18,2),
    "original_taxable" DECIMAL(18,2),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "status_note" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_po_lines" (
    "id" UUID NOT NULL,
    "client_po_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "boq_ref" TEXT,
    "description" TEXT NOT NULL,
    "item_id" UUID,
    "hsn_sac" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "client_po_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_po_revisions" (
    "id" UUID NOT NULL,
    "client_po_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "is_variation" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_po_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_po_milestones" (
    "id" UUID NOT NULL,
    "client_po_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(5,2),
    "amount" DECIMAL(18,2),
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "client_po_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "client_po_id" UUID,
    "order_date" DATE NOT NULL,
    "delivery_date" DATE,
    "delivery_address" TEXT,
    "delivery_schedule" TEXT,
    "billing_schedule" TEXT,
    "payment_terms" TEXT,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "SoStatus" NOT NULL DEFAULT 'DRAFT',
    "status_note" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "so_lines" (
    "id" UUID NOT NULL,
    "so_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "client_po_line_id" UUID,
    "item_brand_id" UUID,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "delivered_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "returned_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "invoiced_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "so_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_bills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "ra_number" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "client_po_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "bill_date" DATE NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "status" "RaBillStatus" NOT NULL DEFAULT 'DRAFT',
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "claimed_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "certified_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retention_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "retention_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_recovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deduction_notes" TEXT,
    "gst_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "engineer_certified_by_id" UUID,
    "engineer_certified_at" TIMESTAMP(3),
    "client_cert_ref" TEXT,
    "client_cert_date" DATE,
    "certified_by_id" UUID,
    "dispute_note" TEXT,
    "status_note" TEXT,
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_bill_lines" (
    "id" UUID NOT NULL,
    "ra_bill_id" UUID NOT NULL,
    "client_po_line_id" UUID NOT NULL,
    "contract_qty" DECIMAL(14,3) NOT NULL,
    "prev_certified_qty" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "claimed_qty" DECIMAL(14,3) NOT NULL,
    "claimed_amount" DECIMAL(18,2) NOT NULL,
    "certified_qty" DECIMAL(14,3),
    "certified_amount" DECIMAL(18,2),
    "measurement_ref" TEXT,
    "remarks" TEXT,

    CONSTRAINT "ra_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "client_po_id" UUID,
    "ra_bill_id" UUID,
    "so_id" UUID,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE,
    "place_of_supply" TEXT,
    "tax_mode" "TaxMode" NOT NULL DEFAULT 'INTRA',
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cgst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retention_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_recovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_receivable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "received_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjusted_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "status_note" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "issued_by_id" UUID,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "so_line_id" UUID,
    "client_po_line_id" UUID,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "location_id" UUID NOT NULL,
    "count_date" DATE NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL,
    "count_id" UUID NOT NULL,
    "item_brand_id" UUID NOT NULL,
    "system_qty" DECIMAL(14,3) NOT NULL,
    "counted_qty" DECIMAL(14,3) NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_requirements_organization_id_status_idx" ON "material_requirements"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "material_requirements_project_id_item_brand_id_key" ON "material_requirements"("project_id", "item_brand_id");

-- CreateIndex
CREATE INDEX "purchase_requisitions_organization_id_status_idx" ON "purchase_requisitions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "purchase_requisitions_project_id_idx" ON "purchase_requisitions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_organization_id_number_key" ON "purchase_requisitions"("organization_id", "number");

-- CreateIndex
CREATE INDEX "pr_lines_item_brand_id_idx" ON "pr_lines"("item_brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_lines_pr_id_line_no_key" ON "pr_lines"("pr_id", "line_no");

-- CreateIndex
CREATE INDEX "rfqs_organization_id_status_idx" ON "rfqs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "rfqs_project_id_idx" ON "rfqs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_organization_id_number_key" ON "rfqs"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_lines_rfq_id_line_no_key" ON "rfq_lines"("rfq_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_suppliers_rfq_id_party_id_key" ON "rfq_suppliers"("rfq_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotations_supersedes_id_key" ON "supplier_quotations"("supersedes_id");

-- CreateIndex
CREATE INDEX "supplier_quotations_rfq_id_idx" ON "supplier_quotations"("rfq_id");

-- CreateIndex
CREATE INDEX "supplier_quotations_party_id_idx" ON "supplier_quotations"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotations_organization_id_number_key" ON "supplier_quotations"("organization_id", "number");

-- CreateIndex
CREATE INDEX "quotation_lines_rfq_line_id_idx" ON "quotation_lines"("rfq_line_id");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_status_idx" ON "purchase_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_project_id_idx" ON "purchase_orders"("project_id");

-- CreateIndex
CREATE INDEX "purchase_orders_party_id_idx" ON "purchase_orders"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_number_key" ON "purchase_orders"("organization_id", "number");

-- CreateIndex
CREATE INDEX "po_lines_item_brand_id_idx" ON "po_lines"("item_brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "po_lines_po_id_line_no_key" ON "po_lines"("po_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "po_revisions_po_id_revision_key" ON "po_revisions"("po_id", "revision");

-- CreateIndex
CREATE INDEX "challans_organization_id_status_idx" ON "challans"("organization_id", "status");

-- CreateIndex
CREATE INDEX "challans_project_id_idx" ON "challans"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "challans_organization_id_number_key" ON "challans"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "challan_lines_challan_id_line_no_key" ON "challan_lines"("challan_id", "line_no");

-- CreateIndex
CREATE INDEX "grns_organization_id_status_idx" ON "grns"("organization_id", "status");

-- CreateIndex
CREATE INDEX "grns_project_id_idx" ON "grns"("project_id");

-- CreateIndex
CREATE INDEX "grns_po_id_idx" ON "grns"("po_id");

-- CreateIndex
CREATE UNIQUE INDEX "grns_organization_id_number_key" ON "grns"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "grns_organization_id_client_key_key" ON "grns"("organization_id", "client_key");

-- CreateIndex
CREATE INDEX "grn_lines_po_line_id_idx" ON "grn_lines"("po_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "grn_lines_grn_id_line_no_key" ON "grn_lines"("grn_id", "line_no");

-- CreateIndex
CREATE INDEX "supplier_bills_organization_id_status_idx" ON "supplier_bills"("organization_id", "status");

-- CreateIndex
CREATE INDEX "supplier_bills_party_id_invoice_key_idx" ON "supplier_bills"("party_id", "invoice_key");

-- CreateIndex
CREATE INDEX "supplier_bills_project_id_idx" ON "supplier_bills"("project_id");

-- CreateIndex
CREATE INDEX "supplier_bills_po_id_idx" ON "supplier_bills"("po_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_organization_id_number_key" ON "supplier_bills"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bill_lines_bill_id_line_no_key" ON "supplier_bill_lines"("bill_id", "line_no");

-- CreateIndex
CREATE INDEX "payments_organization_id_direction_payment_date_idx" ON "payments"("organization_id", "direction", "payment_date");

-- CreateIndex
CREATE INDEX "payments_party_id_idx" ON "payments"("party_id");

-- CreateIndex
CREATE INDEX "payments_project_id_idx" ON "payments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_number_key" ON "payments"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_idempotency_key_key" ON "payments"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_supplier_bill_id_idx" ON "payment_allocations"("supplier_bill_id");

-- CreateIndex
CREATE INDEX "payment_allocations_client_invoice_id_idx" ON "payment_allocations"("client_invoice_id");

-- CreateIndex
CREATE INDEX "adjustment_notes_party_id_idx" ON "adjustment_notes"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "adjustment_notes_organization_id_number_key" ON "adjustment_notes"("organization_id", "number");

-- CreateIndex
CREATE INDEX "client_pos_organization_id_status_idx" ON "client_pos"("organization_id", "status");

-- CreateIndex
CREATE INDEX "client_pos_project_id_idx" ON "client_pos"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_pos_organization_id_number_key" ON "client_pos"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "client_po_lines_client_po_id_line_no_key" ON "client_po_lines"("client_po_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "client_po_revisions_client_po_id_revision_key" ON "client_po_revisions"("client_po_id", "revision");

-- CreateIndex
CREATE INDEX "sales_orders_organization_id_status_idx" ON "sales_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "sales_orders_project_id_idx" ON "sales_orders"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_organization_id_number_key" ON "sales_orders"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "so_lines_so_id_line_no_key" ON "so_lines"("so_id", "line_no");

-- CreateIndex
CREATE INDEX "ra_bills_organization_id_status_idx" ON "ra_bills"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ra_bills_project_id_idx" ON "ra_bills"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ra_bills_organization_id_number_key" ON "ra_bills"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ra_bills_client_po_id_ra_number_key" ON "ra_bills"("client_po_id", "ra_number");

-- CreateIndex
CREATE UNIQUE INDEX "ra_bill_lines_ra_bill_id_client_po_line_id_key" ON "ra_bill_lines"("ra_bill_id", "client_po_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_invoices_ra_bill_id_key" ON "client_invoices"("ra_bill_id");

-- CreateIndex
CREATE INDEX "client_invoices_organization_id_status_idx" ON "client_invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "client_invoices_project_id_idx" ON "client_invoices"("project_id");

-- CreateIndex
CREATE INDEX "client_invoices_party_id_idx" ON "client_invoices"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_invoices_organization_id_number_key" ON "client_invoices"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_line_no_key" ON "invoice_lines"("invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_organization_id_number_key" ON "stock_counts"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_lines_count_id_item_brand_id_key" ON "stock_count_lines"("count_id", "item_brand_id");

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_lines" ADD CONSTRAINT "pr_lines_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_lines" ADD CONSTRAINT "pr_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_lines" ADD CONSTRAINT "pr_lines_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "material_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_award_proposed_by_id_fkey" FOREIGN KEY ("award_proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_award_approved_by_id_fkey" FOREIGN KEY ("award_approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_pr_line_id_fkey" FOREIGN KEY ("pr_line_id") REFERENCES "pr_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_suppliers" ADD CONSTRAINT "rfq_suppliers_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_suppliers" ADD CONSTRAINT "rfq_suppliers_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "supplier_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_rfq_line_id_fkey" FOREIGN KEY ("rfq_line_id") REFERENCES "rfq_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_fkey" FOREIGN KEY ("delivery_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_pr_line_id_fkey" FOREIGN KEY ("pr_line_id") REFERENCES "pr_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_quotation_line_id_fkey" FOREIGN KEY ("quotation_line_id") REFERENCES "quotation_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_revisions" ADD CONSTRAINT "po_revisions_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_revisions" ADD CONSTRAINT "po_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challans" ADD CONSTRAINT "challans_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_lines" ADD CONSTRAINT "challan_lines_challan_id_fkey" FOREIGN KEY ("challan_id") REFERENCES "challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_lines" ADD CONSTRAINT "challan_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_lines" ADD CONSTRAINT "challan_lines_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challan_lines" ADD CONSTRAINT "challan_lines_so_line_id_fkey" FOREIGN KEY ("so_line_id") REFERENCES "so_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_challan_id_fkey" FOREIGN KEY ("challan_id") REFERENCES "challans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_challan_line_id_fkey" FOREIGN KEY ("challan_line_id") REFERENCES "challan_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "supplier_bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "supplier_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "supplier_bill_lines_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "supplier_bill_lines_grn_line_id_fkey" FOREIGN KEY ("grn_line_id") REFERENCES "grn_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "supplier_bill_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_supplier_bill_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "supplier_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_client_invoice_id_fkey" FOREIGN KEY ("client_invoice_id") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocated_by_id_fkey" FOREIGN KEY ("allocated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_supplier_bill_id_fkey" FOREIGN KEY ("supplier_bill_id") REFERENCES "supplier_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_client_invoice_id_fkey" FOREIGN KEY ("client_invoice_id") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pos" ADD CONSTRAINT "client_pos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pos" ADD CONSTRAINT "client_pos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pos" ADD CONSTRAINT "client_pos_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pos" ADD CONSTRAINT "client_pos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pos" ADD CONSTRAINT "client_pos_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_pos" ADD CONSTRAINT "client_pos_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_po_lines" ADD CONSTRAINT "client_po_lines_client_po_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_pos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_po_lines" ADD CONSTRAINT "client_po_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_po_revisions" ADD CONSTRAINT "client_po_revisions_client_po_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_pos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_po_revisions" ADD CONSTRAINT "client_po_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_po_milestones" ADD CONSTRAINT "client_po_milestones_client_po_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_pos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_client_po_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_lines" ADD CONSTRAINT "so_lines_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_lines" ADD CONSTRAINT "so_lines_client_po_line_id_fkey" FOREIGN KEY ("client_po_line_id") REFERENCES "client_po_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_lines" ADD CONSTRAINT "so_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_client_po_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_engineer_certified_by_id_fkey" FOREIGN KEY ("engineer_certified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bills" ADD CONSTRAINT "ra_bills_certified_by_id_fkey" FOREIGN KEY ("certified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bill_lines" ADD CONSTRAINT "ra_bill_lines_ra_bill_id_fkey" FOREIGN KEY ("ra_bill_id") REFERENCES "ra_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_bill_lines" ADD CONSTRAINT "ra_bill_lines_client_po_line_id_fkey" FOREIGN KEY ("client_po_line_id") REFERENCES "client_po_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_client_po_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_ra_bill_id_fkey" FOREIGN KEY ("ra_bill_id") REFERENCES "ra_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "client_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_so_line_id_fkey" FOREIGN KEY ("so_line_id") REFERENCES "so_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_client_po_line_id_fkey" FOREIGN KEY ("client_po_line_id") REFERENCES "client_po_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_brand_id_fkey" FOREIGN KEY ("item_brand_id") REFERENCES "item_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────── Database-level guards (defence in depth; services enforce the same rules) ─────────────
ALTER TABLE "material_requirements" ADD CONSTRAINT "mr_required_qty_positive" CHECK ("required_qty" > 0);
ALTER TABLE "pr_lines" ADD CONSTRAINT "pr_lines_qty" CHECK ("quantity" > 0 AND "ordered_qty" >= 0);
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_qty" CHECK ("quantity" > 0);
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_values" CHECK ("quantity" > 0 AND "rate" >= 0 AND "awarded_qty" >= 0 AND "awarded_qty" <= "quantity");
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_values" CHECK ("quantity" > 0 AND "rate" >= 0 AND "received_qty" >= 0 AND "accepted_qty" >= 0 AND "rejected_qty" >= 0 AND "returned_qty" >= 0 AND "billed_qty" >= 0 AND "accepted_qty" + "rejected_qty" <= "received_qty");
ALTER TABLE "challan_lines" ADD CONSTRAINT "challan_lines_values" CHECK ("quantity" > 0 AND "received_qty" >= 0 AND "damaged_qty" >= 0 AND "written_off_qty" >= 0 AND "received_qty" + "written_off_qty" <= "quantity");
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_values" CHECK ("received_qty" >= 0 AND "accepted_qty" >= 0 AND "damaged_qty" >= 0 AND "rejected_qty" >= 0 AND "accepted_qty" + "damaged_qty" + "rejected_qty" = "received_qty" AND "billed_qty" >= 0 AND "billed_qty" <= "accepted_qty");
ALTER TABLE "supplier_bill_lines" ADD CONSTRAINT "sb_lines_values" CHECK ("quantity" > 0 AND "rate" >= 0);
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_settlement" CHECK ("paid_amount" >= 0 AND "adjusted_amount" >= 0 AND "paid_amount" + "adjusted_amount" <= "net_payable");
-- A supplier invoice number can be booked once per supplier (cancelled bills excluded).
CREATE UNIQUE INDEX "supplier_bills_unique_invoice" ON "supplier_bills" ("organization_id", "party_id", "invoice_key") WHERE "status" <> 'CANCELLED';
ALTER TABLE "payments" ADD CONSTRAINT "payments_amounts" CHECK ("amount" >= 0 AND "tds_amount" >= 0 AND "amount" + "tds_amount" > 0 AND "allocated_amount" >= 0 AND "allocated_amount" <= "amount" + "tds_amount");
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_target" CHECK ("amount" > 0 AND (("supplier_bill_id" IS NOT NULL)::int + ("client_invoice_id" IS NOT NULL)::int) = 1);
ALTER TABLE "adjustment_notes" ADD CONSTRAINT "adjustment_notes_target" CHECK ("total" > 0 AND (("party_role" = 'SUPPLIER' AND "client_invoice_id" IS NULL) OR ("party_role" = 'CLIENT' AND "supplier_bill_id" IS NULL)));
ALTER TABLE "client_po_lines" ADD CONSTRAINT "client_po_lines_values" CHECK ("quantity" > 0 AND "rate" >= 0);
ALTER TABLE "so_lines" ADD CONSTRAINT "so_lines_values" CHECK ("quantity" > 0 AND "rate" >= 0 AND "delivered_qty" >= 0 AND "returned_qty" >= 0 AND "invoiced_qty" >= 0 AND "returned_qty" <= "delivered_qty");
ALTER TABLE "ra_bill_lines" ADD CONSTRAINT "ra_bill_lines_values" CHECK ("claimed_qty" >= 0 AND ("certified_qty" IS NULL OR "certified_qty" >= 0));
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_settlement" CHECK ("received_amount" >= 0 AND "adjusted_amount" >= 0 AND "received_amount" + "adjusted_amount" <= "net_receivable");
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_values" CHECK ("system_qty" >= 0 AND "counted_qty" >= 0);
