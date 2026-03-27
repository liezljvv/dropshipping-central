import { actorTypes } from '@dropshipping-central/config';
import { z } from 'zod';

export const actorTypeEnum = z.enum(actorTypes);

export const automationPolicySchema = z.object({
  id: z.string().optional(),
  integrationId: z.string().nullable().optional(),
  key: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type AutomationPolicy = z.infer<typeof automationPolicySchema>;
