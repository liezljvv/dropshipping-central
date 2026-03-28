# Shopify Supplier Setup

Shopify is scaffolded as the first real supplier connector for supplier catalog sync, inventory checks, pricing checks, supplier order submission, and order status tracking. The current implementation is safe to run before a Shopify supplier store exists.

## What Works Now

- The mock supplier remains the default connected supplier for demos, worker jobs, and seeded data.
- A Shopify supplier connection is seeded and visible in `/dashboard` and `/api/v1/supplier-connections`.
- Shopify readiness is calculated without exposing secrets.
- Missing or incomplete Shopify configuration shows as `NOT_CONFIGURED` or `ERROR` instead of crashing the API or worker.
- A lightweight connection test is available at `POST /api/v1/supplier-connections/:connectionId/test`.
- Real Shopify Admin API integration is implemented for product search, product lookup, inventory lookup, pricing lookup, draft-order submission, order status lookup, and order cancellation.

## Shopify API Usage

- GraphQL Admin API:
  product search, product lookup, pricing extraction
- REST Admin API:
  `GET /shop.json`
- REST Admin API:
  `GET /inventory_levels.json`
- REST Admin API:
  `POST /draft_orders.json`
- REST Admin API:
  `POST /draft_orders/{id}/complete.json`
- REST Admin API:
  `GET /orders/{id}.json`
- REST Admin API:
  `POST /orders/{id}/cancel.json`

The client applies timeout, retry, and 429 `Retry-After` handling. Access tokens are never written to logs.

## Credentials You Will Need Later

- `SHOPIFY_SUPPLIER_SHOP_DOMAIN`
  Example: `your-supplier-store.myshopify.com`
- `SHOPIFY_SUPPLIER_ACCESS_TOKEN`
  Shopify Admin API access token for the supplier store
- `SHOPIFY_SUPPLIER_API_VERSION`
  Defaults to `2025-10`
- Optional:
  `SHOPIFY_SUPPLIER_LOCATION_ID`
- Optional:
  `SHOPIFY_SUPPLIER_INVENTORY_POLICY`

## Where To Put Them

Add the values to your local `.env` file. The placeholder keys are already present in [.env.example](/C:/Users/Liezl/Desktop/DEVELOPMENT%20PROJECTS/Dropshipping%20Central/.env.example).

## How To Test The Connection

1. Add the Shopify supplier environment variables.
2. Restart the API and worker so they pick up the new env values.
3. Open `/dashboard` and click `Test Connection` on the Shopify supplier row.
4. Or call `POST /api/v1/supplier-connections/<id>/test` directly.
5. Confirm the connection status changes to `CONNECTED`.

## How To Activate Shopify As A Supplier

1. Populate the Shopify env values.
2. Test the connection until it reports `CONNECTED`.
3. Update the supplier connection record to make Shopify the active/default supplier if you want jobs to route there instead of the mock connector.
4. Keep the mock supplier row in place for fallback testing.

## How To Fall Back To Mock Mode

- Remove or blank the Shopify env values and restart services.
- Keep routing jobs to the seeded mock supplier connection.
- The Shopify supplier row will fall back to `NOT_CONFIGURED` and stop being treated as connected.

## Current Limitations

- Pricing currently assumes the store currency returned by Shopify variant pricing context, which is usually the shop currency.
- The order flow uses draft orders plus completion to create supplier-side orders.
- Some supplier-specific business rules may still need refinement once a real store, product catalog, and fulfillment workflow exist.

## Troubleshooting

- `NOT_CONFIGURED`
  Add the missing Shopify env variables and restart the API and worker.
- `AUTH_FAILED`
  Replace the access token or fix Admin API scopes, then run the connection test again.
- `DEGRADED`
  Shopify was unavailable or rate-limited. Wait for backoff and retry.
- `ERROR`
  The request payload or configuration was invalid. Review dashboard diagnostics and the API response message.
