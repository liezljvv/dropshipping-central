import type { ShopifySupplierResolvedConfig } from './config.js';
import {
  ShopifyApiError,
  ShopifyAuthError,
  ShopifyRateLimitError,
  type ShopifySupplierError,
} from './errors.js';

type FetchLike = typeof fetch;

type ShopifyAdminClientOptions = {
  config: ShopifySupplierResolvedConfig;
  fetchImpl?: FetchLike;
  maxRetries?: number;
  timeoutMs?: number;
};

type GraphqlSuccess<TData> = {
  data: TData;
  errors?: Array<{ message: string }>;
};

export type ShopifyAdminClient = {
  graphql<TData>(query: string, variables?: Record<string, unknown>): Promise<TData>;
  get<TData>(path: string, searchParams?: Record<string, string | undefined>): Promise<TData>;
  post<TData>(path: string, body?: unknown): Promise<TData>;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerValue: string | null) {
  if (!headerValue) {
    return 1_000;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(dateMs - Date.now(), 1_000);
  }

  return 1_000;
}

function logShopifyApiEvent(input: {
  method: string;
  path: string;
  status?: number;
  category: 'request' | 'response' | 'error' | 'retry';
  details?: string;
}) {
  const statusPart = input.status ? ` status=${input.status}` : '';
  const detailPart = input.details ? ` ${input.details}` : '';
  console.log(`[shopify-admin] ${input.category} ${input.method} ${input.path}${statusPart}${detailPart}`);
}

export function createShopifyAdminClient(options: ShopifyAdminClientOptions): ShopifyAdminClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseUrl = `https://${options.config.shopDomain}/admin/api/${options.config.apiVersion}`;

  async function request<TData>(input: {
    method: 'GET' | 'POST';
    path: string;
    searchParams?: Record<string, string | undefined>;
    body?: unknown;
  }): Promise<TData> {
    let attempt = 0;

    while (true) {
      attempt += 1;
      const url = new URL(`${baseUrl}${input.path}`);
      const basePath = new URL(baseUrl).pathname;

      for (const [key, value] of Object.entries(input.searchParams ?? {})) {
        if (typeof value === 'string' && value.length > 0) {
          url.searchParams.set(key, value);
        }
      }

      const requestPath = `${url.pathname.replace(basePath, '')}${url.search}`;

      const abortSignal = AbortSignal.timeout(timeoutMs);

      logShopifyApiEvent({
        method: input.method,
        path: requestPath,
        category: 'request',
      });

      try {
        const response = await fetchImpl(url, {
          method: input.method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': options.config.accessToken!,
          },
          ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
          signal: abortSignal,
        });

        logShopifyApiEvent({
          method: input.method,
          path: requestPath,
          status: response.status,
          category: 'response',
        });

        if (response.status === 401 || response.status === 403) {
          throw new ShopifyAuthError(
            'Shopify rejected the supplier credentials. Check the access token and app permissions.',
            response.status,
            { path: input.path },
          );
        }

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          const error = new ShopifyRateLimitError(
            'Shopify rate limit reached. The worker will retry after backoff.',
            retryAfterMs,
            429,
            { path: input.path },
          );

          if (attempt <= maxRetries + 1) {
            logShopifyApiEvent({
              method: input.method,
              path: requestPath,
              status: response.status,
              category: 'retry',
              details: `after=${retryAfterMs}ms attempt=${attempt}`,
            });
            await sleep(retryAfterMs);
            continue;
          }

          throw error;
        }

        if (!response.ok) {
          const retryable = response.status >= 500;
          const message = retryable
            ? `Shopify API returned HTTP ${response.status}.`
            : `Shopify rejected the request with HTTP ${response.status}.`;

          if (retryable && attempt <= maxRetries + 1) {
            const backoffMs = Math.min(1_000 * attempt, 5_000);
            logShopifyApiEvent({
              method: input.method,
              path: requestPath,
              status: response.status,
              category: 'retry',
              details: `after=${backoffMs}ms attempt=${attempt}`,
            });
            await sleep(backoffMs);
            continue;
          }

          throw new ShopifyApiError(message, retryable, response.status, {
            path: input.path,
          });
        }

        if (response.status === 204) {
          return undefined as TData;
        }

        return (await response.json()) as TData;
      } catch (error) {
        if (
          error instanceof ShopifyRateLimitError ||
          error instanceof ShopifyAuthError ||
          error instanceof ShopifyApiError
        ) {
          throw error;
        }

        const retryable = attempt <= maxRetries + 1;
        const message =
          error instanceof Error ? `Shopify request failed: ${error.message}` : 'Shopify request failed.';

        logShopifyApiEvent({
          method: input.method,
          path: requestPath,
          category: 'error',
          details: `attempt=${attempt}`,
        });

        if (retryable) {
          const backoffMs = Math.min(1_000 * attempt, 5_000);
          await sleep(backoffMs);
          continue;
        }

        throw new ShopifyApiError(message, true, undefined, {
          path: input.path,
        });
      }
    }
  }

  return {
    async graphql<TData>(query: string, variables?: Record<string, unknown>) {
      const response = await request<GraphqlSuccess<TData>>({
        method: 'POST',
        path: '/graphql.json',
        body: {
          query,
          variables: variables ?? {},
        },
      });

      if (Array.isArray(response.errors) && response.errors.length > 0) {
        const message = response.errors.map((item) => item.message).join('; ');
        throw new ShopifyApiError(`Shopify GraphQL request failed: ${message}`, false, 200, {
          errors: response.errors.map((item) => item.message),
        });
      }

      return response.data;
    },
    get(path, searchParams) {
      return request({
        method: 'GET',
        path,
        ...(searchParams ? { searchParams } : {}),
      });
    },
    post(path, body) {
      return request({
        method: 'POST',
        path,
        ...(body === undefined ? {} : { body }),
      });
    },
  };
}

export function mapShopifyErrorToStatus(error: ShopifySupplierError) {
  if (error instanceof ShopifyAuthError) {
    return 'AUTH_FAILED' as const;
  }

  if (error instanceof ShopifyRateLimitError) {
    return 'DEGRADED' as const;
  }

  return error.retryable ? ('DEGRADED' as const) : ('ERROR' as const);
}
