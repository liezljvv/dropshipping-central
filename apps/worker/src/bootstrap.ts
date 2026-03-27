import { sharedEnvSchema } from '@dropshipping-central/config';
import { processOrdersJob } from './jobs/process-orders.js';
import { processWorkflowsJob } from './jobs/process-workflows.js';
import { syncIntegrationsJob } from './jobs/sync-integrations.js';

type ScheduledJob = {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
};

const jobs: ScheduledJob[] = [
  { name: 'process-workflows', intervalMs: 15_000, run: processWorkflowsJob },
  { name: 'sync-integrations', intervalMs: 30_000, run: syncIntegrationsJob },
  { name: 'process-orders', intervalMs: 20_000, run: processOrdersJob },
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
