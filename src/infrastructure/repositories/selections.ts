/** Явная выборка профиля пользователя без passwordHash. */
export const userSelection = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

/** Категория и неархивные SKU товара с их складскими записями. */
export const productRelations = {
  category: true,
  skus: {
    where: { deletedAt: null },
    include: { inventory: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

/** Связи товара для каталога с безопасным набором полей продавца; SKU очищает публичный маппер. */
export const catalogRelations = {
  ...productRelations,
  seller: { select: { id: true, name: true } },
} as const;

/** Актуальные SKU, товар и склад для пересчёта корзины, включая недоступные позиции. */
export const cartRelations = {
  sku: { include: { inventory: true, product: true } },
} as const;

/** Выборка заказа со снимками позиций и внутренними полями; перед ответом требуется toOrder. */
export const orderSelection = {
  id: true,
  buyerId: true,
  status: true,
  total: true,
  deliveryAddress: true,
  idempotencyKey: true,
  requestHash: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      skuId: true,
      productName: true,
      skuName: true,
      unitPrice: true,
      quantity: true,
    },
    orderBy: { id: 'asc' },
  },
} as const;
