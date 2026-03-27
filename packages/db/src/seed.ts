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
      rawPayload: {
        seeded: true,
      },
    },
  });

  await prisma.fulfillmentJob.upsert({
    where: { id: 'seed_fulfillment_job_1001' },
    update: {
      orderId: order.id,
      integrationId: wooIntegration.id,
      state: 'PENDING',
      attemptCount: 0,
      errorMessage: null,
    },
    create: {
      id: 'seed_fulfillment_job_1001',
      orderId: order.id,
      integrationId: wooIntegration.id,
      state: 'PENDING',
      attemptCount: 0,
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
        orderId: order.id,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        integrations: [shopifyIntegration.id, wooIntegration.id],
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
