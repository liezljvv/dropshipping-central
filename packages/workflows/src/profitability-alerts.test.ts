import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoredAlert = {
  id: string;
  entityType: 'PRODUCT' | 'ORDER';
  entityId: string;
  ruleCode: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'ACTIVE' | 'RESOLVED';
  message: string;
  metrics: Record<string, unknown>;
  firstDetectedAt: Date;
  lastEvaluatedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const state = {
  alerts: [] as StoredAlert[],
  auditEvents: [] as Array<Record<string, unknown>>,
};

vi.mock('@dropshipping-central/db', () => {
  const db = {
    profitabilityAlert: {
      async findMany(input?: {
        where?: Partial<Pick<StoredAlert, 'entityType' | 'entityId' | 'severity' | 'status'>>;
      }) {
        return state.alerts.filter((alert) => {
          const where = input?.where ?? {};
          return Object.entries(where).every(([key, value]) => alert[key as keyof StoredAlert] === value);
        });
      },
      async upsert(input: {
        where: {
          entityType_entityId_ruleCode: {
            entityType: StoredAlert['entityType'];
            entityId: string;
            ruleCode: string;
          };
        };
        update: Partial<StoredAlert>;
        create: Omit<StoredAlert, 'id' | 'createdAt' | 'updatedAt'>;
      }) {
        const key = input.where.entityType_entityId_ruleCode;
        const existing = state.alerts.find(
          (alert) =>
            alert.entityType === key.entityType &&
            alert.entityId === key.entityId &&
            alert.ruleCode === key.ruleCode,
        );

        if (existing) {
          Object.assign(existing, input.update, {
            updatedAt: new Date(),
          });
          return existing;
        }

        const created: StoredAlert = {
          id: `alert_${state.alerts.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...input.create,
        };
        state.alerts.push(created);
        return created;
      },
      async update(input: {
        where: { id: string };
        data: Partial<StoredAlert>;
      }) {
        const alert = state.alerts.find((item) => item.id === input.where.id);
        if (!alert) {
          throw new Error(`Missing alert ${input.where.id}`);
        }

        Object.assign(alert, input.data, {
          updatedAt: new Date(),
        });
        return alert;
      },
    },
    auditEvent: {
      async create(input: { data: Record<string, unknown> }) {
        state.auditEvents.push(input.data);
        return input.data;
      },
    },
  };

  return {
    Prisma: {},
    db,
  };
});

describe('profitability alert service', () => {
  beforeEach(() => {
    state.alerts = [];
    state.auditEvents = [];
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.PROFITABILITY_PRODUCT_MIN_MARGIN_PERCENT = '30';
    process.env.PROFITABILITY_PRODUCT_MIN_PROFIT = '12';
    process.env.PROFITABILITY_ORDER_MIN_MARGIN_PERCENT = '25';
  });

  it('uses configured threshold behavior for product alerts', async () => {
    const { evaluateAndPersistProductProfitabilityAlerts } = await import('./profitability-alerts.js');

    const alerts = await evaluateAndPersistProductProfitabilityAlerts({
      product: {
        id: 'prod_1',
        sku: 'SKU-1',
        title: 'Config Sensitive Product',
        salePrice: 30,
        costPrice: 22,
        currency: 'USD',
        metadata: {},
      },
    });

    expect(alerts.map((alert) => alert.ruleCode)).toEqual([
      'PRODUCT_LOW_EXPECTED_MARGIN',
      'PRODUCT_LOW_EXPECTED_PROFIT',
    ]);
  });

  it('persists and resolves alerts without duplicate noise', async () => {
    const { evaluateAndPersistProductProfitabilityAlerts } = await import('./profitability-alerts.js');

    await evaluateAndPersistProductProfitabilityAlerts({
      product: {
        id: 'prod_2',
        sku: 'SKU-2',
        title: 'Noisy Product',
        salePrice: 20,
        costPrice: 15,
        currency: 'USD',
        metadata: {},
      },
      thresholds: {
        productMinMarginPercent: 30,
        productMinProfit: 3,
        orderMinMarginPercent: 15,
      },
    });

    await evaluateAndPersistProductProfitabilityAlerts({
      product: {
        id: 'prod_2',
        sku: 'SKU-2',
        title: 'Noisy Product',
        salePrice: 20,
        costPrice: 15,
        currency: 'USD',
        metadata: {},
      },
      thresholds: {
        productMinMarginPercent: 30,
        productMinProfit: 3,
        orderMinMarginPercent: 15,
      },
    });

    expect(state.alerts).toHaveLength(1);
    expect(state.auditEvents).toHaveLength(1);

    await evaluateAndPersistProductProfitabilityAlerts({
      product: {
        id: 'prod_2',
        sku: 'SKU-2',
        title: 'Recovered Product',
        salePrice: 40,
        costPrice: 15,
        currency: 'USD',
        metadata: {},
      },
      thresholds: {
        productMinMarginPercent: 30,
        productMinProfit: 3,
        orderMinMarginPercent: 15,
      },
    });

    expect(state.alerts[0]?.status).toBe('RESOLVED');
    expect(state.auditEvents).toHaveLength(2);
  });

  it('persists critical order alerts and lists active alerts', async () => {
    const {
      evaluateAndPersistOrderProfitabilityAlerts,
      listProfitabilityAlerts,
    } = await import('./profitability-alerts.js');

    await evaluateAndPersistOrderProfitabilityAlerts({
      order: {
        id: 'ord_critical',
        externalId: 'ord_critical',
        sourcePlatform: 'shopify',
        status: 'PAID',
        totalAmount: 20,
        currency: 'USD',
        shippingRevenue: 0,
        fulfillmentCost: 0,
        transactionFee: 0,
        lineItems: [
          {
            sku: 'SKU-L',
            title: 'Loss',
            quantity: 1,
            unitSalePrice: 20,
            unitCostPrice: 35,
            currency: 'USD',
            metadata: {},
          },
        ],
        rawPayload: {},
      },
      thresholds: {
        productMinMarginPercent: 20,
        productMinProfit: 10,
        orderMinMarginPercent: 25,
      },
    });

    const items = await listProfitabilityAlerts({
      entityType: 'ORDER',
      severity: 'critical',
      status: 'ACTIVE',
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.ruleCode).toBe('ORDER_NEGATIVE_GROSS_PROFIT');
    expect(state.auditEvents.some((event) => event.eventType === 'profitability.alert.critical')).toBe(true);
  });
});
