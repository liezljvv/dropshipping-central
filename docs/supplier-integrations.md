# Supplier Integrations

Supplier-facing code now runs through a shared `SupplierConnector` contract in `packages/domain/src/suppliers.ts`. Calling code depends on supplier domain types plus the application services exported from `@dropshipping-central/integrations`, not on provider-specific APIs.

## Architecture

- `packages/domain`
  Defines supplier schemas, connector contract, capabilities, connection config, and order/catalog data types.
- `packages/integrations/src/suppliers`
  Contains provider adapters, connector registry, Prisma-backed connection repository, and the `SupplierCatalogService`, `SupplierOrderService`, and `SupplierConnectionService`.
- `apps/api`
  Reads supplier connections and catalog search results through the service layer.
- `apps/worker`
  Syncs catalog, inventory, and pricing, submits supplier orders, and requeues retryable failures through the same service layer.

## Provider Selection

- Supplier connections are persisted in `SupplierIntegration`.
- Runtime selection is provider-driven: the connection record resolves to a connector by `provider`.
- If calling code does not pass a connection id, the default connected supplier connection is used.
- The seeded demo environment uses the `mock` supplier connection by default.
- A `shopify` supplier connection is scaffolded and fully wired for readiness, diagnostics, and connection testing without requiring real credentials at startup.

## Adding A New Supplier

1. Implement `SupplierConnector` for the new provider under `packages/integrations/src/suppliers/<provider>`.
2. Add the connector to `StaticSupplierConnectorRegistry` in `packages/integrations/src/suppliers/runtime.ts`.
3. Seed or create a `SupplierIntegration` row with provider name, config JSON, and capability flags.
4. Keep provider-specific auth, product mapping, inventory sync, pricing sync, and order submission logic inside the connector module.

## Mock vs Shopify

- `mock`
  Uses local seeded data and deterministic order outcomes for demo/test flows.
- `shopify`
  Exposes the same interface with centralized config loading, readiness diagnostics, a lightweight connectivity test, a Shopify Admin API client, GraphQL product reads, REST inventory/order flows, and safe fallback behavior when credentials are missing.

## Shopify Setup

See [docs/shopify-supplier-setup.md](/C:/Users/Liezl/Desktop/DEVELOPMENT%20PROJECTS/Dropshipping%20Central/docs/shopify-supplier-setup.md) for the exact environment variables, test flow, activation steps, and fallback behavior.
