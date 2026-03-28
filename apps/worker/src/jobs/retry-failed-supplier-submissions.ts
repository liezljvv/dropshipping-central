import { db } from '@dropshipping-central/db';

const MAX_RETRYABLE_FAILURE_ATTEMPTS = 5;

export async function retryFailedSupplierSubmissionsJob() {
  console.log('[worker] retry-failed-supplier-submissions started');

  const failedJobs = await db.fulfillmentJob.findMany({
    where: {
      state: 'FAILED',
      retryable: true,
      attemptCount: {
        lt: MAX_RETRYABLE_FAILURE_ATTEMPTS,
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
    take: 10,
  });

  for (const job of failedJobs) {
    await db.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        state: 'PENDING',
        errorMessage: 'Retrying failed supplier submission.',
      },
    });

    await db.auditEvent.create({
      data: {
        actorType: 'WORKER',
        eventType: 'supplier.job.requeued',
        entityType: 'FulfillmentJob',
        entityId: job.id,
        payload: {
          attemptCount: job.attemptCount,
          supplierIntegrationId: job.supplierIntegrationId,
        },
      },
    });
  }
}
