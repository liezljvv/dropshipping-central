import { type Prisma } from '@dropshipping-central/db';
import type { SupplierOrderSubmission } from '@dropshipping-central/domain';

function toWorkflowPayload(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function buildSupplierOrderSubmission(input: {
  orderId: string;
  supplierIntegrationId: string | null;
  rawPayload: Prisma.JsonValue | null;
  totalAmount: number;
  currency: string;
}): SupplierOrderSubmission {
  const rawPayload = toWorkflowPayload(input.rawPayload);
  const sourceLines = Array.isArray(rawPayload.supplierLines) ? rawPayload.supplierLines : [];
  const lines =
    sourceLines.length > 0
      ? sourceLines.map((line, index) => {
          const payload = typeof line === 'object' && line ? (line as Record<string, unknown>) : {};
          return {
            variantId: String(payload.variantId ?? 'mock-var-aurora-black'),
            sku: String(payload.sku ?? `AUTO-SKU-${index + 1}`),
            quantity: Number(payload.quantity ?? 1),
            unitPrice: Number(payload.unitPrice ?? input.totalAmount),
            currency: String(payload.currency ?? input.currency),
          };
        })
      : [
          {
            variantId: 'mock-var-aurora-black',
            sku: 'AUR-LAMP-BLK',
            quantity: 1,
            unitPrice: input.totalAmount,
            currency: input.currency,
          },
        ];

  const addressPayload =
    typeof rawPayload.shippingAddress === 'object' && rawPayload.shippingAddress
      ? (rawPayload.shippingAddress as Record<string, unknown>)
      : {};

  return {
    externalOrderId: input.orderId,
    supplierIntegrationId: input.supplierIntegrationId ?? undefined,
    shippingAddress: {
      fullName: String(addressPayload.fullName ?? 'Demo Customer'),
      line1: String(addressPayload.line1 ?? '123 Demo Street'),
      city: String(addressPayload.city ?? 'Berlin'),
      region: String(addressPayload.region ?? 'BE'),
      postalCode: String(addressPayload.postalCode ?? '10115'),
      countryCode: String(addressPayload.countryCode ?? 'DE'),
      phone: addressPayload.phone ? String(addressPayload.phone) : undefined,
      line2: addressPayload.line2 ? String(addressPayload.line2) : undefined,
    },
    lines,
    notes: typeof rawPayload.notes === 'string' ? rawPayload.notes : undefined,
    metadata: {
      ...rawPayload,
    },
  };
}
