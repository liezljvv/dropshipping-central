import {
  supplierOrderResultSchema,
  type SupplierCapabilitySet,
  type SupplierConnector,
  type SupplierOrderSubmission,
  type SupplierProductSearchInput,
} from '@dropshipping-central/domain';
import { mockSupplierInventory, mockSupplierPricing, mockSupplierProducts } from './data.js';

const mockCapabilities: SupplierCapabilitySet = {
  searchProducts: true,
  getProductById: true,
  getInventory: true,
  getPricing: true,
  submitOrder: true,
  getOrderStatus: true,
  cancelOrder: true,
};

const mockOrderStore = new Map<string, ReturnType<typeof supplierOrderResultSchema.parse>>();

function shouldIncludeProduct(productTitle: string, tags: string[], input: SupplierProductSearchInput) {
  const normalizedQuery = input.query?.trim().toLowerCase();
  const queryMatch = normalizedQuery
    ? productTitle.toLowerCase().includes(normalizedQuery)
    : true;
  const tagMatch =
    input.tags.length === 0 || input.tags.every((tag) => tags.map((item) => item.toLowerCase()).includes(tag.toLowerCase()));

  return queryMatch && tagMatch;
}

function buildMockOrderResult(command: SupplierOrderSubmission) {
  const simulateFailure = String(command.metadata.simulateFailure ?? '');
  const processedAt = new Date().toISOString();

  if (simulateFailure === 'permanent') {
    return supplierOrderResultSchema.parse({
      supplierOrderId: `mock-rejected-${command.externalOrderId}`,
      accepted: false,
      status: 'FAILED',
      retryable: false,
      message: 'Permanent mock supplier failure.',
      rawResponse: {
        code: 'MOCK_PERMANENT_FAILURE',
      },
      processedAt,
    });
  }

  if (simulateFailure === 'always' || simulateFailure === 'once') {
    const previousAttempts = Number(command.metadata.previousAttempts ?? 0);
    const failThisAttempt = simulateFailure === 'always' || previousAttempts === 0;

    if (failThisAttempt) {
      return supplierOrderResultSchema.parse({
        supplierOrderId: `mock-retry-${command.externalOrderId}`,
        accepted: false,
        status: 'RETRY_PENDING',
        retryable: true,
        message: `Transient mock supplier failure on attempt ${previousAttempts + 1}.`,
        rawResponse: {
          code: 'MOCK_TRANSIENT_FAILURE',
        },
        processedAt,
      });
    }
  }

  return supplierOrderResultSchema.parse({
    supplierOrderId: `mock-order-${command.externalOrderId}`,
    accepted: true,
    status: 'SUBMITTED',
    retryable: false,
    message: null,
    rawResponse: {
      lineCount: command.lines.length,
    },
    processedAt,
  });
}

export const mockSupplierConnector: SupplierConnector = {
  provider: 'mock',
  capabilities: mockCapabilities,
  async searchProducts(input) {
    return mockSupplierProducts
      .filter((product) => shouldIncludeProduct(product.title, product.tags, input))
      .slice(0, input.limit);
  },
  async getProductById(productId) {
    return mockSupplierProducts.find((product) => product.id === productId) ?? null;
  },
  async getInventory(productIds) {
    return mockSupplierInventory.filter((item) => productIds.includes(item.productId));
  },
  async getPricing(productIds) {
    return mockSupplierPricing.filter((item) => productIds.includes(item.productId));
  },
  async submitOrder(command) {
    const result = buildMockOrderResult(command);
    mockOrderStore.set(result.supplierOrderId, result);
    return result;
  },
  async getOrderStatus(orderId) {
    return mockOrderStore.get(orderId) ?? null;
  },
  async cancelOrder(orderId) {
    const cancelled = supplierOrderResultSchema.parse({
      supplierOrderId: orderId,
      accepted: true,
      status: 'CANCELLED',
      retryable: false,
      message: null,
      rawResponse: {},
      processedAt: new Date().toISOString(),
    });

    mockOrderStore.set(orderId, cancelled);
    return cancelled;
  },
};
