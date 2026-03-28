import {
  profitabilityAlertEntityTypeEnum,
  profitabilityAlertSeverityEnum,
  profitabilityAlertStatusEnum,
} from '@dropshipping-central/domain';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { listProfitabilityAlerts } from '@dropshipping-central/workflows';

const profitabilityAlertQuerySchema = z.object({
  entityType: profitabilityAlertEntityTypeEnum.optional(),
  severity: profitabilityAlertSeverityEnum.optional(),
  status: profitabilityAlertStatusEnum.optional(),
});

export const profitabilityAlertRoutes: FastifyPluginAsync = async (app) => {
  app.get('/profitability-alerts', async (request) => {
    const query = profitabilityAlertQuerySchema.parse(request.query);

    return {
      items: await listProfitabilityAlerts({
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.status ? { status: query.status } : {}),
      }),
      filters: {
        ...query,
        status: query.status ?? 'ACTIVE',
      },
    };
  });
};
