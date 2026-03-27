import { db, type Prisma } from '@dropshipping-central/db';

export async function processOrdersJob() {
  console.log('[worker] process-orders started');

  const pendingJobs = await db.fulfillmentJob.findMany({
    where: {
      state: 'PENDING',
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 10,
  });

  if (pendingJobs.length === 0) {
    console.log('[worker] process-orders no pending fulfillment jobs');
    return;
  }

  for (const job of pendingJobs) {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.fulfillmentJob.update({
        where: { id: job.id },
        data: {
          state: 'PROCESSING',
          attemptCount: {
            increment: 1,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorType: 'WORKER',
          eventType: 'fulfillment.job.processing',
          entityType: 'FulfillmentJob',
          entityId: job.id,
          payload: {
            orderId: job.orderId,
          },
        },
      });

      await tx.fulfillmentJob.update({
        where: { id: job.id },
        data: {
          state: 'SUCCEEDED',
          errorMessage: null,
        },
      });

      await tx.order.update({
        where: { id: job.orderId },
        data: {
          status: 'FULFILLED',
        },
      });

      await tx.auditEvent.create({
        data: {
          actorType: 'WORKER',
          eventType: 'fulfillment.job.succeeded',
          entityType: 'FulfillmentJob',
          entityId: job.id,
          payload: {
            orderId: job.orderId,
          },
        },
      });
    });

    console.log(`[worker] process-orders completed fulfillment job ${job.id}`);
  }
}
