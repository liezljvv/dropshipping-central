import { integrationStatuses } from '@dropshipping-central/config';
import { z } from 'zod';

export const supplierProviderEnum = z.enum(['mock', 'shopify']);
export const supplierIntegrationStatusEnum = z.enum(integrationStatuses);

export const supplierCapabilitySetSchema = z.object({
  searchProducts: z.boolean().default(true),
  getProductById: z.boolean().default(true),
  getInventory: z.boolean().default(true),
  getPricing: z.boolean().default(true),
  submitOrder: z.boolean().default(true),
  getOrderStatus: z.boolean().default(true),
  cancelOrder: z.boolean().default(false),
});

export const supplierConnectionConfigSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().url().optional(),
  shopDomain: z.string().min(1).optional(),
  apiVersion: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  inventoryPolicy: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const supplierConnectionTestResultSchema = z.object({
  checkedAt: z.iso.datetime(),
  ok: z.boolean(),
  status: supplierIntegrationStatusEnum,
  message: z.string().min(1),
  missingFields: z.array(z.string()).default([]),
});

export const supplierConnectionReadinessSchema = z.object({
  configured: z.boolean(),
  status: supplierIntegrationStatusEnum,
  missingFields: z.array(z.string()).default([]),
  diagnostics: z.array(z.string()).default([]),
  nextStep: z.string().nullable().default(null),
  test: supplierConnectionTestResultSchema.nullable().default(null),
});

export const supplierVariantSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  sku: z.string().min(1),
  title: z.string().min(1),
  optionValues: z.record(z.string(), z.string()).default({}),
});

export const supplierProductSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  supplierName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  imageUrls: z.array(z.string()).default([]),
  variants: z.array(supplierVariantSchema).default([]),
  updatedAt: z.iso.datetime(),
});

export const supplierInventorySchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  available: z.number().int(),
  reserved: z.number().int().nonnegative().default(0),
  updatedAt: z.iso.datetime(),
});

export const supplierPriceSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  currency: z.string().length(3),
  amount: z.number().nonnegative(),
  compareAtAmount: z.number().nonnegative().nullable().optional(),
  updatedAt: z.iso.datetime(),
});

export const supplierAddressSchema = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  region: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
  phone: z.string().optional(),
});

export const supplierOrderLineSchema = z.object({
  variantId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  currency: z.string().length(3),
});

export const supplierOrderSubmissionSchema = z.object({
  externalOrderId: z.string().min(1),
  supplierIntegrationId: z.string().optional(),
  shippingAddress: supplierAddressSchema,
  lines: z.array(supplierOrderLineSchema).min(1),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const supplierOrderResultSchema = z.object({
  supplierOrderId: z.string().min(1),
  accepted: z.boolean(),
  status: z.string().min(1),
  retryable: z.boolean().default(false),
  message: z.string().nullable().optional(),
  rawResponse: z.record(z.string(), z.unknown()).default({}),
  processedAt: z.iso.datetime(),
});

export const supplierProductSearchInputSchema = z.object({
  query: z.string().min(1).optional(),
  tags: z.array(z.string()).default([]),
  limit: z.number().int().positive().max(100).default(20),
});

export const supplierConnectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  provider: z.string().min(1),
  status: supplierIntegrationStatusEnum,
  config: supplierConnectionConfigSchema,
  capabilities: supplierCapabilitySetSchema,
  readiness: supplierConnectionReadinessSchema.optional(),
  lastCatalogSyncAt: z.iso.datetime().nullable().optional(),
  lastInventorySyncAt: z.iso.datetime().nullable().optional(),
  lastPricingSyncAt: z.iso.datetime().nullable().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type SupplierCapabilitySet = z.infer<typeof supplierCapabilitySetSchema>;
export type SupplierConnectionConfig = z.infer<typeof supplierConnectionConfigSchema>;
export type SupplierVariant = z.infer<typeof supplierVariantSchema>;
export type SupplierProduct = z.infer<typeof supplierProductSchema>;
export type SupplierInventory = z.infer<typeof supplierInventorySchema>;
export type SupplierPrice = z.infer<typeof supplierPriceSchema>;
export type SupplierOrderSubmission = z.infer<typeof supplierOrderSubmissionSchema>;
export type SupplierOrderResult = z.infer<typeof supplierOrderResultSchema>;
export type SupplierProductSearchInput = z.infer<typeof supplierProductSearchInputSchema>;
export type SupplierConnection = z.infer<typeof supplierConnectionSchema>;
export type SupplierConnectionReadiness = z.infer<typeof supplierConnectionReadinessSchema>;
export type SupplierConnectionTestResult = z.infer<typeof supplierConnectionTestResultSchema>;

export interface SupplierConnector {
  readonly provider: string;
  readonly capabilities: SupplierCapabilitySet;
  searchProducts(input: SupplierProductSearchInput): Promise<SupplierProduct[]>;
  getProductById(productId: string): Promise<SupplierProduct | null>;
  getInventory(productIds: string[]): Promise<SupplierInventory[]>;
  getPricing(productIds: string[]): Promise<SupplierPrice[]>;
  submitOrder(command: SupplierOrderSubmission): Promise<SupplierOrderResult>;
  getOrderStatus(orderId: string): Promise<SupplierOrderResult | null>;
  cancelOrder?(orderId: string): Promise<SupplierOrderResult>;
}
