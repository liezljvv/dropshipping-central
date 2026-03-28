import { fulfillmentJobStates, orderStatuses } from '@dropshipping-central/config';
import { z } from 'zod';

export const orderStatusEnum = z.enum(orderStatuses);
export const fulfillmentJobStateEnum = z.enum(fulfillmentJobStates);

export const orderSchema = z.object({
  id: z.string().optional(),
  externalId: z.string().min(1),
  integrationId: z.string().nullable().optional(),
  sourcePlatform: z.string().min(1),
  status: orderStatusEnum,
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3),
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

export type Order = z.infer<typeof orderSchema>;
export type RegisterPaidOrderCommand = z.infer<typeof registerPaidOrderCommandSchema>;
export type FulfillmentJob = z.infer<typeof fulfillmentJobSchema>;
