import { db, type Prisma } from '@dropshipping-central/db';
import {
  supplierCapabilitySetSchema,
  supplierConnectionConfigSchema,
  supplierConnectionSchema,
  type SupplierConnection,
} from '@dropshipping-central/domain';

export type SupplierConnectionUpsertInput = {
  id?: string;
  name: string;
  provider: string;
  status: SupplierConnection['status'];
  config: SupplierConnection['config'];
  capabilities: SupplierConnection['capabilities'];
};

export interface SupplierConnectionRepository {
  listConnections(): Promise<SupplierConnection[]>;
  getConnectionById(id: string): Promise<SupplierConnection | null>;
  getDefaultConnection(): Promise<SupplierConnection | null>;
  upsertConnection(input: SupplierConnectionUpsertInput): Promise<SupplierConnection>;
}

function parseJsonRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function mapSupplierConnection(record: {
  id: string;
  name: string;
  provider: string;
  status: SupplierConnection['status'];
  configPayload: Prisma.JsonValue;
  capabilities: Prisma.JsonValue;
  lastCatalogSyncAt: Date | null;
  lastInventorySyncAt: Date | null;
  lastPricingSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SupplierConnection {
  return supplierConnectionSchema.parse({
    id: record.id,
    name: record.name,
    provider: record.provider,
    status: record.status,
    config: supplierConnectionConfigSchema.parse(parseJsonRecord(record.configPayload)),
    capabilities: supplierCapabilitySetSchema.parse(parseJsonRecord(record.capabilities)),
    lastCatalogSyncAt: record.lastCatalogSyncAt?.toISOString() ?? null,
    lastInventorySyncAt: record.lastInventorySyncAt?.toISOString() ?? null,
    lastPricingSyncAt: record.lastPricingSyncAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaSupplierConnectionRepository implements SupplierConnectionRepository {
  async listConnections() {
    const items = await db.supplierIntegration.findMany({
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
    });

    return items.map(mapSupplierConnection);
  }

  async getConnectionById(id: string) {
    const item = await db.supplierIntegration.findUnique({
      where: { id },
    });

    return item ? mapSupplierConnection(item) : null;
  }

  async getDefaultConnection() {
    const item = await db.supplierIntegration.findFirst({
      where: {
        status: 'CONNECTED',
      },
      orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
    });

    return item ? mapSupplierConnection(item) : null;
  }

  async upsertConnection(input: SupplierConnectionUpsertInput) {
    const record = await db.supplierIntegration.upsert({
      where: {
        id: input.id ?? '__missing__',
      },
      update: {
        name: input.name,
        provider: input.provider,
        status: input.status as never,
        configPayload: toJsonValue(input.config),
        capabilities: toJsonValue(input.capabilities),
      },
      create: {
        name: input.name,
        provider: input.provider,
        status: input.status as never,
        configPayload: toJsonValue(input.config),
        capabilities: toJsonValue(input.capabilities),
      },
    });

    return mapSupplierConnection(record);
  }
}
