-- CreateTable
CREATE TABLE "SupplierIntegration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "configPayload" JSONB NOT NULL,
    "capabilities" JSONB NOT NULL,
    "lastCatalogSyncAt" TIMESTAMP(3),
    "lastInventorySyncAt" TIMESTAMP(3),
    "lastPricingSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierIntegration_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FulfillmentJob"
ADD COLUMN     "supplierIntegrationId" TEXT,
ADD COLUMN     "supplierOrderId" TEXT,
ADD COLUMN     "retryable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SupplierSyncRun" (
    "id" TEXT NOT NULL,
    "supplierIntegrationId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "state" "WorkflowRunState" NOT NULL DEFAULT 'QUEUED',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierIntegration_provider_status_idx" ON "SupplierIntegration"("provider", "status");

-- CreateIndex
CREATE INDEX "FulfillmentJob_state_supplierIntegrationId_idx" ON "FulfillmentJob"("state", "supplierIntegrationId");

-- CreateIndex
CREATE INDEX "SupplierSyncRun_supplierIntegrationId_syncType_state_idx" ON "SupplierSyncRun"("supplierIntegrationId", "syncType", "state");

-- AddForeignKey
ALTER TABLE "FulfillmentJob" ADD CONSTRAINT "FulfillmentJob_supplierIntegrationId_fkey" FOREIGN KEY ("supplierIntegrationId") REFERENCES "SupplierIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSyncRun" ADD CONSTRAINT "SupplierSyncRun_supplierIntegrationId_fkey" FOREIGN KEY ("supplierIntegrationId") REFERENCES "SupplierIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
