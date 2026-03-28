import { db, type Prisma } from '@dropshipping-central/db';
import {
  calculateOrderFinancials,
  type OrderLineItem,
  type RegisterPaidOrderCommand,
  orderLineItemSchema,
  registerPaidOrderCommandSchema,
} from '@dropshipping-central/domain';
import { supplierConnectionService } from '@dropshipping-central/integrations';
import {
  createFulfillmentJobsForOrder,
  evaluateAndPersistOrderProfitabilityAlerts,
} from '@dropshipping-central/workflows';

type RegisterPaidOrderInput = RegisterPaidOrderCommand;

function serializeNullableDecimal(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : value.toNumber();
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function serializeOrderLineItem(lineItem: {
  id: string;
  orderId: string;
  productId: string | null;
  externalId: string | null;
  sku: string;
  title: string;
  quantity: number;
  unitSalePrice: Prisma.Decimal;
  unitCostPrice: Prisma.Decimal | null;
  currency: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...lineItem,
    unitSalePrice: lineItem.unitSalePrice.toNumber(),
    unitCostPrice: serializeNullableDecimal(lineItem.unitCostPrice),
    lineRevenue: Number((lineItem.unitSalePrice.toNumber() * lineItem.quantity).toFixed(2)),
    lineCost:
      lineItem.unitCostPrice == null
        ? null
        : Number((lineItem.unitCostPrice.toNumber() * lineItem.quantity).toFixed(2)),
    createdAt: lineItem.createdAt.toISOString(),
    updatedAt: lineItem.updatedAt.toISOString(),
  };
}

function toDomainOrder(order: {
  id: string;
  externalId: string;
  integrationId: string | null;
  sourcePlatform: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'RETURNED' | 'FULFILLED';
  totalAmount: Prisma.Decimal;
  currency: string;
  shippingRevenue: Prisma.Decimal;
  fulfillmentCost: Prisma.Decimal | null;
  transactionFee: Prisma.Decimal | null;
  rawPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: Array<{
    id: string;
    productId: string | null;
    externalId: string | null;
    sku: string;
    title: string;
    quantity: number;
    unitSalePrice: Prisma.Decimal;
    unitCostPrice: Prisma.Decimal | null;
    currency: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) {
  return {
    id: order.id,
    externalId: order.externalId,
    integrationId: order.integrationId,
    sourcePlatform: order.sourcePlatform,
    status: order.status,
    totalAmount: order.totalAmount.toNumber(),
    currency: order.currency,
    shippingRevenue: order.shippingRevenue.toNumber(),
    fulfillmentCost: serializeNullableDecimal(order.fulfillmentCost),
    transactionFee: serializeNullableDecimal(order.transactionFee),
    lineItems: order.lineItems.map((lineItem) => ({
      id: lineItem.id,
      productId: lineItem.productId,
      externalId: lineItem.externalId,
      sku: lineItem.sku,
      title: lineItem.title,
      quantity: lineItem.quantity,
      unitSalePrice: lineItem.unitSalePrice.toNumber(),
      unitCostPrice: serializeNullableDecimal(lineItem.unitCostPrice),
      currency: lineItem.currency,
      metadata:
        lineItem.metadata && typeof lineItem.metadata === 'object' && !Array.isArray(lineItem.metadata)
          ? (lineItem.metadata as Record<string, unknown>)
          : {},
      createdAt: lineItem.createdAt.toISOString(),
      updatedAt: lineItem.updatedAt.toISOString(),
    })),
    rawPayload: toRecord(order.rawPayload),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function serializeFulfillmentJob(job: {
  id: string;
  orderId: string;
  integrationId: string | null;
  supplierIntegrationId: string | null;
  supplierReference: string | null;
  supplierOrderId: string | null;
  state: string;
  attemptCount: number;
  retryable: boolean;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeOrder(order: {
  id: string;
  externalId: string;
  integrationId: string | null;
  sourcePlatform: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'RETURNED' | 'FULFILLED';
  totalAmount: Prisma.Decimal;
  currency: string;
  subtotalRevenue: Prisma.Decimal;
  shippingRevenue: Prisma.Decimal;
  totalRevenue: Prisma.Decimal;
  totalProductCost: Prisma.Decimal | null;
  fulfillmentCost: Prisma.Decimal | null;
  transactionFee: Prisma.Decimal | null;
  totalCost: Prisma.Decimal | null;
  rawPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems?: Array<{
    id: string;
    orderId: string;
    productId: string | null;
    externalId: string | null;
    sku: string;
    title: string;
    quantity: number;
    unitSalePrice: Prisma.Decimal;
    unitCostPrice: Prisma.Decimal | null;
    currency: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  fulfillmentJobs?: Array<{
    id: string;
    orderId: string;
    integrationId: string | null;
    supplierIntegrationId: string | null;
    supplierReference: string | null;
    supplierOrderId: string | null;
    state: string;
    attemptCount: number;
    retryable: boolean;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) {
  const totalRevenue = order.totalRevenue.toNumber();
  const totalCost = serializeNullableDecimal(order.totalCost);
  const financials = calculateOrderFinancials({
    status: order.status,
    shippingRevenue: order.shippingRevenue.toNumber(),
    lineItems: (order.lineItems ?? []).map((lineItem) => ({
      quantity: lineItem.quantity,
      unitSalePrice: lineItem.unitSalePrice.toNumber(),
      unitCostPrice: serializeNullableDecimal(lineItem.unitCostPrice),
    })),
    ...(order.fulfillmentCost != null
      ? { fulfillmentCost: serializeNullableDecimal(order.fulfillmentCost) }
      : {}),
    ...(order.transactionFee != null
      ? { transactionFee: serializeNullableDecimal(order.transactionFee) }
      : {}),
  });

  return {
    ...order,
    totalAmount: order.totalAmount.toNumber(),
    subtotalRevenue: order.subtotalRevenue.toNumber(),
    shippingRevenue: order.shippingRevenue.toNumber(),
    totalRevenue,
    totalProductCost: serializeNullableDecimal(order.totalProductCost),
    fulfillmentCost: serializeNullableDecimal(order.fulfillmentCost),
    transactionFee: serializeNullableDecimal(order.transactionFee),
    totalCost,
    grossProfit: financials.grossProfit,
    marginPercent: financials.marginPercent,
    rawPayload: toRecord(order.rawPayload),
    lineItems: (order.lineItems ?? []).map(serializeOrderLineItem),
    fulfillmentJobs: (order.fulfillmentJobs ?? []).map(serializeFulfillmentJob),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function resolveOrderLineItems(input: {
  lineItems: RegisterPaidOrderInput['order']['lineItems'];
  rawPayload: Record<string, unknown>;
  totalAmount: number;
  currency: string;
}): Promise<OrderLineItem[]> {
  const payloadLines = Array.isArray(input.rawPayload.lineItems)
    ? input.rawPayload.lineItems
    : Array.isArray(input.rawPayload.supplierLines)
      ? input.rawPayload.supplierLines
      : [];

  const draftLineItems =
    input.lineItems.length > 0
      ? input.lineItems
      : payloadLines.length > 0
        ? payloadLines.map((line, index) => {
            const payload = typeof line === 'object' && line ? (line as Record<string, unknown>) : {};
            return orderLineItemSchema.parse({
              productId: payload.productId ? String(payload.productId) : null,
              externalId: payload.externalId ? String(payload.externalId) : null,
              sku: String(payload.sku ?? `AUTO-SKU-${index + 1}`),
              title: String(payload.title ?? payload.sku ?? `Order line ${index + 1}`),
              quantity: Number(payload.quantity ?? 1),
              unitSalePrice: Number(payload.unitSalePrice ?? payload.unitPrice ?? input.totalAmount),
              unitCostPrice:
                payload.unitCostPrice == null ? null : Number(payload.unitCostPrice),
              currency: String(payload.currency ?? input.currency),
              metadata: payload,
            })
          })
        : [
            orderLineItemSchema.parse({
              sku: 'AUTO-SKU-1',
              title: 'Auto-generated order line',
              quantity: 1,
              unitSalePrice: input.totalAmount,
              unitCostPrice: null,
              currency: input.currency,
              metadata: {},
            }),
          ];

  const productIds = draftLineItems
    .map((lineItem) => lineItem.productId)
    .filter((productId): productId is string => Boolean(productId));
  const skus = draftLineItems.map((lineItem) => lineItem.sku);
  const products = await db.product.findMany({
    where: {
      OR: [
        ...(productIds.length > 0 ? [{ id: { in: productIds } }] : []),
        ...(skus.length > 0 ? [{ sku: { in: skus } }] : []),
      ],
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const productBySku = new Map(products.map((product) => [product.sku, product]));

  return draftLineItems.map((lineItem) => {
    const matchedProduct =
      (lineItem.productId ? productById.get(lineItem.productId) : null) ?? productBySku.get(lineItem.sku);

    return orderLineItemSchema.parse({
      ...lineItem,
      productId: lineItem.productId ?? matchedProduct?.id ?? null,
      externalId: lineItem.externalId ?? matchedProduct?.externalId ?? null,
      title: lineItem.title || matchedProduct?.title || lineItem.sku,
      unitSalePrice: lineItem.unitSalePrice ?? matchedProduct?.salePrice.toNumber() ?? input.totalAmount,
      unitCostPrice:
        lineItem.unitCostPrice != null
          ? lineItem.unitCostPrice
          : matchedProduct?.costPrice?.toNumber() ?? null,
      currency: lineItem.currency ?? matchedProduct?.currency ?? input.currency,
      metadata: lineItem.metadata,
    });
  });
}

export async function listOrders() {
  const orders = await db.order.findMany({
    include: {
      lineItems: true,
      fulfillmentJobs: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  return orders.map(serializeOrder);
}

export async function registerPaidOrder(input: RegisterPaidOrderInput) {
  const command = registerPaidOrderCommandSchema.parse(input);
  const defaultSupplierConnection = await supplierConnectionService.getDefaultConnection();
  const rawPayload = command.order.rawPayload;
  const lineItems = await resolveOrderLineItems({
    lineItems: command.order.lineItems,
    rawPayload,
    totalAmount: command.order.totalAmount,
    currency: command.order.currency,
  });
  const financials = calculateOrderFinancials({
    status: command.order.status,
    lineItems: lineItems.map((lineItem) => ({
      quantity: lineItem.quantity,
      unitSalePrice: lineItem.unitSalePrice,
      ...(lineItem.unitCostPrice !== undefined ? { unitCostPrice: lineItem.unitCostPrice } : {}),
    })),
    shippingRevenue: command.order.shippingRevenue,
    ...(command.order.fulfillmentCost !== undefined
      ? { fulfillmentCost: command.order.fulfillmentCost }
      : {}),
    ...(command.order.transactionFee !== undefined
      ? { transactionFee: command.order.transactionFee }
      : {}),
  });

  return db.$transaction(async (tx) => {
    const order = await tx.order.upsert({
      where: {
        externalId_sourcePlatform: {
          externalId: command.order.externalId,
          sourcePlatform: command.order.sourcePlatform,
        },
      },
      update: {
        integrationId: command.order.integrationId ?? null,
        status: 'PAID',
        totalAmount: financials.totalRevenue.toString(),
        currency: command.order.currency,
        subtotalRevenue: financials.subtotalRevenue.toString(),
        shippingRevenue: financials.shippingRevenue.toString(),
        totalRevenue: financials.totalRevenue.toString(),
        totalProductCost:
          financials.totalProductCost == null ? null : financials.totalProductCost.toString(),
        fulfillmentCost: financials.fulfillmentCost.toString(),
        transactionFee: financials.transactionFee.toString(),
        totalCost: financials.totalCost == null ? null : financials.totalCost.toString(),
        rawPayload: toInputJsonValue(rawPayload),
      },
      create: {
        externalId: command.order.externalId,
        integrationId: command.order.integrationId ?? null,
        sourcePlatform: command.order.sourcePlatform,
        status: 'PAID',
        totalAmount: financials.totalRevenue.toString(),
        currency: command.order.currency,
        subtotalRevenue: financials.subtotalRevenue.toString(),
        shippingRevenue: financials.shippingRevenue.toString(),
        totalRevenue: financials.totalRevenue.toString(),
        totalProductCost:
          financials.totalProductCost == null ? null : financials.totalProductCost.toString(),
        fulfillmentCost: financials.fulfillmentCost.toString(),
        transactionFee: financials.transactionFee.toString(),
        totalCost: financials.totalCost == null ? null : financials.totalCost.toString(),
        rawPayload: toInputJsonValue(rawPayload),
      },
    });

    await tx.orderLineItem.deleteMany({
      where: {
        orderId: order.id,
      },
    });

    await Promise.all(
      lineItems.map((lineItem) =>
        tx.orderLineItem.create({
          data: {
            orderId: order.id,
            productId: lineItem.productId ?? null,
            externalId: lineItem.externalId ?? null,
            sku: lineItem.sku,
            title: lineItem.title,
            quantity: lineItem.quantity,
            unitSalePrice: lineItem.unitSalePrice.toString(),
            unitCostPrice: lineItem.unitCostPrice == null ? null : lineItem.unitCostPrice.toString(),
            currency: lineItem.currency,
            metadata: toInputJsonValue(lineItem.metadata),
          },
        }),
      ),
    );

    const openJobs = await tx.fulfillmentJob.findMany({
      where: {
        orderId: order.id,
        state: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
    });

    const createdJobs =
      openJobs.length > 0
        ? openJobs
        : await Promise.all(
            createFulfillmentJobsForOrder(
              {
                id: order.id,
                externalId: order.externalId,
                integrationId: order.integrationId,
                sourcePlatform: order.sourcePlatform,
                status: order.status,
                totalAmount: order.totalAmount.toNumber(),
                currency: order.currency,
                shippingRevenue: order.shippingRevenue.toNumber(),
                fulfillmentCost: serializeNullableDecimal(order.fulfillmentCost),
                transactionFee: serializeNullableDecimal(order.transactionFee),
                lineItems,
                rawPayload,
              },
              {
                supplierIntegrationId: defaultSupplierConnection?.id,
              },
            ).map((job) =>
              tx.fulfillmentJob.create({
                data: {
                  orderId: order.id,
                  integrationId: job.integrationId ?? null,
                  supplierIntegrationId: job.supplierIntegrationId ?? null,
                  supplierReference: job.supplierReference ?? null,
                  supplierOrderId: job.supplierOrderId ?? null,
                  state: job.state,
                  attemptCount: job.attemptCount,
                  retryable: job.retryable ?? false,
                  errorMessage: job.errorMessage ?? null,
                },
              }),
            ),
          );

    await tx.auditEvent.create({
      data: {
        actorType: 'SYSTEM',
        eventType: 'order.registered_paid',
        entityType: 'Order',
        entityId: order.id,
        payload: {
          sourcePlatform: order.sourcePlatform,
          lineItemCount: lineItems.length,
          fulfillmentJobIds: createdJobs.map((job) => job.id),
        },
      },
    });

    const hydratedOrder = await tx.order.findUniqueOrThrow({
      where: {
        id: order.id,
      },
      include: {
        lineItems: true,
      },
    });

    await evaluateAndPersistOrderProfitabilityAlerts({
      tx,
      actorType: 'SYSTEM',
      order: toDomainOrder(hydratedOrder),
    });

    return {
      order: serializeOrder(hydratedOrder),
      fulfillmentJobs: createdJobs.map(serializeFulfillmentJob),
    };
  });
}
