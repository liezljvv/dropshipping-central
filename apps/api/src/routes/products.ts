import { productSchema } from '@dropshipping-central/domain';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createProduct, listProducts, updateProduct } from '../services/products.js';

const productParamsSchema = z.object({
  productId: z.string().min(1),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get('/products', async () => {
    return {
      items: await listProducts(),
    };
  });

  app.post('/products', async (request, reply) => {
    const product = await createProduct(productSchema.parse(request.body));

    reply.code(201);
    return {
      item: product,
    };
  });

  app.put('/products/:productId', async (request) => {
    const params = productParamsSchema.parse(request.params);

    return {
      item: await updateProduct(params.productId, productSchema.parse(request.body)),
    };
  });
};
