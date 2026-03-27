import { workflowRunSchema } from '@dropshipping-central/domain';
import type { FastifyPluginAsync } from 'fastify';

export const workflowRoutes: FastifyPluginAsync = async (app) => {
  app.get('/workflows', async () => {
    return {
      items: [],
      message: 'Workflow runtime foundation is ready for orchestration wiring.',
    };
  });

  app.get('/workflows/preview', async () => {
    return workflowRunSchema.parse({
      workflowType: 'integration-health',
      state: 'RUNNING',
      context: { mode: 'preview' },
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });
  });
};
