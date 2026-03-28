import { registerPaidOrderCommandSchema } from '@dropshipping-central/domain';
import type { FastifyPluginAsync } from 'fastify';
import { listOrders, registerPaidOrder } from '../services/orders.js';

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orders', async () => {
    return {
      items: await listOrders(),
    };
  });

  app.post('/orders/register-paid', async (request, reply) => {
    const result = await registerPaidOrder(registerPaidOrderCommandSchema.parse(request.body));

    reply.code(202);
    return {
      accepted: true,
      ...result,
    };
  });
};
