import { API_PREFIX, type ApiEnv } from '@dropshipping-central/config';
import Fastify, { type FastifyError } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerEnv } from './plugins/env.js';
import { registerPrisma } from './plugins/prisma.js';
import { healthRoutes } from './routes/health.js';
import { integrationRoutes } from './routes/integrations.js';
import { orderRoutes } from './routes/orders.js';
import { supplierRoutes } from './routes/suppliers.js';
import { workflowRoutes } from './routes/workflows.js';

export function createApp(_env: ApiEnv) {
  const appDir = path.dirname(fileURLToPath(import.meta.url));
  const dashboardPath = path.resolve(appDir, '../../web/index.html');
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const fastifyError = error as FastifyError;

    reply.status(fastifyError.statusCode ?? 500).send({
      error: fastifyError.name,
      message: fastifyError.message,
    });
  });

  app.register(registerEnv);
  app.register(registerPrisma);
  app.get('/dashboard', async (_request, reply) => {
    const html = await readFile(dashboardPath, 'utf8');

    reply.type('text/html; charset=utf-8');
    return html;
  });
  app.register(
    async (api) => {
      api.register(healthRoutes);
      api.register(integrationRoutes);
      api.register(orderRoutes);
      api.register(supplierRoutes);
      api.register(workflowRoutes);
    },
    { prefix: API_PREFIX },
  );

  return app;
}
