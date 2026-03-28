import { supplierCatalogService, supplierConnectionService } from '@dropshipping-central/integrations';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const supplierSearchQuerySchema = z.object({
  connectionId: z.string().optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});

export const supplierRoutes: FastifyPluginAsync = async (app) => {
  app.get('/supplier-connections', async () => {
    return {
      items: await supplierConnectionService.listConnections(),
    };
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
