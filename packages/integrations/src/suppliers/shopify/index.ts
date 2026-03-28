import {
  supplierOrderResultSchema,
  type SupplierCapabilitySet,
  type SupplierConnector,
} from '@dropshipping-central/domain';

const shopifyCapabilities: SupplierCapabilitySet = {
  searchProducts: true,
  getProductById: true,
  getInventory: true,
  getPricing: true,
  submitOrder: true,
  getOrderStatus: true,
  cancelOrder: false,
};

function unsupportedResult(operation: string) {
  return supplierOrderResultSchema.parse({
    supplierOrderId: `shopify-todo-${operation}`,
    accepted: false,
    status: 'NOT_IMPLEMENTED',
    retryable: false,
    message: `Shopify supplier connector TODO: ${operation}. Configure auth before enabling live calls.`,
    rawResponse: {
      todo: true,
      operation,
    },
    processedAt: new Date().toISOString(),
  });
}

export const shopifySupplierConnector: SupplierConnector = {
  provider: 'shopify',
  capabilities: shopifyCapabilities,
  async searchProducts() {
    return [];
  },
  async getProductById() {
    return null;
  },
  async getInventory() {
    return [];
  },
  async getPricing() {
    return [];
  },
  async submitOrder() {
    return unsupportedResult('submitOrder');
  },
  async getOrderStatus() {
    return null;
  },
};
