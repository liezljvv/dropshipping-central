import type { SupplierInventory, SupplierPrice, SupplierProduct } from '@dropshipping-central/domain';

const now = '2026-03-28T00:00:00.000Z';

export const mockSupplierProducts: SupplierProduct[] = [
  {
    id: 'mock-prod-aurora-lamp',
    externalId: 'aurora-lamp',
    supplierName: 'Mock Supplier',
    title: 'Aurora Desk Lamp',
    description: 'Adjustable LED desk lamp with warm and cool temperature modes.',
    tags: ['lighting', 'desk', 'home-office'],
    imageUrls: ['https://example.local/mock/aurora-lamp.jpg'],
    updatedAt: now,
    variants: [
      {
        id: 'mock-var-aurora-black',
        productId: 'mock-prod-aurora-lamp',
        sku: 'AUR-LAMP-BLK',
        title: 'Black',
        optionValues: { Color: 'Black' },
      },
      {
        id: 'mock-var-aurora-white',
        productId: 'mock-prod-aurora-lamp',
        sku: 'AUR-LAMP-WHT',
        title: 'White',
        optionValues: { Color: 'White' },
      },
    ],
  },
  {
    id: 'mock-prod-porto-bottle',
    externalId: 'porto-bottle',
    supplierName: 'Mock Supplier',
    title: 'Porto Steel Bottle',
    description: 'Insulated 750ml bottle with matte finish.',
    tags: ['drinkware', 'outdoor', 'fitness'],
    imageUrls: ['https://example.local/mock/porto-bottle.jpg'],
    updatedAt: now,
    variants: [
      {
        id: 'mock-var-porto-sand',
        productId: 'mock-prod-porto-bottle',
        sku: 'POR-BOT-SND',
        title: 'Sand',
        optionValues: { Color: 'Sand' },
      },
    ],
  },
];

export const mockSupplierInventory: SupplierInventory[] = [
  {
    productId: 'mock-prod-aurora-lamp',
    variantId: 'mock-var-aurora-black',
    available: 48,
    reserved: 3,
    updatedAt: now,
  },
  {
    productId: 'mock-prod-aurora-lamp',
    variantId: 'mock-var-aurora-white',
    available: 31,
    reserved: 2,
    updatedAt: now,
  },
  {
    productId: 'mock-prod-porto-bottle',
    variantId: 'mock-var-porto-sand',
    available: 120,
    reserved: 10,
    updatedAt: now,
  },
];

export const mockSupplierPricing: SupplierPrice[] = [
  {
    productId: 'mock-prod-aurora-lamp',
    variantId: 'mock-var-aurora-black',
    currency: 'USD',
    amount: 18.75,
    compareAtAmount: 24.5,
    updatedAt: now,
  },
  {
    productId: 'mock-prod-aurora-lamp',
    variantId: 'mock-var-aurora-white',
    currency: 'USD',
    amount: 18.75,
    compareAtAmount: 24.5,
    updatedAt: now,
  },
  {
    productId: 'mock-prod-porto-bottle',
    variantId: 'mock-var-porto-sand',
    currency: 'USD',
    amount: 9.4,
    compareAtAmount: 12,
    updatedAt: now,
  },
];
