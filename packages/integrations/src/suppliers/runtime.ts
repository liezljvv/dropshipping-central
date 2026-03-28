import { mockSupplierConnector } from './mock/index.js';
import { PrismaSupplierConnectionRepository } from './connection-repository.js';
import {
  StaticSupplierConnectorRegistry,
  SupplierCatalogService,
  SupplierConnectionService,
  SupplierOrderService,
} from './services.js';
import { shopifySupplierConnector } from './shopify/index.js';

const supplierConnectionRepository = new PrismaSupplierConnectionRepository();
const supplierConnectorRegistry = new StaticSupplierConnectorRegistry({
  mock: mockSupplierConnector,
  shopify: shopifySupplierConnector,
});

export const supplierConnectionService = new SupplierConnectionService(
  supplierConnectionRepository,
  supplierConnectorRegistry,
);

export const supplierCatalogService = new SupplierCatalogService(supplierConnectionService);
export const supplierOrderService = new SupplierOrderService(supplierConnectionService);
