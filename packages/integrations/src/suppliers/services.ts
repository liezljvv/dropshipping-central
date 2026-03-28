import {
  supplierConnectionSchema,
  supplierOrderSubmissionSchema,
  supplierProductSearchInputSchema,
  type SupplierConnection,
  type SupplierConnector,
  type SupplierInventory,
  type SupplierOrderResult,
  type SupplierOrderSubmission,
  type SupplierPrice,
  type SupplierProduct,
  type SupplierProductSearchInput,
} from '@dropshipping-central/domain';
import type {
  SupplierConnectionRepository,
  SupplierConnectionUpsertInput,
} from './connection-repository.js';

export type SupplierConnectorRegistry = {
  getConnector(provider: string): SupplierConnector;
};

export class StaticSupplierConnectorRegistry implements SupplierConnectorRegistry {
  constructor(private readonly connectors: Record<string, SupplierConnector>) {}

  getConnector(provider: string) {
    const connector = this.connectors[provider];

    if (!connector) {
      throw new Error(`Unsupported supplier provider: ${provider}`);
    }

    return connector;
  }
}

export class SupplierConnectionService {
  constructor(
    private readonly repository: SupplierConnectionRepository,
    private readonly registry: SupplierConnectorRegistry,
  ) {}

  listConnections() {
    return this.repository.listConnections();
  }

  getConnection(connectionId: string) {
    return this.repository.getConnectionById(connectionId);
  }

  async getDefaultConnection() {
    return this.repository.getDefaultConnection();
  }

  async upsertConnection(input: SupplierConnectionUpsertInput) {
    return this.repository.upsertConnection(input);
  }

  async resolveConnection(connectionId?: string): Promise<SupplierConnection> {
    const connection = connectionId
      ? await this.repository.getConnectionById(connectionId)
      : await this.repository.getDefaultConnection();

    if (!connection) {
      throw new Error(
        connectionId
          ? `Supplier connection not found: ${connectionId}`
          : 'No active supplier connection is configured.',
      );
    }

    return supplierConnectionSchema.parse(connection);
  }

  async resolveConnector(connectionId?: string) {
    const connection = await this.resolveConnection(connectionId);

    return {
      connection,
      connector: this.registry.getConnector(connection.provider),
    };
  }
}

export class SupplierCatalogService {
  constructor(private readonly connections: SupplierConnectionService) {}

  async searchProducts(input: SupplierProductSearchInput & { connectionId?: string }) {
    const { connector } = await this.connections.resolveConnector(input.connectionId);
    return connector.searchProducts(supplierProductSearchInputSchema.parse(input));
  }

  async getProductById(productId: string, connectionId?: string): Promise<SupplierProduct | null> {
    const { connector } = await this.connections.resolveConnector(connectionId);
    return connector.getProductById(productId);
  }

  async getInventory(productIds: string[], connectionId?: string): Promise<SupplierInventory[]> {
    const { connector } = await this.connections.resolveConnector(connectionId);
    return connector.getInventory(productIds);
  }

  async getPricing(productIds: string[], connectionId?: string): Promise<SupplierPrice[]> {
    const { connector } = await this.connections.resolveConnector(connectionId);
    return connector.getPricing(productIds);
  }
}

export class SupplierOrderService {
  constructor(private readonly connections: SupplierConnectionService) {}

  async submitOrder(input: SupplierOrderSubmission & { connectionId?: string }): Promise<SupplierOrderResult> {
    const { connection, connector } = await this.connections.resolveConnector(input.connectionId);
    const command = supplierOrderSubmissionSchema.parse({
      ...input,
      supplierIntegrationId: input.supplierIntegrationId ?? connection.id,
    });

    return connector.submitOrder(command);
  }

  async getOrderStatus(orderId: string, connectionId?: string) {
    const { connector } = await this.connections.resolveConnector(connectionId);
    return connector.getOrderStatus(orderId);
  }

  async cancelOrder(orderId: string, connectionId?: string) {
    const { connector } = await this.connections.resolveConnector(connectionId);

    if (!connector.cancelOrder) {
      throw new Error(`Supplier provider ${connector.provider} does not support order cancellation.`);
    }

    return connector.cancelOrder(orderId);
  }
}
