import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
export const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');

export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
});

export const apiEnvSchema = sharedEnvSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(3000),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function defineApiEnv(input: Record<string, string | undefined>) {
  return apiEnvSchema.parse(input);
}

export const APP_NAME = 'Dropshipping Central';
export const API_PREFIX = '/api/v1';

export const integrationStatuses = ['PENDING', 'CONNECTED', 'DEGRADED', 'DISCONNECTED'] as const;
export const orderStatuses = ['PENDING', 'PAID', 'CANCELLED', 'RETURNED', 'FULFILLED'] as const;
export const fulfillmentJobStates = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'] as const;
export const workflowRunStates = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;
export const actorTypes = ['SYSTEM', 'USER', 'WORKER'] as const;
