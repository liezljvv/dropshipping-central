import {
  supplierConnectionSchema,
  supplierOrderSubmissionSchema,
  supplierProductSearchInputSchema,
  type SupplierConnection,
  type SupplierConnectionTestResult,
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
import {
  enrichSupplierConnection,
  testSupplierConnection,
} from './connection-status.js';

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

  async listConnections() {
    const connections = await this.repository.listConnections();
    return connections.map(enrichSupplierConnection);
  }

  async getConnection(connectionId: string) {
    const connection = await this.repository.getConnectionById(connectionId);
    return connection ? enrichSupplierConnection(connection) : null;
  }

  async getDefaultConnection() {
    const connections = await this.listConnections();
    return connections.find((item) => item.status === 'CONNECTED') ?? null;
  }

  async upsertConnection(input: SupplierConnectionUpsertInput) {
    const connection = await this.repository.upsertConnection(input);
    return enrichSupplierConnection(connection);
  }

  async testConnection(connectionId: string): Promise<{
    connection: SupplierConnection;
    test: SupplierConnectionTestResult;
  }> {
    const connection = await this.repository.getConnectionById(connectionId);

    if (!connection) {
      throw new Error(`Supplier connection not found: ${connectionId}`);
    }

    const test = await testSupplierConnection(connection);
    const metadata = {
      ...connection.config.metadata,
      configured: test.missingFields.length === 0,
      missingFields: test.missingFields,
      diagnostics:
        test.status === 'CONNECTED'
          ? []
          : [test.message],
      lastError: test.status === 'CONNECTED' ? null : test.message,
      lastConnectionTest: test,
      credentialFields: {
        shopDomainEnvVar: 'SHOPIFY_SUPPLIER_SHOP_DOMAIN',
        accessTokenEnvVar: 'SHOPIFY_SUPPLIER_ACCESS_TOKEN',
        apiVersionEnvVar: 'SHOPIFY_SUPPLIER_API_VERSION',
      },
    };
    const updated = await this.repository.upsertConnection({
      ...(connection.id ? { id: connection.id } : {}),
      name: connection.name,
      provider: connection.provider,
      status: test.status,
      config: {
        ...connection.config,
        metadata,
      },
      capabilities: connection.capabilities,
    });

    return {
      connection: enrichSupplierConnection(updated),
      test,
    };
  }

  async resolveConnection(connectionId?: string): Promise<SupplierConnection> {
    const connection = connectionId
      ? await this.getConnection(connectionId)
      : await this.getDefaultConnection();

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
