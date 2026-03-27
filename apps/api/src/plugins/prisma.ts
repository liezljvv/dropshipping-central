import { db } from '@dropshipping-central/db';
import type { FastifyInstance } from 'fastify';

export async function registerPrisma(app: FastifyInstance) {
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await db.$disconnect();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db;
  }
}
