import {
  evaluateIntegrationHealth,
  normalizeIntegrationHealthInput,
} from '@dropshipping-central/workflows';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const integrationQuerySchema = z.object({
  platform: z.string().optional(),
});

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/integrations', async (request) => {
    const query = integrationQuerySchema.parse(request.query);

    return {
      items: [],
      filters: query,
      message: 'Integration listing foundation is ready for persistence wiring.',
    };
  });

  app.get('/integrations/health-preview', async () => {
    const preview = normalizeIntegrationHealthInput({
      id: 'preview-integration',
      name: 'Preview Connector',
      platform: 'shopify',
      status: 'CONNECTED',
      lastHeartbeatAt: new Date().toISOString(),
      metadata: {},
    });

    return evaluateIntegrationHealth(preview);
  });
};
