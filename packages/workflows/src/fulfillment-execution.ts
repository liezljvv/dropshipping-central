import { z } from 'zod';

const MAX_FULFILLMENT_JOB_RETRIES = 3;

export const simulateFailureEnum = z.enum(['once', 'always', 'permanent']);

const executionInputSchema = z.object({
  attemptCount: z.number().int().nonnegative(),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
});

const fulfillmentExecutionDecisionSchema = z.object({
  nextState: z.enum(['PENDING', 'SUCCEEDED', 'FAILED']),
  errorMessage: z.string().nullable(),
  shouldRetry: z.boolean(),
  attemptCount: z.number().int().positive(),
  simulateFailure: simulateFailureEnum.nullable(),
});

export type FulfillmentExecutionDecision = z.infer<typeof fulfillmentExecutionDecisionSchema>;
export type SimulateFailure = z.infer<typeof simulateFailureEnum>;

export function getSimulateFailure(rawPayload: Record<string, unknown> = {}) {
  return simulateFailureEnum.nullable().catch(null).parse(rawPayload.simulateFailure);
}

export function decideFulfillmentExecution(input: {
  attemptCount: number;
  rawPayload?: Record<string, unknown>;
}): FulfillmentExecutionDecision {
  const parsedInput = executionInputSchema.parse(input);
  const attemptCount = parsedInput.attemptCount + 1;
  const simulateFailure = getSimulateFailure(parsedInput.rawPayload);

  if (simulateFailure === 'permanent') {
    return fulfillmentExecutionDecisionSchema.parse({
      nextState: 'FAILED',
      errorMessage: 'Permanent fulfillment failure simulated.',
      shouldRetry: false,
      attemptCount,
      simulateFailure,
    });
  }

  if (simulateFailure === 'once' && attemptCount === 1) {
    return fulfillmentExecutionDecisionSchema.parse({
      nextState: 'PENDING',
      errorMessage: 'Transient fulfillment failure simulated for the first attempt.',
      shouldRetry: true,
      attemptCount,
      simulateFailure,
    });
  }

  if (simulateFailure === 'always') {
    const shouldRetry = attemptCount < MAX_FULFILLMENT_JOB_RETRIES;

    return fulfillmentExecutionDecisionSchema.parse({
      nextState: shouldRetry ? 'PENDING' : 'FAILED',
      errorMessage: shouldRetry
        ? `Transient fulfillment failure simulated on attempt ${attemptCount}.`
        : `Transient fulfillment failure simulated on attempt ${attemptCount}; max retries reached.`,
      shouldRetry,
      attemptCount,
      simulateFailure,
    });
  }

  return fulfillmentExecutionDecisionSchema.parse({
    nextState: 'SUCCEEDED',
    errorMessage: null,
    shouldRetry: false,
    attemptCount,
    simulateFailure,
  });
}
