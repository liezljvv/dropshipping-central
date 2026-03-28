import {
  supplierConnectionReadinessSchema,
  supplierConnectionTestResultSchema,
  type SupplierConnection,
  type SupplierConnectionConfig,
  type SupplierConnectionReadiness,
  type SupplierConnectionTestResult,
} from '@dropshipping-central/domain';
import { createShopifyAdminClient, mapShopifyErrorToStatus } from './client.js';
import { isShopifySupplierError } from './errors.js';

const SHOPIFY_REQUIRED_FIELDS = [
  {
    key: 'shopDomain',
    envVar: 'SHOPIFY_SUPPLIER_SHOP_DOMAIN',
    label: 'Shopify shop domain',
  },
  {
    key: 'accessToken',
    envVar: 'SHOPIFY_SUPPLIER_ACCESS_TOKEN',
    label: 'Shopify admin access token',
  },
] as const;

const DEFAULT_API_VERSION = '2025-10';

type EnvInput = Record<string, string | undefined>;

export type ShopifySupplierResolvedConfig = {
  provider: 'shopify';
  shopDomain?: string;
  apiVersion: string;
  locationId?: string;
  inventoryPolicy?: string;
  accessToken?: string;
};

export type ShopifySupplierConfigState = {
  configured: boolean;
  status: SupplierConnection['status'];
  missingFields: string[];
  diagnostics: string[];
  nextStep: string | null;
  config: ShopifySupplierResolvedConfig;
};

function normalizeShopDomain(input?: string) {
  if (!input) {
    return undefined;
  }

  const value = input.trim();

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);

    if (url.pathname !== '/' || url.search || url.hash) {
      return null;
    }

    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function buildMissingFieldMessage(missingFields: string[]) {
  if (missingFields.length === 0) {
    return 'Shopify supplier configuration is present.';
  }

  return `Add ${missingFields.join(', ')} to enable this connector.`;
}

export function loadShopifySupplierConfig(input?: {
  env?: EnvInput;
  connectionConfig?: Partial<SupplierConnectionConfig>;
}): ShopifySupplierConfigState {
  const env = input?.env ?? process.env;
  const connectionConfig = input?.connectionConfig ?? {};
  const diagnostics: string[] = [];

  const rawShopDomain = env.SHOPIFY_SUPPLIER_SHOP_DOMAIN?.trim() || connectionConfig.shopDomain?.trim();
  const rawApiVersion = env.SHOPIFY_SUPPLIER_API_VERSION?.trim() || connectionConfig.apiVersion?.trim() || DEFAULT_API_VERSION;
  const rawLocationId = env.SHOPIFY_SUPPLIER_LOCATION_ID?.trim() || connectionConfig.locationId?.trim();
  const rawInventoryPolicy =
    env.SHOPIFY_SUPPLIER_INVENTORY_POLICY?.trim() || connectionConfig.inventoryPolicy?.trim();
  const rawAccessToken = env.SHOPIFY_SUPPLIER_ACCESS_TOKEN?.trim();

  const shopDomain = normalizeShopDomain(rawShopDomain);
  if (rawShopDomain && !shopDomain) {
    diagnostics.push(
      'SHOPIFY_SUPPLIER_SHOP_DOMAIN must be a bare Shopify hostname such as your-store.myshopify.com.',
    );
  }

  if (!/^\d{4}-\d{2}$/.test(rawApiVersion)) {
    diagnostics.push('SHOPIFY_SUPPLIER_API_VERSION must look like YYYY-MM, for example 2025-10.');
  }

  const missingFields = SHOPIFY_REQUIRED_FIELDS.filter(({ key }) => {
    if (key === 'shopDomain') {
      return !shopDomain;
    }

    return !rawAccessToken;
  }).map(({ envVar }) => envVar);

  const configured = missingFields.length === 0 && diagnostics.length === 0;
  const status: SupplierConnection['status'] =
    diagnostics.length > 0 ? 'ERROR' : configured ? 'PENDING' : 'NOT_CONFIGURED';
  const nextStep = configured ? 'Run a connection test to verify Shopify access.' : buildMissingFieldMessage(missingFields);

  return {
    configured,
    status,
    missingFields,
    diagnostics,
    nextStep,
    config: {
      provider: 'shopify',
      ...(shopDomain ? { shopDomain } : {}),
      apiVersion: rawApiVersion,
      ...(rawLocationId ? { locationId: rawLocationId } : {}),
      ...(rawInventoryPolicy ? { inventoryPolicy: rawInventoryPolicy } : {}),
      ...(rawAccessToken ? { accessToken: rawAccessToken } : {}),
    },
  };
}

