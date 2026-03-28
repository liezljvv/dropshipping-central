-- AlterTable
ALTER TABLE "Order"
ADD COLUMN     "subtotalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalProductCost" DECIMAL(12,2),
ADD COLUMN     "fulfillmentCost" DECIMAL(12,2),
ADD COLUMN     "transactionFee" DECIMAL(12,2),
ADD COLUMN     "totalCost" DECIMAL(12,2);

UPDATE "Order"
SET
  "subtotalRevenue" = "totalAmount",
  "shippingRevenue" = 0,
  "totalRevenue" = "totalAmount";

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "supplierIntegrationId" TEXT,
    "externalId" TEXT,
    "sourcePlatform" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "externalId" TEXT,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitSalePrice" DECIMAL(12,2) NOT NULL,
    "unitCostPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_sourcePlatform_externalId_idx" ON "Product"("sourcePlatform", "externalId");

-- CreateIndex
CREATE INDEX "Product_supplierIntegrationId_updatedAt_idx" ON "Product"("supplierIntegrationId", "updatedAt");

-- CreateIndex
CREATE INDEX "OrderLineItem_orderId_sku_idx" ON "OrderLineItem"("orderId", "sku");

-- CreateIndex
CREATE INDEX "OrderLineItem_productId_idx" ON "OrderLineItem"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierIntegrationId_fkey" FOREIGN KEY ("supplierIntegrationId") REFERENCES "SupplierIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
