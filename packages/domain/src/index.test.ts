import { describe, expect, it } from 'vitest';
import { registerPaidOrderCommandSchema } from './index.js';

describe('registerPaidOrderCommandSchema', () => {
  it('accepts a paid order command', () => {
    const result = registerPaidOrderCommandSchema.parse({
      order: {
        externalId: 'ord_123',
        sourcePlatform: 'shopify',
        status: 'PAID',
        totalAmount: 125.5,
        currency: 'USD',
        rawPayload: {},
      },
    });

    expect(result.order.status).toBe('PAID');
  });

  it('rejects non-paid orders', () => {
    expect(() =>
      registerPaidOrderCommandSchema.parse({
        order: {
          externalId: 'ord_123',
          sourcePlatform: 'shopify',
          status: 'PENDING',
          totalAmount: 125.5,
          currency: 'USD',
          rawPayload: {},
        },
      }),
    ).toThrow();
  });
});
