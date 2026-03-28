# Backend Foundation

## Architecture decisions

The repository is structured as a pnpm workspace monorepo with Turborepo orchestration so apps and shared packages can evolve independently while remaining type-safe. Fastify provides a lightweight HTTP foundation for operational APIs, Prisma handles PostgreSQL access, Zod owns runtime input validation, and Vitest establishes the test baseline without introducing heavy test infrastructure.

## Why this is automation-first

The data model and package layout prioritize operational automation before UI concerns. Workflow runs, fulfillment jobs, automation policies, audit events, and integration health are first-class concepts from the start. Human override support is preserved through explicit auditability and policy boundaries rather than blending manual decisions directly into automated behavior.

Profitability tracking follows the same principle. Products persist the minimum pricing inputs needed for automation, while expected profit and expected margin stay derived in shared domain helpers. Orders persist a financial snapshot at the time of registration, including revenue, product cost, fees, and line-item detail, so later reporting does not drift when product pricing changes.

Profitability alerts extend that model with persistent operational signals. The rules themselves are pure domain logic, while alert reconciliation and storage live in a shared workflow service. That keeps evaluation reusable across API writes and worker-driven order changes without embedding business rules inside controllers.

## Why integrations are abstracted

Dropshipping Central is intended to manage more than one commerce platform. The `packages/integrations` package defines connector contracts around capabilities such as connect, disconnect, health checks, catalog sync, and order sync. This keeps API and workflow logic platform-agnostic while leaving room for Shopify, WooCommerce, and future connectors to implement the same contract.

The new order financial model keeps that abstraction intact. Supplier connectors still receive normalized order submissions, but order profitability is now calculated from shared domain helpers before persistence and supplier submission. That keeps rounding, zero-revenue handling, missing-cost handling, and cancelled or returned order treatment consistent across API, worker, and future reporting code.

The same pattern now applies to rule evaluation. Product and order profitability checks use centralized thresholds from the config layer, emit severity-based alerts, suppress duplicate active records by reconciling against a single persistent alert row per rule and entity, and create audit events that are ready for future notification or automated action pipelines.

## What comes next

1. Add real persistence flows for integrations, orders, and workflow runs through service modules.
2. Introduce background execution semantics beyond intervals, likely with a queue and retry policy once job behavior is concrete.
3. Add reporting-oriented aggregates for daily, weekly, monthly, and quarterly summaries, including cancelled and returned orders.
4. Add integration lifecycle tracking, maintenance actions, and richer operator audit trails.
5. Add human override pathways that remain explicit and do not feed recommendation logic unless deliberately enabled.
