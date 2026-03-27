import type { CommerceIntegrationConnector } from '../types.js';

export const shopifyConnector: CommerceIntegrationConnector = {
  platform: 'shopify',
  async connect() {
    return { connected: true };
  },
  async disconnect() {
    return { disconnected: true };
  },
  async healthCheck({ integration }) {
    return {
      healthy: integration.status === 'CONNECTED',
      status: integration.status,
      checkedAt: new Date().toISOString(),
      message: 'Shopify connector foundation stub.',
    };
  },
  async syncCatalog() {
    return {
      syncedAt: new Date().toISOString(),
      itemCount: 0,
    };
  },
  async syncOrders() {
    return {
      syncedAt: new Date().toISOString(),
      orders: [],
    };
  },
};
