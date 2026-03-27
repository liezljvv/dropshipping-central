import { defineApiEnv, type ApiEnv } from '@dropshipping-central/config';
import type { FastifyInstance } from 'fastify';

export async function registerEnv(app: FastifyInstance) {
  const env = defineApiEnv(process.env);
  app.decorate('env', env);
}

declare module 'fastify' {
  interface FastifyInstance {
    env: ApiEnv;
  }
}
