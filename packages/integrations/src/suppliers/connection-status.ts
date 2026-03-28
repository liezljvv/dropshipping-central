import {
  supplierConnectionSchema,
  supplierConnectionTestResultSchema,
  type SupplierConnection,
  type SupplierConnectionReadiness,
  type SupplierConnectionTestResult,
} from '@dropshipping-central/domain';
import { buildShopifyConnectionReadiness, testShopifySupplierConnection } from './shopify/config.js';

function readPersistedTest(connection: SupplierConnection) {
  return supplierConnectionTestResultSchema.safeParse(connection.config.metadata.lastConnectionTest);
}

export function buildSupplierConnectionReadiness(connection: SupplierConnection): SupplierConnectionReadiness {
  if (connection.provider === 'shopify') {
    return buildShopifyConnectionReadiness(connection);
  }

  const persistedTest = readPersistedTest(connection);

  return {
    configured: true,
    status: connection.status,
    missingFields: [],
    diagnostics: [],
    nextStep: null,
    test: persistedTest.success ? persistedTest.data : null,
  };
}

export function enrichSupplierConnection(connection: SupplierConnection): SupplierConnection {
  const readiness = buildSupplierConnectionReadiness(connection);

  return supplierConnectionSchema.parse({
    ...connection,
    status: readiness.status,
    readiness,
  });
}

export async function testSupplierConnection(connection: SupplierConnection): Promise<SupplierConnectionTestResult> {
  if (connection.provider === 'shopify') {
    return testShopifySupplierConnection({
      connectionConfig: connection.config,
    });
  }

  return supplierConnectionTestResultSchema.parse({
    checkedAt: new Date().toISOString(),
    ok: true,
    status: 'CONNECTED',
    message: 'Mock supplier is ready and does not require external credentials.',
    missingFields: [],
  });
}
