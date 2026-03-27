import type { Integration, Order } from '@dropshipping-central/domain';

export type ConnectorHealth = {
  healthy: boolean;
  status: Integration['status'];
  checkedAt: string;
  message?: string;
};

export interface CommerceIntegrationConnector {
  readonly platform: string;
  connect(input: { integration: Integration }): Promise<{ connected: true }>;
  disconnect(input: { integrationId: string }): Promise<{ disconnected: true }>;
  healthCheck(input: { integration: Integration }): Promise<ConnectorHealth>;
  syncCatalog(input: { integration: Integration }): Promise<{ syncedAt: string; itemCount: number }>;
  syncOrders(input: { integration: Integration }): Promise<{ syncedAt: string; orders: Order[] }>;
}
