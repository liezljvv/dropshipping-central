import { fulfillmentJobStates, orderStatuses } from '@dropshipping-central/config';
import { z } from 'zod';
import { calculateMarginPercent, calculateProfit, roundMoney } from './financials.js';

export const orderStatusEnum = z.enum(orderStatuses);
export const fulfillmentJobStateEnum = z.enum(fulfillmentJobStates);
const nonNegativeMoneySchema = z.number().nonnegative();

export const orderLineItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  sku: z.string().min(1),
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitSalePrice: nonNegativeMoneySchema,
  unitCostPrice: nonNegativeMoneySchema.nullable().optional(),
  currency: z.string().length(3),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const orderSchema = z.object({
  id: z.string().optional(),
  externalId: z.string().min(1),
  integrationId: z.string().nullable().optional(),
  sourcePlatform: z.string().min(1),
  status: orderStatusEnum,
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3),
  shippingRevenue: nonNegativeMoneySchema.default(0),
  fulfillmentCost: nonNegativeMoneySchema.nullable().optional(),
  transactionFee: nonNegativeMoneySchema.nullable().optional(),
  lineItems: z.array(orderLineItemSchema).default([]),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export const registerPaidOrderCommandSchema = z.object({
  order: orderSchema.extend({
    status: z.literal('PAID'),
  }),
});

export const fulfillmentJobSchema = z.object({
  id: z.string().optional(),
  orderId: z.string().min(1),
  integrationId: z.string().nullable().optional(),
  supplierIntegrationId: z.string().nullable().optional(),
  supplierReference: z.string().nullable().optional(),
  supplierOrderId: z.string().nullable().optional(),
  state: fulfillmentJobStateEnum,
  attemptCount: z.number().int().nonnegative(),
  retryable: z.boolean().optional(),
  errorMessage: z.string().nullable().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export function calculateOrderSubtotalRevenue(lineItems: Array<{
  quantity: number;
  unitSalePrice: number;
}>) {
  return roundMoney(
    lineItems.reduce((total, line) => total + line.quantity * roundMoney(line.unitSalePrice), 0),
  );
}

export function calculateOrderTotalProductCost(lineItems: Array<{
  quantity: number;
  unitCostPrice?: number | null;
}>) {
  if (lineItems.some((line) => line.unitCostPrice == null)) {
    return null;
  }

  return roundMoney(
    lineItems.reduce(
      (total, line) => total + line.quantity * roundMoney(line.unitCostPrice ?? 0),
      0,
    ),
  );
}

export function calculateOrderTotalCost(input: {
  lineItems: Array<{ quantity: number; unitCostPrice?: number | null }>;
  fulfillmentCost?: number | null;
  transactionFee?: number | null;
}) {
  const totalProductCost = calculateOrderTotalProductCost(input.lineItems);

  if (totalProductCost == null) {
    return null;
  }

  return roundMoney(
    totalProductCost + roundMoney(input.fulfillmentCost ?? 0) + roundMoney(input.transactionFee ?? 0),
  );
}

export function calculateOrderGrossProfit(input: {
  status: z.infer<typeof orderStatusEnum>;
  totalRevenue: number;
  totalCost?: number | null;
}) {
  if (input.totalCost == null) {
    return null;
  }

  const recognizedRevenue =
    input.status === 'CANCELLED' || input.status === 'RETURNED' ? 0 : roundMoney(input.totalRevenue);

  return calculateProfit({
    revenue: recognizedRevenue,
    cost: roundMoney(input.totalCost),
  });
}

export function calculateOrderMarginPercent(input: {
  status: z.infer<typeof orderStatusEnum>;
  totalRevenue: number;
  grossProfit?: number | null;
}) {
  if (input.grossProfit == null) {
    return null;
  }

  const recognizedRevenue =
    input.status === 'CANCELLED' || input.status === 'RETURNED' ? 0 : roundMoney(input.totalRevenue);

  return calculateMarginPercent({
    revenue: recognizedRevenue,
    profit: input.grossProfit,
  });
}

export function calculateOrderFinancials(input: {
  status: z.infer<typeof orderStatusEnum>;
  lineItems: Array<{
    quantity: number;
    unitSalePrice: number;
    unitCostPrice?: number | null;
  }>;
  shippingRevenue?: number;
  fulfillmentCost?: number | null;
  transactionFee?: number | null;
}) {
  const subtotalRevenue = calculateOrderSubtotalRevenue(input.lineItems);
  const shippingRevenue = roundMoney(input.shippingRevenue ?? 0);
  const totalRevenue = roundMoney(subtotalRevenue + shippingRevenue);
  const totalProductCost = calculateOrderTotalProductCost(input.lineItems);
  const totalCost = calculateOrderTotalCost({
    lineItems: input.lineItems,
    ...(input.fulfillmentCost !== undefined ? { fulfillmentCost: input.fulfillmentCost } : {}),
    ...(input.transactionFee !== undefined ? { transactionFee: input.transactionFee } : {}),
  });
  const grossProfit = calculateOrderGrossProfit({
    status: input.status,
    totalRevenue,
    totalCost,
  });
  const marginPercent = calculateOrderMarginPercent({
    status: input.status,
    totalRevenue,
    grossProfit,
  });

  return {
    subtotalRevenue,
    shippingRevenue,
    totalRevenue,
    totalProductCost,
    fulfillmentCost: roundMoney(input.fulfillmentCost ?? 0),
    transactionFee: roundMoney(input.transactionFee ?? 0),
    totalCost,
    grossProfit,
    marginPercent,
  };
}

export type Order = z.infer<typeof orderSchema>;
export type RegisterPaidOrderCommand = z.infer<typeof registerPaidOrderCommandSchema>;
export type FulfillmentJob = z.infer<typeof fulfillmentJobSchema>;
export type OrderLineItem = z.infer<typeof orderLineItemSchema>;
