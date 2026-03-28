-- CreateEnum
CREATE TYPE "ProfitabilityAlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "ProfitabilityAlertStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ProfitabilityAlertEntityType" AS ENUM ('PRODUCT', 'ORDER');

-- CreateTable
CREATE TABLE "ProfitabilityAlert" (
    "id" TEXT NOT NULL,
    "entityType" "ProfitabilityAlertEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "severity" "ProfitabilityAlertSeverity" NOT NULL,
    "status" "ProfitabilityAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitabilityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfitabilityAlert_entityType_entityId_ruleCode_key" ON "ProfitabilityAlert"("entityType", "entityId", "ruleCode");

-- CreateIndex
CREATE INDEX "ProfitabilityAlert_status_severity_entityType_idx" ON "ProfitabilityAlert"("status", "severity", "entityType");
