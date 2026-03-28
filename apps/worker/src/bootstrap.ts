import { sharedEnvSchema } from '@dropshipping-central/config';
import { processOrdersJob } from './jobs/process-orders.js';
import { processWorkflowsJob } from './jobs/process-workflows.js';
import { retryFailedSupplierSubmissionsJob } from './jobs/retry-failed-supplier-submissions.js';
import { syncSupplierCatalogJob } from './jobs/sync-supplier-catalog.js';
import { syncSupplierInventoryJob } from './jobs/sync-supplier-inventory.js';
import { syncSupplierPricingJob } from './jobs/sync-supplier-pricing.js';
import { syncIntegrationsJob } from './jobs/sync-integrations.js';

type ScheduledJob = {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
};

const jobs: ScheduledJob[] = [
  { name: 'process-workflows', intervalMs: 15_000, run: processWorkflowsJob },
  { name: 'sync-integrations', intervalMs: 30_000, run: syncIntegrationsJob },
  { name: 'sync-supplier-catalog', intervalMs: 45_000, run: syncSupplierCatalogJob },
  { name: 'sync-supplier-inventory', intervalMs: 50_000, run: syncSupplierInventoryJob },
  { name: 'sync-supplier-pricing', intervalMs: 55_000, run: syncSupplierPricingJob },
  { name: 'process-orders', intervalMs: 20_000, run: processOrdersJob },
  {
    name: 'retry-failed-supplier-submissions',
    intervalMs: 60_000,
    run: retryFailedSupplierSubmissionsJob,
  },
];

export function bootstrapWorker() {
  const env = sharedEnvSchema.parse(process.env);

  console.log(`[worker] booting in ${env.NODE_ENV} mode`);

  for (const job of jobs) {
    console.log(`[worker] scheduling ${job.name} every ${job.intervalMs}ms`);
    void job.run();
    setInterval(() => {
      void job.run();
    }, job.intervalMs);
  }
}
