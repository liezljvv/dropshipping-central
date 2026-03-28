import {
  supplierOrderResultSchema,
  type SupplierCapabilitySet,
  type SupplierConnector,
  type SupplierInventory,
  type SupplierOrderResult,
  type SupplierPrice,
  type SupplierProduct,
  type SupplierProductSearchInput,
} from '@dropshipping-central/domain';
import {
  createShopifyAdminClient,
  mapShopifyErrorToStatus,
  type ShopifyAdminClient,
} from './client.js';
import { loadShopifySupplierConfig } from './config.js';
import { isShopifySupplierError, ShopifyNotConfiguredError } from './errors.js';
import {
  mapShopifyInventoryLevels,
  mapShopifyOrderStatus,
  mapShopifyPricing,
  mapShopifyProduct,
  mapShopifySubmissionResult,
} from './mapper.js';

type FetchLike = typeof fetch;

type ShopifyProductNode = {
  id: string;
  title: string;
  descriptionHtml?: string | null;
  tags?: string[];
  updatedAt: string;
  featuredImage?: { url: string } | null;
  images?: { nodes?: Array<{ url: string }> };
  variants?: {
    nodes?: Array<{
      id: string;
      title: string;
      sku: string | null;
      price: string;
      compareAtPrice?: string | null;
      inventoryQuantity?: number | null;
      updatedAt?: string | null;
      inventoryItem?: { id: string } | null;
      selectedOptions?: Array<{ name: string; value: string }>;
    }>;
  };
};

const PRODUCT_FIELDS = `
  id
  title
  descriptionHtml
  tags
  updatedAt
  featuredImage { url }
  images(first: 10) { nodes { url } }
  variants(first: 100) {
    nodes {
      id
      title
      sku
      price
      compareAtPrice
      updatedAt
      inventoryQuantity
      inventoryItem { id }
      selectedOptions { name value }
    }
  }
`;

const shopifyCapabilities: SupplierCapabilitySet = {
  searchProducts: true,
  getProductById: true,
  getInventory: true,
  getPricing: true,
  submitOrder: true,
  getOrderStatus: true,
  cancelOrder: true,
};

function decodeShopifyId(value: string) {
  const parts = value.split('/');
  return parts[parts.length - 1] ?? value;
}

function buildSearchQuery(input: SupplierProductSearchInput) {
  const terms = [
    ...(input.query ? [input.query.trim()] : []),
    ...input.tags.map((tag) => `tag:${tag}`),
  ].filter(Boolean);

  return terms.length > 0 ? terms.join(' ') : undefined;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? 'Customer',
      lastName: 'Supplier',
    };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1] ?? 'Supplier',
  };
}

function buildOrderFailureResult(operation: string, error: unknown): SupplierOrderResult {
  if (error instanceof ShopifyNotConfiguredError) {
    return supplierOrderResultSchema.parse({
      supplierOrderId: `shopify-${operation}-not-configured`,
      accepted: false,
      status: 'NOT_CONFIGURED',
      retryable: false,
      message: error.message,
      rawResponse: {},
      processedAt: new Date().toISOString(),
    });
  }

  if (isShopifySupplierError(error)) {
    return supplierOrderResultSchema.parse({
      supplierOrderId: `shopify-${operation}-${Date.now()}`,
      accepted: false,
      status: mapShopifyErrorToStatus(error),
      retryable: error.retryable,
      message: error.message,
      rawResponse: {
        category: error.category,
        ...(error.statusCode ? { statusCode: error.statusCode } : {}),
      },
      processedAt: new Date().toISOString(),
    });
  }

  return supplierOrderResultSchema.parse({
    supplierOrderId: `shopify-${operation}-${Date.now()}`,
    accepted: false,
    status: 'ERROR',
    retryable: false,
    message: error instanceof Error ? error.message : 'Shopify supplier operation failed.',
    rawResponse: {},
    processedAt: new Date().toISOString(),
  });
}

