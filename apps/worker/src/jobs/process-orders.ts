import { db, type Prisma } from '@dropshipping-central/db';
import { decideFulfillmentExecution } from '@dropshipping-central/workflows';

function toWorkflowPayload(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function processOrdersJob() {
  console.log('[worker] process-orders started');

  const pendingJobs = await db.fulfillmentJob.findMany({
    where: {
      state: 'PENDING',
    },
    include: {
      order: true,
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
      const processingJob = await tx.fulfillmentJob.update({
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

      const decision = decideFulfillmentExecution({
        attemptCount: job.attemptCount,
        rawPayload: toWorkflowPayload(job.order.rawPayload),
      });

      if (decision.nextState === 'SUCCEEDED') {
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
              attemptCount: processingJob.attemptCount,
            },
          },
        });

        console.log(
          `[worker] fulfillment job ${job.id} succeeded on attempt ${processingJob.attemptCount}`,
        );
      }

      if (decision.nextState === 'PENDING') {
        await tx.fulfillmentJob.update({
          where: { id: job.id },
          data: {
            state: 'PENDING',
            errorMessage: decision.errorMessage,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorType: 'WORKER',
            eventType: 'fulfillment.job.retry_scheduled',
            entityType: 'FulfillmentJob',
            entityId: job.id,
            payload: {
              orderId: job.orderId,
              attemptCount: processingJob.attemptCount,
              errorMessage: decision.errorMessage,
            },
          },
        });

        console.log(
          `[worker] fulfillment job ${job.id} retry scheduled after attempt ${processingJob.attemptCount}: ${decision.errorMessage}`,
        );
      }

      if (decision.nextState === 'FAILED') {
        await tx.fulfillmentJob.update({
          where: { id: job.id },
          data: {
            state: 'FAILED',
            errorMessage: decision.errorMessage,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorType: 'WORKER',
            eventType: 'fulfillment.job.failed',
            entityType: 'FulfillmentJob',
            entityId: job.id,
            payload: {
              orderId: job.orderId,
              attemptCount: processingJob.attemptCount,
              errorMessage: decision.errorMessage,
            },
          },
        });

        console.log(
          `[worker] fulfillment job ${job.id} failed on attempt ${processingJob.attemptCount}: ${decision.errorMessage}`,
        );
      }
    });

    console.log(`[worker] process-orders completed fulfillment job ${job.id}`);
  }
}
