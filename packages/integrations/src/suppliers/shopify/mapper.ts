import {
  supplierInventorySchema,
  supplierPriceSchema,
  supplierProductSchema,
  supplierOrderResultSchema,
  type SupplierInventory,
  type SupplierOrderResult,
  type SupplierPrice,
  type SupplierProduct,
} from '@dropshipping-central/domain';

type ShopifySelectedOption = {
  name: string;
  value: string;
};

type ShopifyVariantNode = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice?: string | null;
  inventoryQuantity?: number | null;
  updatedAt?: string | null;
  inventoryItem?: {
    id: string;
  } | null;
  selectedOptions?: ShopifySelectedOption[];
};

type ShopifyProductNode = {
  id: string;
  title: string;
  descriptionHtml?: string | null;
  tags?: string[];
  updatedAt: string;
  featuredImage?: {
    url: string;
  } | null;
  images?: {
    nodes?: Array<{
      url: string;
    }>;
  };
  variants?: {
    nodes?: ShopifyVariantNode[];
  };
};

type ShopifyInventoryLevel = {
  inventory_item_id: number;
  available: number;
  updated_at?: string;
};

type ShopifyOrderPayload = {
  id: number | string;
  name?: string | null;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  status?: string | null;
};

function decodeShopifyId(value: string) {
  const parts = value.split('/');
  return parts[parts.length - 1] ?? value;
}

export function mapShopifyProduct(product: ShopifyProductNode): SupplierProduct {
  const imageUrls = [
    ...(product.featuredImage?.url ? [product.featuredImage.url] : []),
    ...((product.images?.nodes ?? []).map((image) => image.url)),
  ].filter((value, index, items) => items.indexOf(value) === index);

  return supplierProductSchema.parse({
    id: product.id,
    externalId: decodeShopifyId(product.id),
    supplierName: 'Shopify Supplier',
    title: product.title,
    description: product.descriptionHtml ?? '',
    tags: product.tags ?? [],
    imageUrls,
    updatedAt: product.updatedAt,
    variants: (product.variants?.nodes ?? []).map((variant) => ({
      id: variant.id,
      productId: product.id,
      sku: variant.sku ?? decodeShopifyId(variant.id),
      title: variant.title,
      optionValues: Object.fromEntries(
        (variant.selectedOptions ?? []).map((item) => [item.name, item.value]),
      ),
    })),
  });
}

export function mapShopifyPricing(product: ShopifyProductNode): SupplierPrice[] {
  return (product.variants?.nodes ?? []).map((variant) =>
    supplierPriceSchema.parse({
      productId: product.id,
      variantId: variant.id,
      currency: 'USD',
      amount: Number(variant.price),
      compareAtAmount: variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
      updatedAt: variant.updatedAt ?? product.updatedAt,
    }),
  );
}

export function mapShopifyInventoryLevels(input: {
  products: ShopifyProductNode[];
  inventoryLevels: ShopifyInventoryLevel[];
}): SupplierInventory[] {
  const levelsByInventoryItemId = new Map<number, ShopifyInventoryLevel[]>();

  for (const level of input.inventoryLevels) {
    const key = Number(level.inventory_item_id);
    const current = levelsByInventoryItemId.get(key) ?? [];
    current.push(level);
    levelsByInventoryItemId.set(key, current);
  }

  return input.products.flatMap((product) =>
    (product.variants?.nodes ?? []).map((variant) => {
      const inventoryItemId = Number(decodeShopifyId(variant.inventoryItem?.id ?? '0'));
      const levels = levelsByInventoryItemId.get(inventoryItemId) ?? [];
      const available = levels.reduce((sum, level) => sum + Number(level.available ?? 0), 0);
      const updatedAt =
        levels[0]?.updated_at ?? variant.updatedAt ?? product.updatedAt ?? new Date().toISOString();

      return supplierInventorySchema.parse({
        productId: product.id,
        variantId: variant.id,
        available,
        reserved: 0,
        updatedAt,
      });
    }),
  );
}

export function mapShopifyOrderStatus(order: ShopifyOrderPayload): SupplierOrderResult {
  const status = order.cancelled_at
    ? 'CANCELLED'
    : order.fulfillment_status === 'fulfilled'
      ? 'FULFILLED'
      : 'OPEN';

  return supplierOrderResultSchema.parse({
    supplierOrderId: String(order.id),
    accepted: true,
    status,
    retryable: false,
    message: null,
    rawResponse: {
      name: order.name ?? null,
      fulfillmentStatus: order.fulfillment_status ?? null,
      cancelledAt: order.cancelled_at ?? null,
      closedAt: order.closed_at ?? null,
    },
    processedAt: order.updated_at ?? order.created_at ?? new Date().toISOString(),
  });
}

export function mapShopifySubmissionResult(input: {
  supplierOrderId: string;
  status: string;
  message?: string | null;
  rawResponse?: Record<string, unknown>;
}): SupplierOrderResult {
  return supplierOrderResultSchema.parse({
    supplierOrderId: input.supplierOrderId,
    accepted: true,
    status: input.status,
    retryable: false,
    message: input.message ?? null,
    rawResponse: input.rawResponse ?? {},
    processedAt: new Date().toISOString(),
  });
}
