import { describe, expect, it } from 'vitest';
import { createFulfillmentJobsForOrder, evaluateIntegrationHealth } from './index.js';

describe('createFulfillmentJobsForOrder', () => {
  it('creates a pending fulfillment job', () => {
    const jobs = createFulfillmentJobsForOrder({
      externalId: 'ord_123',
      sourcePlatform: 'shopify',
      status: 'PAID',
      totalAmount: 25,
      currency: 'USD',
      rawPayload: {},
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.state).toBe('PENDING');
  });
});

describe('evaluateIntegrationHealth', () => {
  it('marks a fresh connected integration as healthy', () => {
    const result = evaluateIntegrationHealth({
      id: 'int_123',
      platform: 'shopify',
      name: 'Primary Shopify',
      status: 'CONNECTED',
      metadata: {},
      lastHeartbeatAt: new Date().toISOString(),
    });

    expect(result.healthy).toBe(true);
    expect(result.recommendedStatus).toBe('CONNECTED');
  });

  it('degrades stale integrations', () => {
    const result = evaluateIntegrationHealth({
      id: 'int_123',
      platform: 'woocommerce',
      name: 'Primary Woo',
      status: 'CONNECTED',
      metadata: {},
      lastHeartbeatAt: '2020-01-01T00:00:00.000Z',
    });

    expect(result.healthy).toBe(false);
    expect(result.recommendedStatus).toBe('DEGRADED');
  });
});
