import { describe, expect, it } from 'vitest';
import {
  evaluateOrderProfitabilityRules,
  evaluateProductProfitabilityRules,
  calculateExpectedProductMarginPercent,
  calculateExpectedProductProfit,
  calculateOrderFinancials,
  registerPaidOrderCommandSchema,
} from './index.js';

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

describe('product financials', () => {
  it('calculates expected profit and margin', () => {
    expect(
      calculateExpectedProductProfit({
        salePrice: 25,
        costPrice: 10,
      }),
    ).toBe(15);

    expect(
      calculateExpectedProductMarginPercent({
        salePrice: 25,
        costPrice: 10,
      }),
    ).toBe(60);
  });

  it('returns null when cost is missing', () => {
    expect(
      calculateExpectedProductProfit({
        salePrice: 25,
        costPrice: null,
      }),
    ).toBeNull();

    expect(
      calculateExpectedProductMarginPercent({
        salePrice: 25,
        costPrice: null,
      }),
    ).toBeNull();
  });
});

describe('order financials', () => {
  it('calculates multi-line order totals', () => {
    const result = calculateOrderFinancials({
      status: 'PAID',
      shippingRevenue: 5,
      fulfillmentCost: 3,
      transactionFee: 2.5,
      lineItems: [
        {
          quantity: 2,
          unitSalePrice: 20,
          unitCostPrice: 8,
        },
        {
          quantity: 1,
          unitSalePrice: 15,
          unitCostPrice: 6,
        },
      ],
    });

    expect(result.subtotalRevenue).toBe(55);
    expect(result.totalRevenue).toBe(60);
    expect(result.totalProductCost).toBe(22);
    expect(result.totalCost).toBe(27.5);
    expect(result.grossProfit).toBe(32.5);
    expect(result.marginPercent).toBe(54.17);
  });

  it('handles zero revenue safely', () => {
    const result = calculateOrderFinancials({
      status: 'PAID',
      lineItems: [
        {
          quantity: 1,
          unitSalePrice: 0,
          unitCostPrice: 0,
        },
      ],
    });

    expect(result.grossProfit).toBe(0);
    expect(result.marginPercent).toBe(0);
  });

  it('supports negative profit', () => {
    const result = calculateOrderFinancials({
      status: 'PAID',
      lineItems: [
        {
          quantity: 1,
          unitSalePrice: 10,
          unitCostPrice: 15,
        },
      ],
    });

    expect(result.grossProfit).toBe(-5);
    expect(result.marginPercent).toBe(-50);
  });

  it('returns null profit metrics when cost is missing', () => {
    const result = calculateOrderFinancials({
      status: 'PAID',
      lineItems: [
        {
          quantity: 1,
          unitSalePrice: 10,
          unitCostPrice: null,
        },
      ],
    });

    expect(result.totalProductCost).toBeNull();
    expect(result.totalCost).toBeNull();
    expect(result.grossProfit).toBeNull();
    expect(result.marginPercent).toBeNull();
  });

  it('zeros recognized revenue for cancelled orders without crashing', () => {
    const result = calculateOrderFinancials({
      status: 'CANCELLED',
      transactionFee: 2,
      lineItems: [
        {
          quantity: 1,
          unitSalePrice: 20,
          unitCostPrice: 0,
        },
      ],
    });

    expect(result.totalRevenue).toBe(20);
    expect(result.totalCost).toBe(2);
    expect(result.grossProfit).toBe(-2);
    expect(result.marginPercent).toBe(0);
  });
});

describe('profitability rules', () => {
  const thresholds = {
    productMinMarginPercent: 20,
    productMinProfit: 10,
    orderMinMarginPercent: 15,
  };

  it('flags low-margin products', () => {
    const alerts = evaluateProductProfitabilityRules({
      thresholds,
      product: {
        id: 'prod_1',
        sku: 'SKU-1',
        title: 'Low Margin Product',
        salePrice: 100,
        costPrice: 90,
        currency: 'USD',
        metadata: {},
      },
    });

    expect(alerts.map((alert) => alert.ruleCode)).toContain('PRODUCT_LOW_EXPECTED_MARGIN');
  });

  it('flags low-profit products', () => {
    const alerts = evaluateProductProfitabilityRules({
      thresholds,
      product: {
        id: 'prod_2',
        sku: 'SKU-2',
        title: 'Low Profit Product',
        salePrice: 25,
        costPrice: 18,
        currency: 'USD',
        metadata: {},
      },
    });

    expect(alerts.map((alert) => alert.ruleCode)).toContain('PRODUCT_LOW_EXPECTED_PROFIT');
  });

  it('flags negative gross-profit orders', () => {
    const alerts = evaluateOrderProfitabilityRules({
      thresholds,
      order: {
        id: 'ord_1',
        externalId: 'ord_1',
        sourcePlatform: 'shopify',
        status: 'PAID',
        totalAmount: 10,
        currency: 'USD',
        shippingRevenue: 0,
        fulfillmentCost: 0,
        transactionFee: 0,
        lineItems: [
          {
            sku: 'SKU-1',
            title: 'Loss Line',
            quantity: 1,
            unitSalePrice: 10,
            unitCostPrice: 15,
            currency: 'USD',
            metadata: {},
          },
        ],
        rawPayload: {},
      },
    });

    expect(alerts.map((alert) => alert.ruleCode)).toContain('ORDER_NEGATIVE_GROSS_PROFIT');
  });

  it('flags low-margin orders', () => {
    const alerts = evaluateOrderProfitabilityRules({
      thresholds,
      order: {
        id: 'ord_2',
        externalId: 'ord_2',
        sourcePlatform: 'shopify',
        status: 'PAID',
        totalAmount: 100,
        currency: 'USD',
        shippingRevenue: 0,
        fulfillmentCost: 0,
        transactionFee: 0,
        lineItems: [
          {
            sku: 'SKU-2',
            title: 'Low Margin Line',
            quantity: 1,
            unitSalePrice: 100,
            unitCostPrice: 90,
            currency: 'USD',
            metadata: {},
          },
        ],
        rawPayload: {},
      },
    });

    expect(alerts.map((alert) => alert.ruleCode)).toContain('ORDER_LOW_MARGIN');
  });

  it('flags incomplete order cost data', () => {
    const alerts = evaluateOrderProfitabilityRules({
      thresholds,
      order: {
        id: 'ord_3',
        externalId: 'ord_3',
        sourcePlatform: 'shopify',
        status: 'PAID',
        totalAmount: 100,
        currency: 'USD',
        shippingRevenue: 0,
        fulfillmentCost: 0,
        transactionFee: 0,
        lineItems: [
          {
            sku: 'SKU-3',
            title: 'Incomplete Cost Line',
            quantity: 1,
            unitSalePrice: 100,
            unitCostPrice: null,
            currency: 'USD',
            metadata: {},
          },
        ],
        rawPayload: {},
      },
    });

    expect(alerts.map((alert) => alert.ruleCode)).toContain('ORDER_INCOMPLETE_COST_DATA');
  });
});
