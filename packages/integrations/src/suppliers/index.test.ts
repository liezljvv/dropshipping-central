import type {
  SupplierCapabilitySet,
  SupplierConnection,
  SupplierConnectionConfig,
  SupplierConnector,
} from '@dropshipping-central/domain';
import { describe, expect, it, vi } from 'vitest';
import { mockSupplierConnector } from './mock/index.js';
import { decideSupplierAttemptResult } from './order-attempt.js';
import { buildSupplierConnectionReadiness } from './connection-status.js';
import {
  type SupplierConnectionRepository,
  type SupplierConnectionUpsertInput,
} from './connection-repository.js';
import {
  StaticSupplierConnectorRegistry,
  SupplierCatalogService,
  SupplierConnectionService,
  SupplierOrderService,
} from './services.js';
import {
  buildShopifyConnectionReadiness,
  loadShopifySupplierConfig,
  testShopifySupplierConnection,
} from './shopify/config.js';
import { shopifySupplierConnector } from './shopify/index.js';

const capabilities: SupplierCapabilitySet = {
  searchProducts: true,
  getProductById: true,
  getInventory: true,
  getPricing: true,
  submitOrder: true,
  getOrderStatus: true,
  cancelOrder: false,
};

const config: SupplierConnectionConfig = {
  provider: 'mock',
  metadata: {},
};

function makeConnection(overrides: Partial<SupplierConnection> = {}): SupplierConnection {
  return {
    id: 'sup_mock',
    name: 'Mock Supplier',
    provider: 'mock',
    status: 'CONNECTED',
    config,
    capabilities,
    createdAt: '2026-03-28T00:00:00.000Z',
    updatedAt: '2026-03-28T00:00:00.000Z',
    ...overrides,
  };
}

class InMemoryConnectionRepository implements SupplierConnectionRepository {
  constructor(private readonly connections: SupplierConnection[]) {}

  async listConnections() {
    return this.connections;
  }

  async getConnectionById(id: string) {
    return this.connections.find((item) => item.id === id) ?? null;
  }

  async getDefaultConnection() {
    return this.connections[0] ?? null;
  }

  async upsertConnection(input: SupplierConnectionUpsertInput) {
    const item = makeConnection({ ...input, id: input.id ?? 'created_mock' });
    const index = this.connections.findIndex((connection) => connection.id === item.id);

    if (index >= 0) {
      this.connections[index] = item;
    } else {
      this.connections.push(item);
    }

    return item;
  }
}

describe('SupplierConnector contract', () => {
  it('exposes the required connector methods', () => {
    const connector: SupplierConnector = mockSupplierConnector;

    expect(typeof connector.searchProducts).toBe('function');
    expect(typeof connector.getProductById).toBe('function');
    expect(typeof connector.getInventory).toBe('function');
    expect(typeof connector.getPricing).toBe('function');
    expect(typeof connector.submitOrder).toBe('function');
    expect(typeof connector.getOrderStatus).toBe('function');
  });
});

