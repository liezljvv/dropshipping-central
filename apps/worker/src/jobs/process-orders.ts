import { db } from '@dropshipping-central/db';
import { decideSupplierAttemptResult, supplierOrderService } from '@dropshipping-central/integrations';
import { evaluateAndPersistOrderProfitabilityAlerts } from '@dropshipping-central/workflows';
import { buildSupplierOrderSubmission } from './supplier-order-utils.js';

export async function processOrdersJob() {
  console.log('[worker] process-orders started');

  const pendingJobs = await db.fulfillmentJob.findMany({
    where: {
      state: 'PENDING',
    },
    include: {
      order: {
        include: {
          lineItems: true,
        },
      },
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
      lineItems: job.order.lineItems.map((lineItem) => ({
        sku: lineItem.sku,
        quantity: lineItem.quantity,
        unitSalePrice: lineItem.unitSalePrice.toNumber(),
        currency: lineItem.currency,
        externalId: lineItem.externalId,
      })),
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

        const updatedOrder = await tx.order.findUniqueOrThrow({
          where: { id: job.orderId },
          include: {
            lineItems: true,
          },
        });

        await evaluateAndPersistOrderProfitabilityAlerts({
          tx,
          actorType: 'WORKER',
          order: {
            id: updatedOrder.id,
            externalId: updatedOrder.externalId,
            integrationId: updatedOrder.integrationId,
            sourcePlatform: updatedOrder.sourcePlatform,
            status: updatedOrder.status,
            totalAmount: updatedOrder.totalAmount.toNumber(),
            currency: updatedOrder.currency,
            shippingRevenue: updatedOrder.shippingRevenue.toNumber(),
            fulfillmentCost: updatedOrder.fulfillmentCost?.toNumber() ?? null,
            transactionFee: updatedOrder.transactionFee?.toNumber() ?? null,
            lineItems: updatedOrder.lineItems.map((lineItem) => ({
              id: lineItem.id,
              productId: lineItem.productId,
              externalId: lineItem.externalId,
              sku: lineItem.sku,
              title: lineItem.title,
              quantity: lineItem.quantity,
              unitSalePrice: lineItem.unitSalePrice.toNumber(),
              unitCostPrice: lineItem.unitCostPrice?.toNumber() ?? null,
              currency: lineItem.currency,
              metadata:
                lineItem.metadata && typeof lineItem.metadata === 'object' && !Array.isArray(lineItem.metadata)
                  ? (lineItem.metadata as Record<string, unknown>)
                  : {},
              createdAt: lineItem.createdAt.toISOString(),
              updatedAt: lineItem.updatedAt.toISOString(),
            })),
            rawPayload:
              updatedOrder.rawPayload && typeof updatedOrder.rawPayload === 'object' && !Array.isArray(updatedOrder.rawPayload)
                ? (updatedOrder.rawPayload as Record<string, unknown>)
                : {},
            createdAt: updatedOrder.createdAt.toISOString(),
            updatedAt: updatedOrder.updatedAt.toISOString(),
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
