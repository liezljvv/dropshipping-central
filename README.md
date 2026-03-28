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
- Persisted paid-order registration that creates fulfillment jobs and audit events
- Worker bootstrap with isolated job modules and interval-based scheduling
- Worker execution that processes pending fulfillment jobs with retry and failure simulation support
- Shared config, domain schemas, integration connector contracts, workflow helpers, and test factories
- Prisma schema for integrations, credentials, orders, fulfillment jobs, workflow runs, automation policies, and audit events

No frontend, auth, queues, or event bus are included yet. Those come after the backend foundation is stable.
