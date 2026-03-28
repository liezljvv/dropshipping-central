import { db } from '@dropshipping-central/db';
import { supplierCatalogService, supplierConnectionService } from '@dropshipping-central/integrations';

export async function syncSupplierPricingJob() {
  console.log('[worker] sync-supplier-pricing started');
  const connections = await supplierConnectionService.listConnections();

  for (const connection of connections.filter((item) => item.status === 'CONNECTED')) {
    const products = await supplierCatalogService.searchProducts({
      ...(connection.id ? { connectionId: connection.id } : {}),
      limit: 100,
      tags: [],
    });
    const pricing = await supplierCatalogService.getPricing(
      products.map((product) => product.id),
      connection.id,
    );

    await db.$transaction(async (tx) => {
      await tx.supplierSyncRun.create({
        data: {
          supplierIntegrationId: connection.id!,
          syncType: 'PRICING',
          state: 'SUCCEEDED',
          itemCount: pricing.length,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });

      await tx.supplierIntegration.update({
        where: { id: connection.id! },
        data: {
          lastPricingSyncAt: new Date(),
        },
      });
    });
  }
}
