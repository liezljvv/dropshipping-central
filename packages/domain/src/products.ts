import { z } from 'zod';
import { calculateMarginPercent, calculateProfit, roundMoney } from './financials.js';

const nonNegativeMoneySchema = z.number().nonnegative();

export const productSchema = z.object({
  id: z.string().optional(),
  supplierIntegrationId: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  sourcePlatform: z.string().nullable().optional(),
  sku: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  salePrice: nonNegativeMoneySchema,
  costPrice: nonNegativeMoneySchema.nullable().optional(),
  currency: z.string().length(3),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export function calculateExpectedProductProfit(product: {
  salePrice: number;
  costPrice?: number | null;
}) {
  if (product.costPrice == null) {
    return null;
  }

  return calculateProfit({
    revenue: roundMoney(product.salePrice),
    cost: roundMoney(product.costPrice),
  });
}

export function calculateExpectedProductMarginPercent(product: {
  salePrice: number;
  costPrice?: number | null;
}) {
  const profit = calculateExpectedProductProfit(product);

  if (profit == null) {
    return null;
  }

  return calculateMarginPercent({
    revenue: roundMoney(product.salePrice),
    profit,
  });
}

export function enrichProductFinancials<T extends {
  salePrice: number;
  costPrice?: number | null;
}>(product: T) {
  return {
    ...product,
    expectedProfit: calculateExpectedProductProfit(product),
    expectedMarginPercent: calculateExpectedProductMarginPercent(product),
  };
}

export type Product = z.infer<typeof productSchema>;
