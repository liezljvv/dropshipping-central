import { db } from '@dropshipping-central/db';
import { supplierCatalogService, supplierConnectionService } from '@dropshipping-central/integrations';

export async function syncSupplierInventoryJob() {
  console.log('[worker] sync-supplier-inventory started');
  const connections = await supplierConnectionService.listConnections();

  for (const connection of connections.filter((item) => item.status === 'CONNECTED')) {
    const startedAt = new Date();

    try {
      const products = await supplierCatalogService.searchProducts({
        ...(connection.id ? { connectionId: connection.id } : {}),
        limit: 100,
        tags: [],
      });
      const inventory = await supplierCatalogService.getInventory(
        products.map((product) => product.id),
        connection.id,
      );

      await db.$transaction(async (tx) => {
        await tx.supplierSyncRun.create({
          data: {
            supplierIntegrationId: connection.id!,
            syncType: 'INVENTORY',
            state: 'SUCCEEDED',
            itemCount: inventory.length,
            startedAt,
            finishedAt: new Date(),
          },
        });

        await tx.supplierIntegration.update({
          where: { id: connection.id! },
          data: {
            lastInventorySyncAt: new Date(),
            configPayload: {
              ...connection.config,
              metadata: {
                ...connection.config.metadata,
                lastError: null,
              },
            },
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Inventory sync failed.';

      await db.$transaction(async (tx) => {
        await tx.supplierSyncRun.create({
          data: {
            supplierIntegrationId: connection.id!,
            syncType: 'INVENTORY',
            state: 'FAILED',
            itemCount: 0,
            errorMessage: message,
            startedAt,
            finishedAt: new Date(),
          },
        });

        await tx.supplierIntegration.update({
          where: { id: connection.id! },
          data: {
            configPayload: {
              ...connection.config,
              metadata: {
                ...connection.config.metadata,
                lastError: message,
              },
            },
          },
        });
      });
    }
  }
}
