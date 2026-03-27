import { integrationSchema, type Integration } from '@dropshipping-central/domain';
import { integrationHealthEvaluationSchema } from './types.js';

export function normalizeIntegrationHealthInput(input: Integration) {
  return integrationSchema.parse(input);
}

export function evaluateIntegrationHealth(input: Integration) {
  const integration = normalizeIntegrationHealthInput(input);
  const checkedAt = new Date().toISOString();
  const healthy =
    integration.status === 'CONNECTED' &&
    (integration.lastHeartbeatAt ? Date.now() - Date.parse(integration.lastHeartbeatAt) < 15 * 60 * 1000 : true);

  const recommendedStatus = healthy ? 'CONNECTED' : 'DEGRADED';
  const summary = healthy
    ? `${integration.name} is responding normally.`
    : `${integration.name} needs operator attention or automated recovery.`;

  return integrationHealthEvaluationSchema.parse({
    healthy,
    recommendedStatus,
    checkedAt,
    summary,
  });
}