describe('mockSupplierConnector', () => {
  it('returns seeded catalog data', async () => {
    const items = await mockSupplierConnector.searchProducts({
      query: 'Aurora',
      tags: [],
      limit: 10,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.variants).toHaveLength(2);
  });

  it('simulates transient order failures and recovery', async () => {
    const transientFailure = await mockSupplierConnector.submitOrder({
      externalOrderId: 'ord_100',
      shippingAddress: {
        fullName: 'Alex Doe',
        line1: 'Main Street 1',
        city: 'Berlin',
        region: 'BE',
        postalCode: '10115',
        countryCode: 'DE',
      },
      lines: [
        {
          variantId: 'mock-var-aurora-black',
          sku: 'AUR-LAMP-BLK',
          quantity: 1,
          unitPrice: 18.75,
          currency: 'USD',
        },
      ],
      metadata: {
        simulateFailure: 'once',
        previousAttempts: 0,
      },
    });

    const success = await mockSupplierConnector.submitOrder({
      externalOrderId: 'ord_100',
      shippingAddress: {
        fullName: 'Alex Doe',
        line1: 'Main Street 1',
        city: 'Berlin',
        region: 'BE',
        postalCode: '10115',
        countryCode: 'DE',
      },
      lines: [
        {
          variantId: 'mock-var-aurora-black',
          sku: 'AUR-LAMP-BLK',
          quantity: 1,
          unitPrice: 18.75,
          currency: 'USD',
        },
      ],
      metadata: {
        simulateFailure: 'once',
        previousAttempts: 1,
      },
    });

    expect(transientFailure.accepted).toBe(false);
    expect(transientFailure.retryable).toBe(true);
    expect(success.accepted).toBe(true);
  });
});

describe('supplier services', () => {
  it('keeps the mock supplier as the default when Shopify is not configured', async () => {
    const connectionService = new SupplierConnectionService(
      new InMemoryConnectionRepository([
        makeConnection({
          id: 'sup_shop',
          name: 'Shopify Supplier',
          provider: 'shopify',
          status: 'CONNECTED',
          config: {
            provider: 'shopify',
            metadata: {},
          },
        }),
        makeConnection(),
      ]),
      new StaticSupplierConnectorRegistry({
        mock: mockSupplierConnector,
        shopify: shopifySupplierConnector,
      }),
    );

    const defaultConnection = await connectionService.getDefaultConnection();

    expect(defaultConnection?.id).toBe('sup_mock');
  });

  it('routes catalog reads to the resolved connector', async () => {
    const searchProducts = vi.fn().mockResolvedValue([]);
    const connector: SupplierConnector = {
      provider: 'mock',
      capabilities,
      searchProducts,
      getProductById: vi.fn().mockResolvedValue(null),
      getInventory: vi.fn().mockResolvedValue([]),
      getPricing: vi.fn().mockResolvedValue([]),
      submitOrder: vi.fn().mockResolvedValue({
        supplierOrderId: 'sup_1',
        accepted: true,
        status: 'SUBMITTED',
        retryable: false,
        message: null,
        rawResponse: {},
        processedAt: '2026-03-28T00:00:00.000Z',
      }),
      getOrderStatus: vi.fn().mockResolvedValue(null),
    };
    const connectionService = new SupplierConnectionService(
      new InMemoryConnectionRepository([makeConnection()]),
      new StaticSupplierConnectorRegistry({ mock: connector }),
    );
    const catalogService = new SupplierCatalogService(connectionService);

    await catalogService.searchProducts({
      query: 'Aurora',
      tags: [],
      limit: 5,
    });

    expect(searchProducts).toHaveBeenCalledTimes(1);
  });

  it('routes order submission through the resolved connector', async () => {
    const submitOrder = vi.fn().mockResolvedValue({
      supplierOrderId: 'sup_2',
      accepted: true,
      status: 'SUBMITTED',
      retryable: false,
      message: null,
      rawResponse: {},
      processedAt: '2026-03-28T00:00:00.000Z',
    });
    const connector: SupplierConnector = {
      provider: 'mock',
      capabilities,
      searchProducts: vi.fn().mockResolvedValue([]),
      getProductById: vi.fn().mockResolvedValue(null),
      getInventory: vi.fn().mockResolvedValue([]),
      getPricing: vi.fn().mockResolvedValue([]),
      submitOrder,
      getOrderStatus: vi.fn().mockResolvedValue(null),
    };
    const connectionService = new SupplierConnectionService(
      new InMemoryConnectionRepository([makeConnection()]),
      new StaticSupplierConnectorRegistry({ mock: connector }),
    );
    const orderService = new SupplierOrderService(connectionService);

    await orderService.submitOrder({
      externalOrderId: 'ord_200',
      shippingAddress: {
        fullName: 'Alex Doe',
        line1: 'Main Street 1',
        city: 'Berlin',
        region: 'BE',
        postalCode: '10115',
        countryCode: 'DE',
      },
      lines: [
        {
          variantId: 'mock-var-aurora-black',
          sku: 'AUR-LAMP-BLK',
          quantity: 1,
          unitPrice: 18.75,
          currency: 'USD',
        },
      ],
      metadata: {},
    });

    expect(submitOrder).toHaveBeenCalledTimes(1);
    expect(submitOrder.mock.calls[0]?.[0].supplierIntegrationId).toBe('sup_mock');
  });

  it('does not throw when Shopify is selected but not configured', async () => {
    const connectionService = new SupplierConnectionService(
      new InMemoryConnectionRepository([
        makeConnection({
          id: 'sup_shop',
          name: 'Shopify Supplier',
          provider: 'shopify',
          status: 'CONNECTED',
          config: {
            provider: 'shopify',
            metadata: {},
          },
        }),
      ]),
      new StaticSupplierConnectorRegistry({
        mock: mockSupplierConnector,
        shopify: shopifySupplierConnector,
      }),
    );
    const catalogService = new SupplierCatalogService(connectionService);

    const items = await catalogService.searchProducts({
      connectionId: 'sup_shop',
      limit: 5,
      tags: [],
    });

    expect(items).toEqual([]);
  });
});

describe('retry handling', () => {
  it('keeps retryable failures pending until retry budget is exhausted', () => {
    const pending = decideSupplierAttemptResult({
      result: {
        supplierOrderId: 'sup_retry',
        accepted: false,
        status: 'RETRY_PENDING',
        retryable: true,
        message: 'temporary',
        rawResponse: {},
        processedAt: '2026-03-28T00:00:00.000Z',
      },
      attemptCount: 1,
      maxRetries: 3,
    });
    const failed = decideSupplierAttemptResult({
      result: {
        supplierOrderId: 'sup_retry',
        accepted: false,
        status: 'RETRY_PENDING',
        retryable: true,
        message: 'temporary',
        rawResponse: {},
        processedAt: '2026-03-28T00:00:00.000Z',
      },
      attemptCount: 3,
      maxRetries: 3,
    });

    expect(pending.nextState).toBe('PENDING');
    expect(failed.nextState).toBe('FAILED');
    expect(failed.retryable).toBe(true);
  });
});

describe('Shopify supplier readiness', () => {
  it('reports missing credentials as not configured', () => {
    const state = loadShopifySupplierConfig({
      env: {},
    });

    expect(state.configured).toBe(false);
    expect(state.status).toBe('NOT_CONFIGURED');
    expect(state.missingFields).toEqual([
      'SHOPIFY_SUPPLIER_SHOP_DOMAIN',
      'SHOPIFY_SUPPLIER_ACCESS_TOKEN',
    ]);
  });

  it('reports invalid config as an error', () => {
    const state = loadShopifySupplierConfig({
      env: {
        SHOPIFY_SUPPLIER_SHOP_DOMAIN: 'https://bad host/path',
        SHOPIFY_SUPPLIER_ACCESS_TOKEN: 'token',
        SHOPIFY_SUPPLIER_API_VERSION: 'latest',
      },
    });

    expect(state.configured).toBe(false);
    expect(state.status).toBe('ERROR');
    expect(state.diagnostics).toHaveLength(2);
  });

  it('maps Shopify readiness onto supplier connections', () => {
    const readiness = buildShopifyConnectionReadiness(
      makeConnection({
        provider: 'shopify',
        status: 'PENDING',
        config: {
          provider: 'shopify',
          metadata: {},
        },
      }),
    );

    expect(readiness.configured).toBe(false);
    expect(readiness.status).toBe('NOT_CONFIGURED');
    expect(readiness.nextStep).toContain('SHOPIFY_SUPPLIER_SHOP_DOMAIN');
  });

  it('returns auth failure when Shopify rejects the token', async () => {
    const result = await testShopifySupplierConnection({
      env: {
        SHOPIFY_SUPPLIER_SHOP_DOMAIN: 'supplier-shop.myshopify.com',
        SHOPIFY_SUPPLIER_ACCESS_TOKEN: 'bad-token',
        SHOPIFY_SUPPLIER_API_VERSION: '2025-10',
      },
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('AUTH_FAILED');
  });

  it('enriches supplier connections with readiness details', () => {
    const connection = makeConnection({
      id: 'sup_shop',
      provider: 'shopify',
      status: 'CONNECTED',
      config: {
        provider: 'shopify',
        metadata: {},
      },
    });

    const readiness = buildSupplierConnectionReadiness(connection);

    expect(readiness.configured).toBe(false);
    expect(readiness.missingFields).toContain('SHOPIFY_SUPPLIER_ACCESS_TOKEN');
  });
});
