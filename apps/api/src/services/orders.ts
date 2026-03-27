import { type Prisma } from '@dropshipping-central/db';
import { db } from '@dropshipping-central/db';
import { registerPaidOrderCommandSchema } from '@dropshipping-central/domain';
import { createFulfillmentJobsForOrder } from '@dropshipping-central/workflows';

type RegisterPaidOrderInput = Parameters<typeof registerPaidOrderCommandSchema.parse>[0];

function serializeOrder(order: {
  id: string;
  externalId: string;
  integrationId: string | null;
  sourcePlatform: string;
  status: string;
  totalAmount: Prisma.Decimal;
  currency: string;
  rawPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...order,
    totalAmount: order.totalAmount.toNumber(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function serializeFulfillmentJob(job: {
  id: string;
  orderId: string;
  integrationId: string | null;
  supplierReference: string | null;
  state: string;
  attemptCount: number;
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

export async function listOrders() {
  const orders = await db.order.findMany({
    include: {
      fulfillmentJobs: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  return orders.map((order) => ({
    ...serializeOrder(order),
    fulfillmentJobs: order.fulfillmentJobs.map(serializeFulfillmentJob),
  }));
}

export async function registerPaidOrder(input: RegisterPaidOrderInput) {
  const command = registerPaidOrderCommandSchema.parse(input);

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
        totalAmount: command.order.totalAmount.toString(),
        currency: command.order.currency,
        rawPayload: toInputJsonValue(command.order.rawPayload),
      },
      create: {
        externalId: command.order.externalId,
        integrationId: command.order.integrationId ?? null,
        sourcePlatform: command.order.sourcePlatform,
        status: 'PAID',
        totalAmount: command.order.totalAmount.toString(),
        currency: command.order.currency,
        rawPayload: toInputJsonValue(command.order.rawPayload),
      },
    });

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
            createFulfillmentJobsForOrder({
              id: order.id,
              externalId: order.externalId,
              integrationId: order.integrationId,
              sourcePlatform: order.sourcePlatform,
              status: order.status,
              totalAmount: order.totalAmount.toNumber(),
              currency: order.currency,
              rawPayload: toInputJsonValue(order.rawPayload) as Record<string, unknown>,
            }).map((job) =>
              tx.fulfillmentJob.create({
                data: {
                  orderId: order.id,
                  integrationId: job.integrationId ?? null,
                  supplierReference: job.supplierReference ?? null,
                  state: job.state,
                  attemptCount: job.attemptCount,
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
          fulfillmentJobIds: createdJobs.map((job) => job.id),
        },
      },
    });

    return {
      order: serializeOrder(order),
      fulfillmentJobs: createdJobs.map(serializeFulfillmentJob),
    };
  });
}