function mapConnectionTestResult(input: {
  ok: boolean;
  status: SupplierConnection['status'];
  message: string;
  missingFields?: string[];
}): SupplierConnectionTestResult {
  return supplierConnectionTestResultSchema.parse({
    checkedAt: new Date().toISOString(),
    ok: input.ok,
    status: input.status,
    message: input.message,
    missingFields: input.missingFields ?? [],
  });
}

export async function testShopifySupplierConnection(input?: {
  env?: EnvInput;
  connectionConfig?: Partial<SupplierConnectionConfig>;
  fetchImpl?: typeof fetch;
}): Promise<SupplierConnectionTestResult> {
  const state = loadShopifySupplierConfig({
    ...(input?.env ? { env: input.env } : {}),
    ...(input?.connectionConfig ? { connectionConfig: input.connectionConfig } : {}),
  });

  if (!state.configured) {
    return mapConnectionTestResult({
      ok: false,
      status: state.status,
      message:
        state.diagnostics[0] ??
        'Shopify supplier credentials are not configured yet. Add the missing environment variables and test again.',
      missingFields: state.missingFields,
    });
  }

  const fetchImpl = input?.fetchImpl ?? fetch;

  try {
    const client = createShopifyAdminClient({
      config: state.config,
      fetchImpl,
    });
    await client.get<{ shop: { id: number | string } }>('/shop.json');

    return mapConnectionTestResult({
      ok: true,
      status: 'CONNECTED',
      message: 'Shopify connection check succeeded.',
    });
  } catch (error) {
    if (isShopifySupplierError(error)) {
      return mapConnectionTestResult({
        ok: false,
        status: mapShopifyErrorToStatus(error),
        message: error.message,
      });
    }

    return mapConnectionTestResult({
      ok: false,
      status: 'DEGRADED',
      message:
        error instanceof Error
          ? `Shopify connectivity check could not reach the API: ${error.message}`
          : 'Shopify connectivity check could not reach the API.',
    });
  }
}

export function buildShopifyConnectionReadiness(connection?: SupplierConnection): SupplierConnectionReadiness {
  const state = loadShopifySupplierConfig(connection?.config ? { connectionConfig: connection.config } : undefined);
  const metadata = connection?.config.metadata ?? {};
  const persistedTest = supplierConnectionTestResultSchema.safeParse(metadata.lastConnectionTest);
  const persistedDiagnostics = Array.isArray(metadata.diagnostics)
    ? metadata.diagnostics.filter((item): item is string => typeof item === 'string')
    : [];
  const lastError = typeof metadata.lastError === 'string' ? metadata.lastError : null;
  const baseStatus =
    state.status === 'PENDING' && connection?.status && connection.status !== 'NOT_CONFIGURED'
      ? connection.status
      : state.status;

  return supplierConnectionReadinessSchema.parse({
    configured: state.configured,
    status: persistedTest.success && !persistedTest.data.ok ? persistedTest.data.status : baseStatus,
    missingFields: state.missingFields,
    diagnostics:
      state.diagnostics.length > 0
        ? state.diagnostics
        : [lastError, ...persistedDiagnostics].filter((item): item is string => Boolean(item)),
    nextStep: state.nextStep,
    test: persistedTest.success ? persistedTest.data : null,
  });
}
