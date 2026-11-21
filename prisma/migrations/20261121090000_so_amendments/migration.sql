-- CreateEnum
CREATE TYPE "SoAmendmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "material_requirements" ADD COLUMN     "sales_order_line_id" UUID;

-- CreateTable
CREATE TABLE "so_amendment_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "so_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "request_no" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "proposed" JSONB NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "status" "SoAmendmentStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "applied_revision" INTEGER,

    CONSTRAINT "so_amendment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "so_amendment_requests_organization_id_status_idx" ON "so_amendment_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "so_amendment_requests_project_id_idx" ON "so_amendment_requests"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "so_amendment_requests_so_id_request_no_key" ON "so_amendment_requests"("so_id", "request_no");

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "so_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_amendment_requests" ADD CONSTRAINT "so_amendment_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_amendment_requests" ADD CONSTRAINT "so_amendment_requests_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_amendment_requests" ADD CONSTRAINT "so_amendment_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_amendment_requests" ADD CONSTRAINT "so_amendment_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_amendment_requests" ADD CONSTRAINT "so_amendment_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- At most one pending amendment request per sales order.
CREATE UNIQUE INDEX "so_amendment_requests_one_pending" ON "so_amendment_requests"("so_id") WHERE "status" = 'PENDING';

ALTER TABLE "so_amendment_requests" ADD CONSTRAINT "so_amendment_requests_request_no_positive" CHECK ("request_no" > 0);
