import {
  profitabilityAlertEntityTypes,
  profitabilityAlertSeverities,
  profitabilityAlertStatuses,
  profitabilityRuleCodes,
  type ProfitabilityThresholdConfig,
} from '@dropshipping-central/config';
import { z } from 'zod';
import {
  calculateOrderFinancials,
  type Order,
  type OrderLineItem,
} from './orders.js';
import {
  calculateExpectedProductMarginPercent,
  calculateExpectedProductProfit,
  type Product,
} from './products.js';

export const profitabilityAlertSeverityEnum = z.enum(profitabilityAlertSeverities);
export const profitabilityAlertStatusEnum = z.enum(profitabilityAlertStatuses);
export const profitabilityAlertEntityTypeEnum = z.enum(profitabilityAlertEntityTypes);
export const profitabilityRuleCodeEnum = z.enum(profitabilityRuleCodes);

export const profitabilityAlertSchema = z.object({
  id: z.string().optional(),
  entityType: profitabilityAlertEntityTypeEnum,
  entityId: z.string().min(1),
  ruleCode: profitabilityRuleCodeEnum,
  ruleName: z.string().min(1),
  severity: profitabilityAlertSeverityEnum,
  status: profitabilityAlertStatusEnum,
  message: z.string().min(1),
  metrics: z.record(z.string(), z.unknown()).default({}),
  firstDetectedAt: z.iso.datetime().optional(),
  lastEvaluatedAt: z.iso.datetime().optional(),
  resolvedAt: z.iso.datetime().nullable().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const profitabilityAlertDraftSchema = profitabilityAlertSchema.omit({
  id: true,
  firstDetectedAt: true,
  lastEvaluatedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.literal('ACTIVE'),
});

type ProfitabilityRule<T> = {
  code: z.infer<typeof profitabilityRuleCodeEnum>;
  name: string;
  severity: z.infer<typeof profitabilityAlertSeverityEnum>;
  evaluate: (input: T) => z.infer<typeof profitabilityAlertDraftSchema> | null;
};

type ProductRuleInput = {
  product: Product;
  thresholds: ProfitabilityThresholdConfig;
};

type OrderRuleInput = {
  order: Order;
  thresholds: ProfitabilityThresholdConfig;
  financials: ReturnType<typeof calculateOrderFinancials>;
};

function evaluateRules<T>(rules: ProfitabilityRule<T>[], input: T) {
  return rules
    .map((rule) => rule.evaluate(input))
    .filter((alert): alert is z.infer<typeof profitabilityAlertDraftSchema> => alert != null);
}

function toExpectedProductMetrics(product: Product) {
  return {
    salePrice: product.salePrice,
    ...(product.costPrice !== undefined ? { costPrice: product.costPrice } : {}),
  };
}

const productRules: ProfitabilityRule<ProductRuleInput>[] = [
  {
    code: 'PRODUCT_LOW_EXPECTED_MARGIN',
    name: 'Product expected margin below threshold',
    severity: 'warning',
    evaluate: ({ product, thresholds }) => {
      const expectedMarginPercent = calculateExpectedProductMarginPercent(toExpectedProductMetrics(product));

      if (expectedMarginPercent == null || expectedMarginPercent >= thresholds.productMinMarginPercent) {
        return null;
      }

      return profitabilityAlertDraftSchema.parse({
        entityType: 'PRODUCT',
        entityId: product.id ?? product.sku,
        ruleCode: 'PRODUCT_LOW_EXPECTED_MARGIN',
        ruleName: 'Product expected margin below threshold',
        severity: 'warning',
        status: 'ACTIVE',
        message: `Expected margin ${expectedMarginPercent}% is below the configured floor of ${thresholds.productMinMarginPercent}%.`,
        metrics: {
          salePrice: product.salePrice,
          costPrice: product.costPrice ?? null,
          expectedProfit: calculateExpectedProductProfit(toExpectedProductMetrics(product)),
          expectedMarginPercent,
          threshold: thresholds.productMinMarginPercent,
          currency: product.currency,
        },
      });
    },
  },
  {
    code: 'PRODUCT_LOW_EXPECTED_PROFIT',
    name: 'Product expected profit below threshold',
    severity: 'warning',
    evaluate: ({ product, thresholds }) => {
      const expectedProfit = calculateExpectedProductProfit(toExpectedProductMetrics(product));

      if (expectedProfit == null || expectedProfit >= thresholds.productMinProfit) {
        return null;
      }

      return profitabilityAlertDraftSchema.parse({
        entityType: 'PRODUCT',
        entityId: product.id ?? product.sku,
        ruleCode: 'PRODUCT_LOW_EXPECTED_PROFIT',
        ruleName: 'Product expected profit below threshold',
        severity: 'warning',
        status: 'ACTIVE',
        message: `Expected profit ${expectedProfit} ${product.currency} is below the configured floor of ${thresholds.productMinProfit} ${product.currency}.`,
        metrics: {
          salePrice: product.salePrice,
          costPrice: product.costPrice ?? null,
          expectedProfit,
          expectedMarginPercent: calculateExpectedProductMarginPercent(toExpectedProductMetrics(product)),
          threshold: thresholds.productMinProfit,
          currency: product.currency,
        },
      });
    },
  },
];

const orderRules: ProfitabilityRule<OrderRuleInput>[] = [
  {
    code: 'ORDER_INCOMPLETE_COST_DATA',
    name: 'Order profitability cannot be trusted because cost data is incomplete',
    severity: 'warning',
    evaluate: ({ order, financials }) => {
      if (
        order.status === 'CANCELLED' ||
        order.status === 'RETURNED' ||
        financials.totalProductCost != null
      ) {
        return null;
      }

      return profitabilityAlertDraftSchema.parse({
        entityType: 'ORDER',
        entityId: order.id ?? order.externalId,
        ruleCode: 'ORDER_INCOMPLETE_COST_DATA',
        ruleName: 'Order profitability cannot be trusted because cost data is incomplete',
        severity: 'warning',
        status: 'ACTIVE',
        message: 'One or more order lines are missing cost data, so profitability metrics are incomplete.',
        metrics: {
          totalRevenue: financials.totalRevenue,
          totalProductCost: financials.totalProductCost,
          totalCost: financials.totalCost,
          grossProfit: financials.grossProfit,
          marginPercent: financials.marginPercent,
          lineItems: order.lineItems.map((lineItem) => ({
            sku: lineItem.sku,
            quantity: lineItem.quantity,
            unitCostPrice: lineItem.unitCostPrice ?? null,
          })),
        },
      });
    },
  },
  {
    code: 'ORDER_NEGATIVE_GROSS_PROFIT',
    name: 'Order gross profit is negative',
    severity: 'critical',
    evaluate: ({ order, financials }) => {
      if (
        order.status === 'CANCELLED' ||
        order.status === 'RETURNED' ||
        financials.grossProfit == null ||
        financials.grossProfit >= 0
      ) {
        return null;
      }

      return profitabilityAlertDraftSchema.parse({
        entityType: 'ORDER',
        entityId: order.id ?? order.externalId,
        ruleCode: 'ORDER_NEGATIVE_GROSS_PROFIT',
        ruleName: 'Order gross profit is negative',
        severity: 'critical',
        status: 'ACTIVE',
        message: `Order gross profit is ${financials.grossProfit} ${order.currency}, which indicates a loss-making order.`,
        metrics: {
          totalRevenue: financials.totalRevenue,
          totalCost: financials.totalCost,
          grossProfit: financials.grossProfit,
          marginPercent: financials.marginPercent,
          currency: order.currency,
        },
      });
    },
  },
  {
    code: 'ORDER_LOW_MARGIN',
    name: 'Order margin is below threshold',
    severity: 'warning',
    evaluate: ({ order, thresholds, financials }) => {
      if (
        order.status === 'CANCELLED' ||
        order.status === 'RETURNED' ||
        financials.marginPercent == null ||
        financials.marginPercent >= thresholds.orderMinMarginPercent
      ) {
        return null;
      }

      return profitabilityAlertDraftSchema.parse({
        entityType: 'ORDER',
        entityId: order.id ?? order.externalId,
        ruleCode: 'ORDER_LOW_MARGIN',
        ruleName: 'Order margin is below threshold',
        severity: 'warning',
        status: 'ACTIVE',
        message: `Order margin ${financials.marginPercent}% is below the configured floor of ${thresholds.orderMinMarginPercent}%.`,
        metrics: {
          totalRevenue: financials.totalRevenue,
          totalCost: financials.totalCost,
          grossProfit: financials.grossProfit,
          marginPercent: financials.marginPercent,
          threshold: thresholds.orderMinMarginPercent,
          currency: order.currency,
        },
      });
    },
  },
];

export function evaluateProductProfitabilityRules(input: {
  product: Product;
  thresholds: ProfitabilityThresholdConfig;
}) {
  return evaluateRules(productRules, input);
}

export function evaluateOrderProfitabilityRules(input: {
  order: Order;
  thresholds: ProfitabilityThresholdConfig;
}) {
  const financials = calculateOrderFinancials({
    status: input.order.status,
    lineItems: input.order.lineItems.map((lineItem: OrderLineItem) => ({
      quantity: lineItem.quantity,
      unitSalePrice: lineItem.unitSalePrice,
      ...(lineItem.unitCostPrice !== undefined ? { unitCostPrice: lineItem.unitCostPrice } : {}),
    })),
    shippingRevenue: input.order.shippingRevenue,
    ...(input.order.fulfillmentCost !== undefined
      ? { fulfillmentCost: input.order.fulfillmentCost }
      : {}),
    ...(input.order.transactionFee !== undefined
      ? { transactionFee: input.order.transactionFee }
      : {}),
  });

  return evaluateRules(orderRules, {
    order: input.order,
    thresholds: input.thresholds,
    financials,
  });
}

export type ProfitabilityAlert = z.infer<typeof profitabilityAlertSchema>;
export type ProfitabilityAlertDraft = z.infer<typeof profitabilityAlertDraftSchema>;
