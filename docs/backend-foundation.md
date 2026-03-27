# Backend Foundation

## Architecture decisions

The repository is structured as a pnpm workspace monorepo with Turborepo orchestration so apps and shared packages can evolve independently while remaining type-safe. Fastify provides a lightweight HTTP foundation for operational APIs, Prisma handles PostgreSQL access, Zod owns runtime input validation, and Vitest establishes the test baseline without introducing heavy test infrastructure.

## Why this is automation-first

The data model and package layout prioritize operational automation before UI concerns. Workflow runs, fulfillment jobs, automation policies, audit events, and integration health are first-class concepts from the start. Human override support is preserved through explicit auditability and policy boundaries rather than blending manual decisions directly into automated behavior.

## Why integrations are abstracted

Dropshipping Central is intended to manage more than one commerce platform. The `packages/integrations` package defines connector contracts around capabilities such as connect, disconnect, health checks, catalog sync, and order sync. This keeps API and workflow logic platform-agnostic while leaving room for Shopify, WooCommerce, and future connectors to implement the same contract.

## What comes next

1. Add real persistence flows for integrations, orders, and workflow runs through service modules.
2. Introduce background execution semantics beyond intervals, likely with a queue and retry policy once job behavior is concrete.
3. Add reporting-oriented aggregates for daily, weekly, monthly, and quarterly summaries, including cancelled and returned orders.
4. Add integration lifecycle tracking, maintenance actions, and richer operator audit trails.
5. Add human override pathways that remain explicit and do not feed recommendation logic unless deliberately enabled.
