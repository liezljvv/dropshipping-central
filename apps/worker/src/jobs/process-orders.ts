import { db } from '@dropshipping-central/db';
import { decideSupplierAttemptResult, supplierOrderService } from '@dropshipping-central/integrations';
import { buildSupplierOrderSubmission } from './supplier-order-utils.js';

export async function processOrdersJob() {
  console.log('[worker] process-orders started');

  const pendingJobs = await db.fulfillmentJob.findMany({
    where: {
      state: 'PENDING',
    },
    include: {
      order: true,
      supplierIntegration: true,
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
    const processingJob = await db.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        state: 'PROCESSING',
        attemptCount: {
          increment: 1,
        },
      },
    });

    await db.auditEvent.create({
      data: {
        actorType: 'WORKER',
        eventType: 'fulfillment.job.processing',
        entityType: 'FulfillmentJob',
        entityId: job.id,
        payload: {
          orderId: job.orderId,
          supplierIntegrationId: job.supplierIntegrationId,
        },
      },
    });

    const submission = buildSupplierOrderSubmission({
      orderId: job.order.externalId,
      supplierIntegrationId: job.supplierIntegrationId,
      rawPayload: job.order.rawPayload,
      totalAmount: job.order.totalAmount.toNumber(),
      currency: job.order.currency,
    });
    const orderInput = {
      ...submission,
      metadata: {
        ...submission.metadata,
        previousAttempts: job.attemptCount,
      },
      ...(job.supplierIntegrationId ? { connectionId: job.supplierIntegrationId } : {}),
    };

    const result = await supplierOrderService.submitOrder(orderInput);
    const next = decideSupplierAttemptResult({
      result,
      attemptCount: processingJob.attemptCount,
    });

    if (next.nextState === 'SUCCEEDED') {
      await db.$transaction(async (tx) => {
        await tx.fulfillmentJob.update({
          where: { id: job.id },
          data: {
            state: 'SUCCEEDED',
            supplierOrderId: result.supplierOrderId,
            retryable: false,
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
              supplierOrderId: result.supplierOrderId,
            },
          },
        });
      });

      console.log(
        `[worker] fulfillment job ${job.id} succeeded on attempt ${processingJob.attemptCount}`,
      );
    }

    if (next.nextState === 'PENDING') {
      await db.$transaction(async (tx) => {
        await tx.fulfillmentJob.update({
          where: { id: job.id },
          data: {
            state: 'PENDING',
            supplierOrderId: result.supplierOrderId,
            retryable: next.retryable,
            errorMessage: next.errorMessage,
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
              supplierOrderId: result.supplierOrderId,
              errorMessage: next.errorMessage,
            },
          },
        });
      });

      console.log(
        `[worker] fulfillment job ${job.id} retry scheduled after attempt ${processingJob.attemptCount}: ${next.errorMessage}`,
      );
    }

    if (next.nextState === 'FAILED') {
      await db.$transaction(async (tx) => {
        await tx.fulfillmentJob.update({
          where: { id: job.id },
          data: {
            state: 'FAILED',
            supplierOrderId: result.supplierOrderId,
            retryable: next.retryable,
            errorMessage: next.errorMessage,
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
              supplierOrderId: result.supplierOrderId,
              errorMessage: next.errorMessage,
            },
          },
        });
      });

      console.log(
        `[worker] fulfillment job ${job.id} failed on attempt ${processingJob.attemptCount}: ${next.errorMessage}`,
      );
    }

    console.log(`[worker] process-orders completed fulfillment job ${job.id}`);
  }
}
