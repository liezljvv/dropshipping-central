import type { CommerceIntegrationConnector } from '../types.js';

export const woocommerceConnector: CommerceIntegrationConnector = {
  platform: 'woocommerce',
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
      message: 'WooCommerce connector foundation stub.',
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
