import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createShopifyAdminClient } from './client.js';
import { ShopifyAuthError } from './errors.js';
import { createShopifySupplierConnector } from './index.js';

const ENV_KEYS = [
  'SHOPIFY_SUPPLIER_SHOP_DOMAIN',
  'SHOPIFY_SUPPLIER_ACCESS_TOKEN',
  'SHOPIFY_SUPPLIER_API_VERSION',
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setShopifyEnv() {
  process.env.SHOPIFY_SUPPLIER_SHOP_DOMAIN = 'supplier-shop.myshopify.com';
  process.env.SHOPIFY_SUPPLIER_ACCESS_TOKEN = 'test-token';
  process.env.SHOPIFY_SUPPLIER_API_VERSION = '2025-10';
}

function resetShopifyEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  resetShopifyEnv();
});

afterEach(() => {
  resetShopifyEnv();
});

describe('Shopify admin client', () => {
  it('retries after rate limiting and succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), {
          status: 429,
          headers: { 'Retry-After': '0' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ shop: { id: 1 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const client = createShopifyAdminClient({
      config: {
        provider: 'shopify',
        shopDomain: 'supplier-shop.myshopify.com',
        accessToken: 'token',
        apiVersion: '2025-10',
      },
      fetchImpl,
    });

    const result = await client.get<{ shop: { id: number } }>('/shop.json');

    expect(result.shop.id).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps authentication failures cleanly', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ errors: 'forbidden' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = createShopifyAdminClient({
      config: {
        provider: 'shopify',
        shopDomain: 'supplier-shop.myshopify.com',
        accessToken: 'bad-token',
        apiVersion: '2025-10',
      },
      fetchImpl,
      maxRetries: 0,
    });

    await expect(client.get('/shop.json')).rejects.toBeInstanceOf(ShopifyAuthError);
  });
});

describe('Shopify supplier connector live integration', () => {
  it('stays safe when credentials are missing', async () => {
    const connector = createShopifySupplierConnector();

    const products = await connector.searchProducts({
      limit: 10,
      tags: [],
    });
    const result = await connector.submitOrder({
      externalOrderId: 'ord_1000',
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
          variantId: 'gid://shopify/ProductVariant/100',
          sku: 'SKU-100',
          quantity: 1,
          unitPrice: 20,
          currency: 'USD',
        },
      ],
      metadata: {},
    });

    expect(products).toEqual([]);
    expect(result.status).toBe('NOT_CONFIGURED');
  });

  it('maps Shopify products from GraphQL search', async () => {
    setShopifyEnv();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          data: {
            products: {
              nodes: [
                {
                  id: 'gid://shopify/Product/200',
                  title: 'Aurora Lamp',
                  descriptionHtml: '<p>Desk lamp</p>',
                  tags: ['lighting'],
                  updatedAt: '2026-03-28T00:00:00.000Z',
                  featuredImage: { url: 'https://cdn.example.com/lamp.jpg' },
                  images: { nodes: [{ url: 'https://cdn.example.com/lamp-2.jpg' }] },
                  variants: {
                    nodes: [
                      {
                        id: 'gid://shopify/ProductVariant/201',
                        title: 'Black',
                        sku: 'LAMP-BLK',
                        price: '18.75',
                        compareAtPrice: '24.50',
                        updatedAt: '2026-03-28T00:00:00.000Z',
                        inventoryQuantity: 8,
                        inventoryItem: { id: 'gid://shopify/InventoryItem/301' },
                        selectedOptions: [{ name: 'Color', value: 'Black' }],
                      },
                    ],
                  },
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const connector = createShopifySupplierConnector({ fetchImpl });

    const products = await connector.searchProducts({
      query: 'Aurora',
      limit: 10,
      tags: ['lighting'],
    });

    expect(products).toHaveLength(1);
    expect(products[0]?.title).toBe('Aurora Lamp');
    expect(products[0]?.variants[0]?.sku).toBe('LAMP-BLK');
  });

  it('maps inventory and pricing from Shopify responses', async () => {
    setShopifyEnv();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              nodes: [
                {
                  id: 'gid://shopify/Product/200',
                  title: 'Aurora Lamp',
                  descriptionHtml: '<p>Desk lamp</p>',
                  tags: ['lighting'],
                  updatedAt: '2026-03-28T00:00:00.000Z',
                  images: { nodes: [] },
                  variants: {
                    nodes: [
                      {
                        id: 'gid://shopify/ProductVariant/201',
                        title: 'Black',
                        sku: 'LAMP-BLK',
                        price: '18.75',
                        compareAtPrice: '24.50',
                        updatedAt: '2026-03-28T00:00:00.000Z',
                        inventoryItem: { id: 'gid://shopify/InventoryItem/301' },
                        selectedOptions: [{ name: 'Color', value: 'Black' }],
                      },
                    ],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            inventory_levels: [
              {
                inventory_item_id: 301,
                available: 12,
                updated_at: '2026-03-28T00:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              nodes: [
                {
                  id: 'gid://shopify/Product/200',
                  title: 'Aurora Lamp',
                  descriptionHtml: '<p>Desk lamp</p>',
                  tags: ['lighting'],
                  updatedAt: '2026-03-28T00:00:00.000Z',
                  images: { nodes: [] },
                  variants: {
                    nodes: [
                      {
                        id: 'gid://shopify/ProductVariant/201',
                        title: 'Black',
                        sku: 'LAMP-BLK',
                        price: '18.75',
                        compareAtPrice: '24.50',
                        updatedAt: '2026-03-28T00:00:00.000Z',
                        inventoryItem: { id: 'gid://shopify/InventoryItem/301' },
                        selectedOptions: [{ name: 'Color', value: 'Black' }],
                      },
                    ],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    const connector = createShopifySupplierConnector({ fetchImpl });

    const inventory = await connector.getInventory(['gid://shopify/Product/200']);
    const pricing = await connector.getPricing(['gid://shopify/Product/200']);

    expect(inventory[0]?.available).toBe(12);
    expect(pricing[0]?.amount).toBe(18.75);
  });

  it('creates supplier orders through draft orders and completion', async () => {
    setShopifyEnv();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            draft_order: {
              id: 9001,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            order: {
              id: 9002,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    const connector = createShopifySupplierConnector({ fetchImpl });

    const result = await connector.submitOrder({
      externalOrderId: 'ord_1001',
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
          variantId: 'gid://shopify/ProductVariant/201',
          sku: 'LAMP-BLK',
          quantity: 1,
          unitPrice: 18.75,
          currency: 'USD',
        },
      ],
      metadata: {},
    });

    expect(result.accepted).toBe(true);
    expect(result.supplierOrderId).toBe('9002');
  });
});