function resolveClient(fetchImpl?: FetchLike): ShopifyAdminClient {
  const state = loadShopifySupplierConfig();

  if (!state.configured) {
    throw new ShopifyNotConfiguredError(
      state.diagnostics[0] ??
        `Shopify supplier is not configured. Missing: ${state.missingFields.join(', ')}`,
      { missingFields: state.missingFields },
    );
  }

  return createShopifyAdminClient({
    config: state.config,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

async function fetchProductsByIds(client: ShopifyAdminClient, productIds: string[]) {
  if (productIds.length === 0) {
    return [] as ShopifyProductNode[];
  }

  const data = await client.graphql<{
    nodes: Array<ShopifyProductNode | null>;
  }>(
    `query ProductsByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          ${PRODUCT_FIELDS}
        }
      }
    }`,
    { ids: productIds },
  );

  return data.nodes.filter((item): item is ShopifyProductNode => Boolean(item));
}

export function createShopifySupplierConnector(input?: {
  fetchImpl?: FetchLike;
}): SupplierConnector {
  return {
    provider: 'shopify',
    capabilities: shopifyCapabilities,
    async searchProducts(searchInput) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const data = await client.graphql<{
          products: {
            nodes: ShopifyProductNode[];
          };
        }>(
          `query SearchProducts($first: Int!, $query: String) {
            products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
              nodes {
                ${PRODUCT_FIELDS}
              }
            }
          }`,
          {
            first: searchInput.limit,
            query: buildSearchQuery(searchInput),
          },
        );

        return data.products.nodes.map(mapShopifyProduct);
      } catch (error) {
        if (error instanceof ShopifyNotConfiguredError) {
          return [];
        }

        throw error;
      }
    },
    async getProductById(productId) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const data = await client.graphql<{
          product: ShopifyProductNode | null;
        }>(
          `query ProductById($id: ID!) {
            product(id: $id) {
              ${PRODUCT_FIELDS}
            }
          }`,
          { id: productId },
        );

        return data.product ? mapShopifyProduct(data.product) : null;
      } catch (error) {
        if (error instanceof ShopifyNotConfiguredError) {
          return null;
        }

        throw error;
      }
    },
    async getInventory(productIds) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const products = await fetchProductsByIds(client, productIds);
        const inventoryItemIds = products.flatMap((product) =>
          (product.variants?.nodes ?? [])
            .map((variant) => decodeShopifyId(variant.inventoryItem?.id ?? ''))
            .filter(Boolean),
        );

        if (inventoryItemIds.length === 0) {
          return [];
        }

        const state = loadShopifySupplierConfig();
        const response = await client.get<{
          inventory_levels: Array<{
            inventory_item_id: number;
            available: number;
            updated_at?: string;
          }>;
        }>('/inventory_levels.json', {
          inventory_item_ids: inventoryItemIds.join(','),
          ...(state.config.locationId ? { location_ids: state.config.locationId } : {}),
        });

        return mapShopifyInventoryLevels({
          products,
          inventoryLevels: response.inventory_levels,
        });
      } catch (error) {
        if (error instanceof ShopifyNotConfiguredError) {
          return [];
        }

        throw error;
      }
    },
    async getPricing(productIds) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const products = await fetchProductsByIds(client, productIds);
        return products.flatMap(mapShopifyPricing);
      } catch (error) {
        if (error instanceof ShopifyNotConfiguredError) {
          return [];
        }

        throw error;
      }
    },
    async submitOrder(command) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const name = splitName(command.shippingAddress.fullName);
        const email =
          typeof command.metadata.customerEmail === 'string'
            ? command.metadata.customerEmail
            : `supplier+${command.externalOrderId}@example.invalid`;
        const draftOrder = await client.post<{
          draft_order: {
            id: number;
          };
        }>('/draft_orders.json', {
          draft_order: {
            line_items: command.lines.map((line) => ({
              variant_id: Number(decodeShopifyId(line.variantId)),
              quantity: line.quantity,
            })),
            email,
            note: command.notes ?? `Dropshipping Central supplier order ${command.externalOrderId}`,
            tags: 'dropshipping-central,supplier-order',
            shipping_address: {
              first_name: name.firstName,
              last_name: name.lastName,
              address1: command.shippingAddress.line1,
              ...(command.shippingAddress.line2 ? { address2: command.shippingAddress.line2 } : {}),
              city: command.shippingAddress.city,
              province_code: command.shippingAddress.region,
              zip: command.shippingAddress.postalCode,
              country_code: command.shippingAddress.countryCode,
              ...(command.shippingAddress.phone ? { phone: command.shippingAddress.phone } : {}),
            },
          },
        });
        const completed = await client.post<{
          draft_order?: { order_id?: number | null };
          order?: { id: number | string } | null;
        }>(`/draft_orders/${draftOrder.draft_order.id}/complete.json?payment_pending=true`);
        const supplierOrderId =
          completed.order?.id ??
          completed.draft_order?.order_id ??
          draftOrder.draft_order.id;

        return mapShopifySubmissionResult({
          supplierOrderId: String(supplierOrderId),
          status: 'SUBMITTED',
          rawResponse: {
            draftOrderId: draftOrder.draft_order.id,
          },
        });
      } catch (error) {
        return buildOrderFailureResult('submit-order', error);
      }
    },
    async getOrderStatus(orderId) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const response = await client.get<{
          order?: {
            id: number | string;
            name?: string | null;
            fulfillment_status?: string | null;
            cancelled_at?: string | null;
            closed_at?: string | null;
            updated_at?: string | null;
            created_at?: string | null;
          } | null;
        }>(`/orders/${decodeShopifyId(orderId)}.json`, {
          fields: 'id,name,fulfillment_status,cancelled_at,closed_at,updated_at,created_at',
          status: 'any',
        });

        return response.order ? mapShopifyOrderStatus(response.order) : null;
      } catch (error) {
        if (error instanceof ShopifyNotConfiguredError) {
          return buildOrderFailureResult('get-order-status', error);
        }

        return buildOrderFailureResult('get-order-status', error);
      }
    },
    async cancelOrder(orderId) {
      try {
        const client = resolveClient(input?.fetchImpl);
        const response = await client.post<{
          order: {
            id: number | string;
            name?: string | null;
            fulfillment_status?: string | null;
            cancelled_at?: string | null;
            closed_at?: string | null;
            updated_at?: string | null;
            created_at?: string | null;
          };
        }>(`/orders/${decodeShopifyId(orderId)}/cancel.json`, {});

        return mapShopifyOrderStatus(response.order);
      } catch (error) {
        return buildOrderFailureResult('cancel-order', error);
      }
    },
  };
}

export const shopifySupplierConnector = createShopifySupplierConnector();
