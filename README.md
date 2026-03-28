# Dropshipping Central

Dropshipping Central is an automation-first backend monorepo for running multi-platform dropshipping operations from one control centre. The current scope is the backend foundation only: API, worker runtime, shared domain modules, integration abstractions, workflow helpers, and the initial database schema.

Supplier connector architecture and extension guidance live in [docs/supplier-integrations.md](docs/supplier-integrations.md).

## Repository structure

```text
.
|-- apps
|   |-- api
|   `-- worker
|-- docs
|-- infrastructure
|-- packages
|   |-- config
|   |-- db
|   |-- domain
|   |-- integrations
|   |-- testkit
|   `-- workflows
|-- .env.example
|-- package.json
|-- pnpm-workspace.yaml
`-- turbo.json
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 15+ or compatible PostgreSQL instance

## Installation

```bash
pnpm install
```

If PowerShell blocks package manager shims on your machine, run the install from `cmd.exe` or use `corepack pnpm ...` from a shell with the required execution policy.

## Environment setup

1. Copy `.env.example` to `.env`.
2. Update `DATABASE_URL` to point at your PostgreSQL database.
3. Adjust `API_PORT` and `LOG_LEVEL` if needed.

## Running the API

```bash
pnpm --filter @dropshipping-central/api dev
```

The API starts on `http://localhost:$API_PORT` and registers routes under `/api/v1`.

## Running the worker

```bash
pnpm --filter @dropshipping-central/worker dev
```

The worker runs placeholder interval jobs for workflow processing, integration syncing, and order processing.

## Profitability tracking

Products now have first-class financial inputs through `/api/v1/products`:

- `costPrice`
- `salePrice`
- `currency`
- computed `expectedProfit`
- computed `expectedMarginPercent`

Orders now persist reporting-ready financial snapshots and line items:

- `subtotalRevenue`
- `shippingRevenue`
- `totalRevenue`
- `totalProductCost`
- `fulfillmentCost`
- `transactionFee`
- `totalCost`
- computed `grossProfit`
- computed `marginPercent`

Calculation rules:

- monetary values are rounded to 2 decimal places
- margin percentages are rounded to 2 decimal places
- product expected profit and margin are `null` when `costPrice` is missing
- order product cost, total cost, gross profit, and margin are `null` when any line item is missing cost data
- `marginPercent` returns `0` when recognized revenue is `0`
- cancelled and returned orders keep their stored revenue snapshot, but profit calculations treat recognized revenue as `0` to avoid overstating reporting results without explicit refund accounting

Order registration accepts explicit `lineItems`, `shippingRevenue`, `fulfillmentCost`, and `transactionFee`. If line items are omitted, the API falls back to `order.rawPayload.lineItems`, then `order.rawPayload.supplierLines`, then a single compatibility line based on `totalAmount`.

## Profitability alerts and rules

The platform now evaluates persisted product and order profitability through an extensible rules engine in `packages/domain` and a shared persistence service in `packages/workflows`.

Default thresholds:

- product minimum expected margin: `20%`
- product minimum expected profit: `10` in the product currency
- order minimum margin: `15%`

Config env vars:

- `PROFITABILITY_PRODUCT_MIN_MARGIN_PERCENT`
- `PROFITABILITY_PRODUCT_MIN_PROFIT`
- `PROFITABILITY_ORDER_MIN_MARGIN_PERCENT`

Current rules:

- `PRODUCT_LOW_EXPECTED_MARGIN`: warning when expected product margin is below threshold
- `PRODUCT_LOW_EXPECTED_PROFIT`: warning when expected product profit is below threshold
- `ORDER_NEGATIVE_GROSS_PROFIT`: critical when order gross profit is negative
- `ORDER_LOW_MARGIN`: warning when order margin is below threshold
- `ORDER_INCOMPLETE_COST_DATA`: warning when order costs are incomplete and profit cannot be trusted

Alert persistence and retrieval:

- alerts are stored in the `ProfitabilityAlert` table
- one active alert row is maintained per `entityType + entityId + ruleCode`
- repeated evaluations update the existing row instead of creating duplicates
- resolved conditions mark the alert as `RESOLVED`
- critical activations and alert lifecycle changes emit audit events for later notification or automation hooks
- active alerts are available through `GET /api/v1/profitability-alerts`

Rule evaluation triggers:

- product create
- product update
- paid order registration
- worker order status updates that touch profitability-relevant order state

## Fulfillment failure simulation

You can simulate fulfillment failures by sending `simulateFailure` inside `order.rawPayload` when posting to `/api/v1/orders/register-paid`.

Supported values:

- `once`: first execution fails transiently, the next retry succeeds
- `always`: every execution fails transiently until the max retry count is reached, then the job fails
- `permanent`: the job fails immediately with no retry

Retry rules:

- max retries: `3`
- `attemptCount` increments on every execution attempt
- transient failures return the job to `PENDING`
- permanent failures, or transient failures after the retry limit, set the job to `FAILED`
- successful execution sets the job to `SUCCEEDED` and the order to `FULFILLED`

Audit events emitted by the worker:

- `fulfillment.job.processing`
- `fulfillment.job.retry_scheduled`
- `fulfillment.job.failed`
- `fulfillment.job.succeeded`

## Prisma client generation

```bash
pnpm prisma:generate
```

## Running migrations

```bash
pnpm prisma:migrate:dev
```

## Seeding the database

```bash
pnpm db:seed
```

## Useful scripts

- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:seed`
- `pnpm prisma:studio`

## Current foundation scope

- Fastify API with versioned routing, env validation, Prisma plugin registration, and health/integrations/orders/workflows route modules
- Persisted product pricing records, profitability alerting, paid-order registration with financial snapshots and line items, and fulfillment job creation with audit events
- Worker bootstrap with isolated job modules and interval-based scheduling
- Worker execution that processes pending fulfillment jobs with retry and failure simulation support
- Shared config, domain schemas, integration connector contracts, workflow helpers, and test factories
- Prisma schema for integrations, credentials, products, orders, order line items, profitability alerts, fulfillment jobs, workflow runs, automation policies, and audit events

No frontend, auth, queues, or event bus are included yet. Those come after the backend foundation is stable.
