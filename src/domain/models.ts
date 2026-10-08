/** Роль пользователя, определяющая доступные части маркетплейса. */
export type Role = 'BUYER' | 'SELLER' | 'MODERATOR' | 'ADMIN';
/** Состояние публикации товара: черновик, проверка, одобрение или отказ. */
export type ProductStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
/** Состояние заявки на модерацию: ожидает решения, одобрена или отклонена. */
export type TicketStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
/** Состояние обработки заказа; завершение и отмена являются конечными состояниями. */
export type OrderStatus = 'CREATED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
/** Характеристики варианта товара: строковые пары, например цвет и размер. */
export type Attributes = Record<string, string>;
/** JSON-совместимое значение для характеристик и сохранённых снимков товара. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

/** Профиль пользователя без хеша пароля; используется в ответах и проверках доступа. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
}

/** Профиль с хешем пароля для проверки входа; не предназначен для публичного ответа. */
export interface UserCredentials extends UserProfile {
  passwordHash: string;
}

/** Refresh-сессия пользователя с хешем токена и сроком действия. */
export interface Session {
  id: string;
  userId: string;
  /** Хеш refresh-токена; исходный токен не хранится в сессии. */
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Плоская категория каталога без вложенных подкатегорий. */
export interface Category {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Физический остаток SKU и его резерв под незавершённые заказы.
 * Инвариант: 0 ≤ reserved ≤ quantity; доступно quantity − reserved.
 */
export interface Inventory {
  skuId: string;
  /** Физическое количество на складе, включая зарезервированные единицы. */
  quantity: number;
  /** Количество единиц, закреплённых за заказами и недоступных для новой покупки. */
  reserved: number;
}

/** Вариант товара с характеристиками, ценой в копейках и складским остатком. */
export interface Sku {
  id: string;
  productId: string;
  name: string;
  attributes: JsonValue;
  /** Цена продажи одной единицы в целых копейках, RUB. */
  price: number;
  /** Необязательная себестоимость в копейках; не раскрывается в публичном каталоге. */
  costPrice: number | null;
  /** Метка мягкого удаления; null означает, что SKU не архивирован. */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  inventory: Inventory | null;
}

/** Контент товара, его продавец, категория и состояние модерации. */
export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  images: string[];
  status: ProductStatus;
  /** Метка мягкого удаления; история заказов и заявок сохраняется. */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Товар с категорией и загруженными SKU для прикладных сценариев. */
export interface ProductDetails extends Product {
  category: Category;
  skus: Sku[];
}

/**
 * Данные товара для построения публичной карточки, включая имя продавца.
 * Перед ответом требуется маппер, исключающий внутренние поля SKU.
 */
export interface CatalogProduct extends ProductDetails {
  seller: { id: string; name: string };
}

/** SKU с товаром, необходимым для проверки публикации и доступности покупки. */
export interface PurchasableSku extends Sku {
  product: Product;
}

/** Заявка со снимком товара и сведениями о решении модератора. */
export interface ModerationTicket {
  id: string;
  productId: string;
  moderatorId: string | null;
  status: TicketStatus;
  /** Сохранённое содержимое товара на момент отправки, независимо от будущих изменений. */
  snapshot: JsonValue;
  reason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

/** Выбранный покупателем SKU и количество; позиция корзины не резервирует склад. */
export interface CartItem {
  id: string;
  buyerId: string;
  skuId: string;
  quantity: number;
  createdAt: Date;
}

/** Позиция корзины с актуальными данными SKU, товара и остатка. */
export interface CartEntry extends CartItem {
  sku: PurchasableSku;
}

/** Снимок названий, цены в копейках и количества на момент оформления заказа. */
export interface OrderItem {
  skuId: string;
  productName: string;
  skuName: string;
  unitPrice: number;
  quantity: number;
}

/** Результат оформления заказа без внутренних данных идемпотентности. */
export interface Order {
  id: string;
  buyerId: string;
  status: OrderStatus;
  /** Итоговая сумма заказа в целых копейках, RUB. */
  total: number;
  deliveryAddress: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}

/** Внутреннее представление заказа с данными для повторного оформления по ключу. */
export interface StoredOrder extends Order {
  /** Ключ повторного запроса, уникальный в пределах одного покупателя. */
  idempotencyKey: string;
  /** Хеш нормализованного тела оформления для обнаружения повторов с другим адресом. */
  requestHash: string;
}
