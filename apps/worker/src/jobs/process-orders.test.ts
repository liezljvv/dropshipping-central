import { describe, expect, it } from 'vitest';
import { decideSupplierAttemptResult } from '@dropshipping-central/integrations';
import { buildSupplierOrderSubmission } from './supplier-order-utils.js';

describe('buildSupplierOrderSubmission', () => {
  it('builds a demo-safe fallback submission from minimal order payloads', () => {
    const submission = buildSupplierOrderSubmission({
      orderId: 'ord_demo',
      supplierIntegrationId: 'sup_mock',
      rawPayload: null,
      totalAmount: 15,
      currency: 'USD',
    });

    expect(submission.lines).toHaveLength(1);
    expect(submission.shippingAddress.fullName).toBe('Demo Customer');
    expect(submission.supplierIntegrationId).toBe('sup_mock');
  });
});

describe('supplier retry decisions', () => {
  it('marks accepted submissions as succeeded', () => {
    const decision = decideSupplierAttemptResult({
      result: {
        supplierOrderId: 'sup_1',
        accepted: true,
        status: 'SUBMITTED',
        retryable: false,
        message: null,
        rawResponse: {},
        processedAt: '2026-03-28T00:00:00.000Z',
      },
      attemptCount: 1,
    });

    expect(decision.nextState).toBe('SUCCEEDED');
  });
});
