import { fulfillmentJobSchema, orderSchema, type Order } from '@dropshipping-central/domain';
import {
  fulfillmentJobCreationOptionsSchema,
  type FulfillmentJobCreationOptions,
} from './types.js';

export function createFulfillmentJobsForOrder(
  orderInput: Order,
  options?: FulfillmentJobCreationOptions,
) {
  const order = orderSchema.parse(orderInput);
  const parsedOptions = fulfillmentJobCreationOptionsSchema.parse(options ?? {});

  return [
    fulfillmentJobSchema.parse({
      orderId: order.id ?? order.externalId,
      integrationId: parsedOptions.integrationId ?? order.integrationId ?? null,
      supplierReference: parsedOptions.supplierReference ?? null,
      state: 'PENDING',
      attemptCount: 0,
      errorMessage: null,
    }),
  ];
}
