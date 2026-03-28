import type { SupplierOrderResult } from '@dropshipping-central/domain';

export type SupplierAttemptDecision = {
  nextState: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  retryable: boolean;
  errorMessage: string | null;
};

export function decideSupplierAttemptResult(input: {
  result: SupplierOrderResult;
  attemptCount: number;
  maxRetries?: number;
}): SupplierAttemptDecision {
  const maxRetries = input.maxRetries ?? 3;

  if (input.result.accepted) {
    return {
      nextState: 'SUCCEEDED',
      retryable: false,
      errorMessage: null,
    };
  }

  const canRetry = input.result.retryable && input.attemptCount < maxRetries;

  return {
    nextState: canRetry ? 'PENDING' : 'FAILED',
    retryable: input.result.retryable,
    errorMessage: input.result.message ?? 'Supplier submission failed.',
  };
}
