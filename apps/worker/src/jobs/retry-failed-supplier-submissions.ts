import { db } from '@dropshipping-central/db';

const MAX_RETRYABLE_FAILURE_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5_000;

function getRetryDelayMs(attemptCount: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(attemptCount - 1, 0), 5 * 60_000);
}

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

  const eligibleJobs = failedJobs.filter((job) => {
    const delayMs = getRetryDelayMs(job.attemptCount);
    return Date.now() - job.updatedAt.getTime() >= delayMs;
  });

  for (const job of eligibleJobs) {
    await db.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        state: 'PENDING',
        errorMessage: `Retrying failed supplier submission after backoff (${getRetryDelayMs(job.attemptCount)}ms).`,
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
