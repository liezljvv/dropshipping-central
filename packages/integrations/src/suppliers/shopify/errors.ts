export type ShopifyErrorCategory =
  | 'not_configured'
  | 'auth'
  | 'rate_limit'
  | 'api'
  | 'network';

type ShopifyErrorInput = {
  category: ShopifyErrorCategory;
  message: string;
  retryable: boolean;
  statusCode: number | undefined;
  debugDetails: Record<string, unknown> | undefined;
};

export class ShopifySupplierError extends Error {
  readonly category: ShopifyErrorCategory;
  readonly retryable: boolean;
  readonly statusCode: number | undefined;
  readonly debugDetails: Record<string, unknown> | undefined;

  constructor(input: ShopifyErrorInput) {
    super(input.message);
    this.name = this.constructor.name;
    this.category = input.category;
    this.retryable = input.retryable;
    this.statusCode = input.statusCode;
    this.debugDetails = input.debugDetails;
  }
}

export class ShopifyNotConfiguredError extends ShopifySupplierError {
  constructor(message: string, debugDetails?: Record<string, unknown>) {
    super({
      category: 'not_configured',
      message,
      retryable: false,
      statusCode: undefined,
      debugDetails,
    });
  }
}

export class ShopifyAuthError extends ShopifySupplierError {
  constructor(message: string, statusCode?: number, debugDetails?: Record<string, unknown>) {
    super({
      category: 'auth',
      message,
      retryable: false,
      statusCode,
      debugDetails,
    });
  }
}

export class ShopifyRateLimitError extends ShopifySupplierError {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number, statusCode = 429, debugDetails?: Record<string, unknown>) {
    super({
      category: 'rate_limit',
      message,
      retryable: true,
      statusCode,
      debugDetails,
    });
    this.retryAfterMs = retryAfterMs;
  }
}

export class ShopifyApiError extends ShopifySupplierError {
  constructor(message: string, retryable: boolean, statusCode?: number, debugDetails?: Record<string, unknown>) {
    super({
      category: 'api',
      message,
      retryable,
      statusCode,
      debugDetails,
    });
  }
}

export function isShopifySupplierError(error: unknown): error is ShopifySupplierError {
  return error instanceof ShopifySupplierError;
}
