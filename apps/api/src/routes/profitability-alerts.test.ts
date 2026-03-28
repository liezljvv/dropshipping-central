import { afterEach, describe, expect, it, vi } from 'vitest';

const listProfitabilityAlerts = vi.fn();

vi.mock('@dropshipping-central/workflows', () => ({
  createFulfillmentJobsForOrder: vi.fn(() => []),
  evaluateAndPersistOrderProfitabilityAlerts: vi.fn(),
  evaluateAndPersistProductProfitabilityAlerts: vi.fn(),
  evaluateIntegrationHealth: vi.fn(() => ({
    healthy: true,
    recommendedStatus: 'CONNECTED',
    checkedAt: '2026-03-28T00:00:00.000Z',
    summary: 'ok',
  })),
  listProfitabilityAlerts,
  normalizeIntegrationHealthInput: vi.fn((input) => input),
}));

vi.mock('@dropshipping-central/db', () => ({
  db: {
    $disconnect: vi.fn(),
  },
}));

describe('profitability alert routes', () => {
  afterEach(() => {
    listProfitabilityAlerts.mockReset();
  });

  it('lists active alerts with filters', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    listProfitabilityAlerts.mockResolvedValue([
      {
        id: 'alert_1',
        entityType: 'ORDER',
        entityId: 'ord_1',
        ruleCode: 'ORDER_NEGATIVE_GROSS_PROFIT',
        ruleName: 'Order gross profit is negative',
        severity: 'critical',
        status: 'ACTIVE',
        message: 'Loss-making order',
        metrics: {
          grossProfit: -5,
        },
        firstDetectedAt: '2026-03-28T00:00:00.000Z',
        lastEvaluatedAt: '2026-03-28T00:00:00.000Z',
        resolvedAt: null,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
    ]);

    const { defineApiEnv } = await import('@dropshipping-central/config');
    const { createApp } = await import('../app.js');
    const app = createApp(defineApiEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      API_PORT: '3000',
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profitability-alerts?entityType=ORDER&severity=critical',
    });

    expect(response.statusCode).toBe(200);
    expect(listProfitabilityAlerts).toHaveBeenCalledWith({
      entityType: 'ORDER',
      severity: 'critical',
    });

    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.filters.status).toBe('ACTIVE');

    await app.close();
  });
});
