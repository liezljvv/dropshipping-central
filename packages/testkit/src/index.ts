import type { Integration, Order, WorkflowRun } from '@dropshipping-central/domain';

export function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int_test',
    platform: 'shopify',
    name: 'Test Integration',
    status: 'CONNECTED',
    metadata: {},
    lastHeartbeatAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_test',
    externalId: 'ord_external_test',
    sourcePlatform: 'shopify',
    status: 'PAID',
    totalAmount: 99.99,
    currency: 'USD',
    rawPayload: {},
    ...overrides,
  };
}

export function makeWorkflowRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: 'wf_test',
    workflowType: 'integration-health',
    state: 'RUNNING',
    context: {},
    startedAt: new Date().toISOString(),
    finishedAt: null,
    ...overrides,
  };
}
