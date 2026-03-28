import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
export const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');

export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  PROFITABILITY_PRODUCT_MIN_MARGIN_PERCENT: z.coerce.number().nonnegative().default(20),
  PROFITABILITY_PRODUCT_MIN_PROFIT: z.coerce.number().nonnegative().default(10),
  PROFITABILITY_ORDER_MIN_MARGIN_PERCENT: z.coerce.number().nonnegative().default(15),
  SHOPIFY_SUPPLIER_SHOP_DOMAIN: z.string().trim().min(1).optional(),
  SHOPIFY_SUPPLIER_ACCESS_TOKEN: z.string().trim().min(1).optional(),
  SHOPIFY_SUPPLIER_API_VERSION: z.string().trim().min(1).default('2025-10'),
  SHOPIFY_SUPPLIER_LOCATION_ID: z.string().trim().min(1).optional(),
  SHOPIFY_SUPPLIER_INVENTORY_POLICY: z.string().trim().min(1).optional(),
});

export const apiEnvSchema = sharedEnvSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(3000),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function defineApiEnv(input: Record<string, string | undefined>) {
  return apiEnvSchema.parse(input);
}

export const profitabilityAlertSeverities = ['info', 'warning', 'critical'] as const;
export const profitabilityAlertStatuses = ['ACTIVE', 'RESOLVED'] as const;
export const profitabilityAlertEntityTypes = ['PRODUCT', 'ORDER'] as const;
export const profitabilityRuleCodes = [
  'PRODUCT_LOW_EXPECTED_MARGIN',
  'PRODUCT_LOW_EXPECTED_PROFIT',
  'ORDER_NEGATIVE_GROSS_PROFIT',
  'ORDER_LOW_MARGIN',
  'ORDER_INCOMPLETE_COST_DATA',
] as const;

export const defaultProfitabilityThresholds = {
  productMinMarginPercent: 20,
  productMinProfit: 10,
  orderMinMarginPercent: 15,
} as const;

export type ProfitabilityThresholdConfig = {
  productMinMarginPercent: number;
  productMinProfit: number;
  orderMinMarginPercent: number;
};

export function defineProfitabilityThresholdConfig(input: Record<string, string | undefined>) {
  const env = sharedEnvSchema.parse(input);

  return {
    productMinMarginPercent: env.PROFITABILITY_PRODUCT_MIN_MARGIN_PERCENT,
    productMinProfit: env.PROFITABILITY_PRODUCT_MIN_PROFIT,
    orderMinMarginPercent: env.PROFITABILITY_ORDER_MIN_MARGIN_PERCENT,
  } satisfies ProfitabilityThresholdConfig;
}

export const APP_NAME = 'Dropshipping Central';
export const API_PREFIX = '/api/v1';

export const integrationStatuses = [
  'PENDING',
  'CONNECTED',
  'NOT_CONFIGURED',
  'AUTH_FAILED',
  'DEGRADED',
  'ERROR',
  'DISCONNECTED',
] as const;
export const orderStatuses = ['PENDING', 'PAID', 'CANCELLED', 'RETURNED', 'FULFILLED'] as const;
export const fulfillmentJobStates = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'] as const;
export const workflowRunStates = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;
export const actorTypes = ['SYSTEM', 'USER', 'WORKER'] as const;
