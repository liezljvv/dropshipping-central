import { workflowRunStates } from '@dropshipping-central/config';
import { z } from 'zod';

export const workflowRunStateEnum = z.enum(workflowRunStates);

export const workflowRunSchema = z.object({
  id: z.string().optional(),
  integrationId: z.string().nullable().optional(),
  workflowType: z.string().min(1),
  state: workflowRunStateEnum,
  startedAt: z.iso.datetime().nullable().optional(),
  finishedAt: z.iso.datetime().nullable().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
});

export type WorkflowRun = z.infer<typeof workflowRunSchema>;
