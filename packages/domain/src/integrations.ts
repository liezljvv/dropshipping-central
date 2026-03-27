import { integrationStatuses } from '@dropshipping-central/config';
import { z } from 'zod';

export const integrationStatusEnum = z.enum(integrationStatuses);

export const integrationSchema = z.object({
  id: z.string().optional(),
  platform: z.string().min(1),
  name: z.string().min(1),
  status: integrationStatusEnum,
  metadata: z.record(z.string(), z.unknown()).default({}),
  lastHeartbeatAt: z.iso.datetime().nullable().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type Integration = z.infer<typeof integrationSchema>;
