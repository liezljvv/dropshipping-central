import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  const shopifyIntegration = await prisma.integration.upsert({
    where: { id: 'seed_shopify_primary' },
    update: {
      name: 'Primary Shopify Store',
      platform: 'shopify',
      status: 'CONNECTED',
      metadata: {
        shopDomain: 'primary-shop.myshopify.com',
      },
      lastHeartbeatAt: new Date(),
    },
    create: {
      id: 'seed_shopify_primary',
      name: 'Primary Shopify Store',
      platform: 'shopify',
      status: 'CONNECTED',
      metadata: {
        shopDomain: 'primary-shop.myshopify.com',
      },
      lastHeartbeatAt: new Date(),
    },
  });

  const wooIntegration = await prisma.integration.upsert({
    where: { id: 'seed_woo_secondary' },
    update: {
      name: 'Secondary WooCommerce Store',
      platform: 'woocommerce',
      status: 'CONNECTED',
      metadata: {
        baseUrl: 'https://example-woo.local',
      },
      lastHeartbeatAt: new Date(),
    },
    create: {
      id: 'seed_woo_secondary',
      name: 'Secondary WooCommerce Store',
      platform: 'woocommerce',
      status: 'CONNECTED',
      metadata: {
        baseUrl: 'https://example-woo.local',
      },
      lastHeartbeatAt: new Date(),
    },
  });

  const mockSupplierIntegration = await prisma.supplierIntegration.upsert({
    where: { id: 'seed_supplier_mock_primary' },
    update: {
      name: 'Primary Mock Supplier',
      provider: 'mock',
      status: 'CONNECTED',
      configPayload: {
        provider: 'mock',
        metadata: {
          seeded: true,
          configured: true,
          missingFields: [],
          diagnostics: [],
          nextStep: null,
        },
      },
      capabilities: {
        searchProducts: true,
        getProductById: true,
        getInventory: true,
        getPricing: true,
        submitOrder: true,
        getOrderStatus: true,
        cancelOrder: true,
      },
    },
    create: {
      id: 'seed_supplier_mock_primary',
      name: 'Primary Mock Supplier',
      provider: 'mock',
      status: 'CONNECTED',
      configPayload: {
        provider: 'mock',
        metadata: {
          seeded: true,
          configured: true,
          missingFields: [],
          diagnostics: [],
          nextStep: null,
        },
      },
      capabilities: {
        searchProducts: true,
        getProductById: true,
        getInventory: true,
        getPricing: true,
        submitOrder: true,
        getOrderStatus: true,
        cancelOrder: true,
      },
    },
  });

  await prisma.supplierIntegration.upsert({
    where: { id: 'seed_supplier_shopify_placeholder' },
    update: {
      name: 'Shopify Supplier Placeholder',
      provider: 'shopify',
      status: 'NOT_CONFIGURED',
      configPayload: {
        provider: 'shopify',
        shopDomain: 'supplier-shop.myshopify.com',
        apiVersion: '2025-10',
        metadata: {
          placeholder: true,
          configured: false,
          missingFields: ['SHOPIFY_SUPPLIER_ACCESS_TOKEN'],
          diagnostics: ['Add Shopify supplier credentials before activating this connector.'],
          nextStep: 'Add SHOPIFY_SUPPLIER_SHOP_DOMAIN and SHOPIFY_SUPPLIER_ACCESS_TOKEN, then run a connection test.',
          credentialFields: {
            shopDomainEnvVar: 'SHOPIFY_SUPPLIER_SHOP_DOMAIN',
            accessTokenEnvVar: 'SHOPIFY_SUPPLIER_ACCESS_TOKEN',
            apiVersionEnvVar: 'SHOPIFY_SUPPLIER_API_VERSION',
            locationIdEnvVar: 'SHOPIFY_SUPPLIER_LOCATION_ID',
          },
        },
      },
      capabilities: {
        searchProducts: true,
        getProductById: true,
        getInventory: true,
        getPricing: true,
        submitOrder: true,
        getOrderStatus: true,
        cancelOrder: false,
      },
    },
    create: {
      id: 'seed_supplier_shopify_placeholder',
      name: 'Shopify Supplier Placeholder',
      provider: 'shopify',
      status: 'NOT_CONFIGURED',
      configPayload: {
        provider: 'shopify',
        shopDomain: 'supplier-shop.myshopify.com',
        apiVersion: '2025-10',
        metadata: {
          placeholder: true,
          configured: false,
          missingFields: ['SHOPIFY_SUPPLIER_ACCESS_TOKEN'],
          diagnostics: ['Add Shopify supplier credentials before activating this connector.'],
          nextStep: 'Add SHOPIFY_SUPPLIER_SHOP_DOMAIN and SHOPIFY_SUPPLIER_ACCESS_TOKEN, then run a connection test.',
          credentialFields: {
            shopDomainEnvVar: 'SHOPIFY_SUPPLIER_SHOP_DOMAIN',
            accessTokenEnvVar: 'SHOPIFY_SUPPLIER_ACCESS_TOKEN',
            apiVersionEnvVar: 'SHOPIFY_SUPPLIER_API_VERSION',
            locationIdEnvVar: 'SHOPIFY_SUPPLIER_LOCATION_ID',
          },
        },
      },
      capabilities: {
        searchProducts: true,
        getProductById: true,
        getInventory: true,
        getPricing: true,
        submitOrder: true,
        getOrderStatus: true,
        cancelOrder: false,
      },
    },
  });

  await prisma.automationPolicy.upsert({
    where: { key: 'order.auto_fulfillment' },
    update: {
      enabled: true,
      configPayload: {
        autoCreateFulfillmentJobs: true,
      },
    },
    create: {
      key: 'order.auto_fulfillment',
      enabled: true,
      configPayload: {
        autoCreateFulfillmentJobs: true,
      },
      integrationId: shopifyIntegration.id,
    },
  });

  const auroraLamp = await prisma.product.upsert({
    where: { sku: 'AUR-LAMP-BLK' },
    update: {
      supplierIntegrationId: mockSupplierIntegration.id,
      externalId: 'mock-prod-aurora-lamp',
      sourcePlatform: 'shopify',
      title: 'Aurora Lamp Black',
      description: 'Seeded product for profitability tracking.',
      salePrice: '149.99',
      costPrice: '74.50',
      currency: 'USD',
      metadata: {
        seeded: true,
      },
    },
    create: {
      supplierIntegrationId: mockSupplierIntegration.id,
      externalId: 'mock-prod-aurora-lamp',
      sourcePlatform: 'shopify',
      sku: 'AUR-LAMP-BLK',
      title: 'Aurora Lamp Black',
      description: 'Seeded product for profitability tracking.',
      salePrice: '149.99',
      costPrice: '74.50',
      currency: 'USD',
      metadata: {
        seeded: true,
      },
    },
  });

  const order = await prisma.order.upsert({
    where: {
      externalId_sourcePlatform: {
        externalId: 'seed-order-1001',
        sourcePlatform: 'shopify',
      },
    },
    update: {
      integrationId: shopifyIntegration.id,
      status: 'PAID',
      totalAmount: '149.99',
      currency: 'USD',
      subtotalRevenue: '144.99',
      shippingRevenue: '5.00',
      totalRevenue: '149.99',
      totalProductCost: '74.50',
      fulfillmentCost: '8.00',
      transactionFee: '4.50',
      totalCost: '87.00',
      rawPayload: {
        seeded: true,
      },
    },
    create: {
      externalId: 'seed-order-1001',
      sourcePlatform: 'shopify',
      integrationId: shopifyIntegration.id,
      status: 'PAID',
      totalAmount: '149.99',
      currency: 'USD',
      subtotalRevenue: '144.99',
      shippingRevenue: '5.00',
      totalRevenue: '149.99',
      totalProductCost: '74.50',
      fulfillmentCost: '8.00',
      transactionFee: '4.50',
      totalCost: '87.00',
      rawPayload: {
        seeded: true,
      },
    },
  });

  await prisma.orderLineItem.deleteMany({
    where: {
      orderId: order.id,
    },
  });

  await prisma.orderLineItem.create({
    data: {
      orderId: order.id,
      productId: auroraLamp.id,
      externalId: auroraLamp.externalId,
      sku: auroraLamp.sku,
      title: auroraLamp.title,
      quantity: 1,
      unitSalePrice: '144.99',
      unitCostPrice: '74.50',
      currency: 'USD',
      metadata: {
        seeded: true,
      },
    },
  });

  await prisma.fulfillmentJob.upsert({
    where: { id: 'seed_fulfillment_job_1001' },
    update: {
      orderId: order.id,
      integrationId: wooIntegration.id,
      supplierIntegrationId: mockSupplierIntegration.id,
      supplierOrderId: null,
      state: 'PENDING',
      attemptCount: 0,
      retryable: false,
      errorMessage: null,
    },
    create: {
      id: 'seed_fulfillment_job_1001',
      orderId: order.id,
      integrationId: wooIntegration.id,
      supplierIntegrationId: mockSupplierIntegration.id,
      supplierOrderId: null,
      state: 'PENDING',
      attemptCount: 0,
      retryable: false,
      errorMessage: null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorType: 'SYSTEM',
      eventType: 'seed.completed',
      entityType: 'Integration',
      entityId: shopifyIntegration.id,
      payload: {
        integrations: [shopifyIntegration.id, wooIntegration.id],
        supplierIntegrations: [mockSupplierIntegration.id],
        productId: auroraLamp.id,
        orderId: order.id,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        integrations: [shopifyIntegration.id, wooIntegration.id],
        supplierIntegrations: [mockSupplierIntegration.id],
        productId: auroraLamp.id,
        orderId: order.id,
      },
      null,
      2,
    ),
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
