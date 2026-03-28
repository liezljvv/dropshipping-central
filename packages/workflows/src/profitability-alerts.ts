import {
  defineProfitabilityThresholdConfig,
  type ProfitabilityThresholdConfig,
} from '@dropshipping-central/config';
import { db, type Prisma, type ProfitabilityAlert as PrismaProfitabilityAlert } from '@dropshipping-central/db';
import {
  evaluateOrderProfitabilityRules,
  evaluateProductProfitabilityRules,
  type Order,
  type Product,
  type ProfitabilityAlert,
  profitabilityAlertSchema,
  type ProfitabilityAlertDraft,
} from '@dropshipping-central/domain';

type DbClient = Prisma.TransactionClient | typeof db;

function getDbClient(tx?: Prisma.TransactionClient) {
  return tx ?? db;
}

function serializeAlert(alert: PrismaProfitabilityAlert): ProfitabilityAlert {
  return profitabilityAlertSchema.parse({
    ...alert,
    status: alert.status,
    severity: alert.severity,
    entityType: alert.entityType,
    ruleCode: alert.ruleCode,
    metrics:
      alert.metrics && typeof alert.metrics === 'object' && !Array.isArray(alert.metrics)
        ? (alert.metrics as Record<string, unknown>)
        : {},
    firstDetectedAt: alert.firstDetectedAt.toISOString(),
    lastEvaluatedAt: alert.lastEvaluatedAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  });
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function shouldEmitActivationAudit(existing: PrismaProfitabilityAlert | null, draft: ProfitabilityAlertDraft) {
  return (
    existing == null ||
    existing.status !== 'ACTIVE' ||
    existing.severity !== draft.severity ||
    existing.message !== draft.message
  );
}

async function persistProfitabilityAlerts(input: {
  tx?: Prisma.TransactionClient;
  entityType: ProfitabilityAlertDraft['entityType'];
  entityId: string;
  alerts: ProfitabilityAlertDraft[];
  actorType?: 'SYSTEM' | 'USER' | 'WORKER';
}) {
  const client = getDbClient(input.tx);
  const now = new Date();
  const existingAlerts: PrismaProfitabilityAlert[] = await client.profitabilityAlert.findMany({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  const existingByRule = new Map(existingAlerts.map((alert) => [alert.ruleCode, alert]));
  const activeRuleCodes = new Set(input.alerts.map((alert) => alert.ruleCode));

  const persisted = await Promise.all(
    input.alerts.map(async (alert) => {
      const existing = existingByRule.get(alert.ruleCode) ?? null;
      const persistedAlert = await client.profitabilityAlert.upsert({
        where: {
          entityType_entityId_ruleCode: {
            entityType: alert.entityType,
            entityId: alert.entityId,
            ruleCode: alert.ruleCode,
          },
        },
        update: {
          ruleName: alert.ruleName,
          severity: alert.severity,
          status: 'ACTIVE',
          message: alert.message,
          metrics: toInputJsonValue(alert.metrics),
          lastEvaluatedAt: now,
          resolvedAt: null,
        },
        create: {
          entityType: alert.entityType,
          entityId: alert.entityId,
          ruleCode: alert.ruleCode,
          ruleName: alert.ruleName,
          severity: alert.severity,
          status: 'ACTIVE',
          message: alert.message,
          metrics: toInputJsonValue(alert.metrics),
          firstDetectedAt: now,
          lastEvaluatedAt: now,
          resolvedAt: null,
        },
      });

      if (shouldEmitActivationAudit(existing, alert)) {
        await client.auditEvent.create({
          data: {
            actorType: input.actorType ?? 'SYSTEM',
            eventType:
              alert.severity === 'critical'
                ? 'profitability.alert.critical'
                : 'profitability.alert.activated',
            entityType: input.entityType,
            entityId: input.entityId,
            payload: {
              ruleCode: alert.ruleCode,
              ruleName: alert.ruleName,
              severity: alert.severity,
              message: alert.message,
              metrics: toInputJsonValue(alert.metrics),
            },
          },
        });
      }

      return persistedAlert;
    }),
  );

  const resolvedAlerts = existingAlerts.filter(
    (alert: PrismaProfitabilityAlert) =>
      alert.status === 'ACTIVE' &&
      !activeRuleCodes.has(alert.ruleCode as ProfitabilityAlertDraft['ruleCode']),
  );

  await Promise.all(
    resolvedAlerts.map(async (alert) => {
      await client.profitabilityAlert.update({
        where: { id: alert.id },
        data: {
          status: 'RESOLVED',
          lastEvaluatedAt: now,
          resolvedAt: now,
        },
      });

      await client.auditEvent.create({
        data: {
          actorType: input.actorType ?? 'SYSTEM',
          eventType: 'profitability.alert.resolved',
          entityType: input.entityType,
          entityId: input.entityId,
          payload: {
            ruleCode: alert.ruleCode,
            ruleName: alert.ruleName,
            severity: alert.severity,
          },
        },
      });
    }),
  );

  return persisted.map(serializeAlert);
}

function getThresholds(overrides?: Partial<ProfitabilityThresholdConfig>) {
  const base = defineProfitabilityThresholdConfig(process.env);

  return {
    ...base,
    ...overrides,
  } satisfies ProfitabilityThresholdConfig;
}

export async function evaluateAndPersistProductProfitabilityAlerts(input: {
  product: Product;
  tx?: Prisma.TransactionClient;
  thresholds?: Partial<ProfitabilityThresholdConfig>;
  actorType?: 'SYSTEM' | 'USER' | 'WORKER';
}) {
  const thresholds = getThresholds(input.thresholds);
  const alerts = evaluateProductProfitabilityRules({
    product: input.product,
    thresholds,
  });

  return persistProfitabilityAlerts({
    ...(input.tx ? { tx: input.tx } : {}),
    entityType: 'PRODUCT',
    entityId: input.product.id ?? input.product.sku,
    alerts,
    ...(input.actorType ? { actorType: input.actorType } : {}),
  });
}

export async function evaluateAndPersistOrderProfitabilityAlerts(input: {
  order: Order;
  tx?: Prisma.TransactionClient;
  thresholds?: Partial<ProfitabilityThresholdConfig>;
  actorType?: 'SYSTEM' | 'USER' | 'WORKER';
}) {
  const thresholds = getThresholds(input.thresholds);
  const alerts = evaluateOrderProfitabilityRules({
    order: input.order,
    thresholds,
  });

  return persistProfitabilityAlerts({
    ...(input.tx ? { tx: input.tx } : {}),
    entityType: 'ORDER',
    entityId: input.order.id ?? input.order.externalId,
    alerts,
    ...(input.actorType ? { actorType: input.actorType } : {}),
  });
}

export async function listProfitabilityAlerts(input?: {
  entityType?: ProfitabilityAlert['entityType'];
  severity?: ProfitabilityAlert['severity'];
  status?: ProfitabilityAlert['status'];
}) {
  const alerts = await db.profitabilityAlert.findMany({
    where: {
      ...(input?.entityType ? { entityType: input.entityType } : {}),
      ...(input?.severity ? { severity: input.severity } : {}),
      ...(input?.status ? { status: input.status } : { status: 'ACTIVE' }),
    },
    orderBy: [
      { severity: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 100,
  });

  return alerts.map(serializeAlert);
}
