import { describe, expect, it } from 'vitest';
import {
  createFulfillmentJobsForOrder,
  decideFulfillmentExecution,
  evaluateIntegrationHealth,
} from './index.js';

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

describe('decideFulfillmentExecution', () => {
  it('succeeds on the happy path', () => {
    const result = decideFulfillmentExecution({
      attemptCount: 0,
      rawPayload: {},
    });

    expect(result.nextState).toBe('SUCCEEDED');
    expect(result.shouldRetry).toBe(false);
    expect(result.errorMessage).toBeNull();
    expect(result.attemptCount).toBe(1);
  });

  it('retries once for a transient first-attempt failure', () => {
    const firstAttempt = decideFulfillmentExecution({
      attemptCount: 0,
      rawPayload: { simulateFailure: 'once' },
    });
    const secondAttempt = decideFulfillmentExecution({
      attemptCount: 1,
      rawPayload: { simulateFailure: 'once' },
    });

    expect(firstAttempt.nextState).toBe('PENDING');
    expect(firstAttempt.shouldRetry).toBe(true);
    expect(secondAttempt.nextState).toBe('SUCCEEDED');
    expect(secondAttempt.shouldRetry).toBe(false);
  });

  it('fails after repeated transient errors reach max retries', () => {
    const firstAttempt = decideFulfillmentExecution({
      attemptCount: 0,
      rawPayload: { simulateFailure: 'always' },
    });
    const secondAttempt = decideFulfillmentExecution({
      attemptCount: 1,
      rawPayload: { simulateFailure: 'always' },
    });
    const thirdAttempt = decideFulfillmentExecution({
      attemptCount: 2,
      rawPayload: { simulateFailure: 'always' },
    });

    expect(firstAttempt.nextState).toBe('PENDING');
    expect(secondAttempt.nextState).toBe('PENDING');
    expect(thirdAttempt.nextState).toBe('FAILED');
    expect(thirdAttempt.shouldRetry).toBe(false);
  });

  it('fails immediately on permanent errors', () => {
    const result = decideFulfillmentExecution({
      attemptCount: 0,
      rawPayload: { simulateFailure: 'permanent' },
    });

    expect(result.nextState).toBe('FAILED');
    expect(result.shouldRetry).toBe(false);
    expect(result.errorMessage).toContain('Permanent');
  });
});
