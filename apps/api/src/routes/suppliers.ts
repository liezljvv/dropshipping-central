import { supplierCatalogService, supplierConnectionService } from '@dropshipping-central/integrations';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const supplierSearchQuerySchema = z.object({
  connectionId: z.string().optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});

const supplierConnectionParamsSchema = z.object({
  connectionId: z.string().min(1),
});

export const supplierRoutes: FastifyPluginAsync = async (app) => {
  app.get('/supplier-connections', async () => {
    return {
      items: await supplierConnectionService.listConnections(),
    };
  });

  app.get('/supplier-connections/:connectionId', async (request, reply) => {
    const params = supplierConnectionParamsSchema.parse(request.params);
    const connection = await supplierConnectionService.getConnection(params.connectionId);

    if (!connection) {
      reply.code(404);
      return {
        error: 'Not Found',
        message: `Supplier connection not found: ${params.connectionId}`,
      };
    }

    return {
      item: connection,
    };
  });

  app.post('/supplier-connections/:connectionId/test', async (request) => {
    const params = supplierConnectionParamsSchema.parse(request.params);
    return supplierConnectionService.testConnection(params.connectionId);
  });

  app.get('/supplier-catalog/search', async (request) => {
    const query = supplierSearchQuerySchema.parse(request.query);
    const tags = Array.isArray(query.tags)
      ? query.tags
      : query.tags
        ? query.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];

    return {
      items: await supplierCatalogService.searchProducts({
        ...(query.connectionId ? { connectionId: query.connectionId } : {}),
        ...(query.query ? { query: query.query } : {}),
        limit: query.limit,
        tags,
      }),
    };
  });
};
