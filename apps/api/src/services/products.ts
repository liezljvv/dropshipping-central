import { db, type Prisma } from '@dropshipping-central/db';
import { enrichProductFinancials, productSchema } from '@dropshipping-central/domain';
import { evaluateAndPersistProductProfitabilityAlerts } from '@dropshipping-central/workflows';

type ProductInput = Parameters<typeof productSchema.parse>[0];

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function serializeProduct(product: {
  id: string;
  supplierIntegrationId: string | null;
  externalId: string | null;
  sourcePlatform: string | null;
  sku: string;
  title: string;
  description: string | null;
  salePrice: Prisma.Decimal;
  costPrice: Prisma.Decimal | null;
  currency: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return enrichProductFinancials({
    ...product,
    salePrice: product.salePrice.toNumber(),
    costPrice: product.costPrice?.toNumber() ?? null,
    metadata:
      product.metadata && typeof product.metadata === 'object' && !Array.isArray(product.metadata)
        ? product.metadata
        : {},
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  });
}

export async function listProducts() {
  const products = await db.product.findMany({
    orderBy: {
      updatedAt: 'desc',
    },
    take: 100,
  });

  return products.map(serializeProduct);
}

export async function createProduct(input: ProductInput) {
  const product = productSchema.parse(input);

  return db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        supplierIntegrationId: product.supplierIntegrationId ?? null,
        externalId: product.externalId ?? null,
        sourcePlatform: product.sourcePlatform ?? null,
        sku: product.sku,
        title: product.title,
        description: product.description ?? null,
        salePrice: product.salePrice.toString(),
        costPrice: product.costPrice == null ? null : product.costPrice.toString(),
        currency: product.currency,
        metadata: toInputJsonValue(product.metadata),
      },
    });

    await evaluateAndPersistProductProfitabilityAlerts({
      tx,
      actorType: 'USER',
      product: serializeProduct(created),
    });

    return serializeProduct(created);
  });
}

export async function updateProduct(id: string, input: ProductInput) {
  const product = productSchema.parse(input);

  return db.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        supplierIntegrationId: product.supplierIntegrationId ?? null,
        externalId: product.externalId ?? null,
        sourcePlatform: product.sourcePlatform ?? null,
        sku: product.sku,
        title: product.title,
        description: product.description ?? null,
        salePrice: product.salePrice.toString(),
        costPrice: product.costPrice == null ? null : product.costPrice.toString(),
        currency: product.currency,
        metadata: toInputJsonValue(product.metadata),
      },
    });

    await evaluateAndPersistProductProfitabilityAlerts({
      tx,
      actorType: 'USER',
      product: serializeProduct(updated),
    });

    return serializeProduct(updated);
  });
}
