import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });
};
