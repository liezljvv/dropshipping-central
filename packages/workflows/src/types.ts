import { fulfillmentJobSchema, integrationSchema } from '@dropshipping-central/domain';
import { z } from 'zod';

export const integrationHealthEvaluationSchema = z.object({
  healthy: z.boolean(),
  recommendedStatus: integrationSchema.shape.status,
  checkedAt: z.iso.datetime(),
  summary: z.string(),
});

export const fulfillmentJobCreationOptionsSchema = z.object({
  integrationId: z.string().optional(),
  supplierIntegrationId: z.string().optional(),
  supplierReference: z.string().optional(),
});

export type IntegrationHealthEvaluation = z.infer<typeof integrationHealthEvaluationSchema>;
export type FulfillmentJobDraft = z.infer<typeof fulfillmentJobSchema>;
export type FulfillmentJobCreationOptions = z.infer<typeof fulfillmentJobCreationOptionsSchema>;
