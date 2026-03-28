import { db, type Prisma } from '@dropshipping-central/db';
import { supplierCatalogService, supplierConnectionService } from '@dropshipping-central/integrations';

async function markSyncRun(
  tx: Prisma.TransactionClient,
  input: {
    connectionId: string;
    syncType: string;
    state: 'SUCCEEDED' | 'FAILED';
    itemCount?: number;
    errorMessage?: string | null;
    startedAt?: Date;
    finishedAt?: Date;
  },
) {
  return tx.supplierSyncRun.create({
    data: {
      supplierIntegrationId: input.connectionId,
      syncType: input.syncType,
      state: input.state,
      itemCount: input.itemCount ?? 0,
      errorMessage: input.errorMessage ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
    },
  });
}

export async function syncSupplierCatalogJob() {
  console.log('[worker] sync-supplier-catalog started');
  const connections = await supplierConnectionService.listConnections();

  for (const connection of connections.filter((item) => item.status === 'CONNECTED')) {
    const startedAt = new Date();

    try {
      const products = await supplierCatalogService.searchProducts({
        ...(connection.id ? { connectionId: connection.id } : {}),
        limit: 100,
        tags: [],
      });

      await db.$transaction(async (tx) => {
        await markSyncRun(tx, {
          connectionId: connection.id!,
          syncType: 'CATALOG',
          state: 'SUCCEEDED',
          itemCount: products.length,
          startedAt,
          finishedAt: new Date(),
        });

        await tx.supplierIntegration.update({
          where: { id: connection.id! },
          data: {
            lastCatalogSyncAt: new Date(),
          },
        });
      });
    } catch (error) {
      await db.$transaction(async (tx) => {
        await markSyncRun(tx, {
          connectionId: connection.id!,
          syncType: 'CATALOG',
          state: 'FAILED',
          startedAt,
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Catalog sync failed.',
        });
      });
    }
  }
}
